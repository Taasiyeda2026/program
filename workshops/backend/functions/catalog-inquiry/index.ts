// Public catalog inquiry endpoint. JWT gateway retained; recipient is fixed server-side.
const origins = new Set(["https://taasiyeda.work","https://www.taasiyeda.work"]);
const env = (key: string) => Deno.env.get(key) || "";
const service = env("SUPABASE_SERVICE_ROLE_KEY");
const base = env("SUPABASE_URL");
const recipient = "office@think.org.il";
const limit = (v: unknown, n: number) => typeof v === "string" ? v.trim().slice(0,n+1) : "";
const escapeHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] || c));
async function rpc(name: string, data: unknown) {
 const r = await fetch(base+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:service,Authorization:"Bearer "+service,"Content-Type":"application/json"},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(String(j.message||"Database error"))}
 return r.json();
}
async function token(){
 const r=await fetch("https://login.microsoftonline.com/"+encodeURIComponent(env("FEEDBACK_STAFF_MS_TENANT_ID"))+"/oauth2/v2.0/token",{method:"POST",body:new URLSearchParams({client_id:env("FEEDBACK_STAFF_MS_CLIENT_ID"),client_secret:env("FEEDBACK_STAFF_MS_CLIENT_SECRET"),scope:"https://graph.microsoft.com/.default",grant_type:"client_credentials"}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error("Microsoft authentication failed");
 const t=await r.json();if(!t.access_token)throw Error("Missing mail token");const raw=t.access_token.split(".")[1];const claims=JSON.parse(atob(raw.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(raw.length/4)*4,"=")));if(!Array.isArray(claims.roles)||!claims.roles.includes("Mail.Send"))throw Error("Mail.Send permission missing");return t.access_token;
}
async function send(data: any, selections: any[], marketingName?: string, marketingEmail?: string){
 if(!env("FEEDBACK_STAFF_MS_TENANT_ID")||!env("FEEDBACK_STAFF_MS_CLIENT_ID")||!env("FEEDBACK_STAFF_MS_CLIENT_SECRET"))throw Error("Mail configuration unavailable");
 const access=await token();
 const catalog=data.catalog==="space"?"חלל":"STEM";
 const target=typeof marketingEmail==="string"&&/^[a-z0-9._%+-]+@think\.org\.il$/i.test(marketingEmail)?marketingEmail:recipient;
 const cc=target.toLowerCase()!==recipient.toLowerCase()?[{emailAddress:{address:recipient}}]:[];
 const fields=[["שם איש הקשר",data.name],["בית ספר / ארגון",data.organization],["טלפון",data.phone],["מייל לחזרה",data.email],["קטלוג",catalog],["משווקת",marketingName||"כללי"],["מספר פנייה",data.id]];
 const html='<div dir="rtl" style="font-family:Arial,sans-serif;color:#19334d;font-size:15px;line-height:1.65;max-width:680px"><h2 style="color:#164e78">פנייה חדשה מקטלוג הסדנאות</h2><table style="border-collapse:collapse;width:100%">'+fields.map(([k,v])=>'<tr><td style="padding:8px;border-bottom:1px solid #dde5ed;font-weight:bold">'+escapeHtml(k)+'</td><td style="padding:8px;border-bottom:1px solid #dde5ed">'+escapeHtml(v)+'</td></tr>').join("")+'</table><h3>הסדנאות שנבחרו</h3><ol>'+selections.map(i=>'<li><strong>'+escapeHtml(i.title)+'</strong> · כיתות '+escapeHtml(i.age)+(i.model&&i.model!=="דגם יחיד"?" · "+escapeHtml(i.model):"")+'</li>').join("")+'</ol>'+(data.notes?'<h3>הערות נוספות</h3><p style="white-space:pre-wrap">'+escapeHtml(data.notes)+'</p>':'')+'<p><a href="https://taasiyeda.work/workshops/admin/">למערכת ניהול הקטלוג</a></p></div>';
 const r=await fetch("https://graph.microsoft.com/v1.0/users/"+encodeURIComponent(recipient)+"/sendMail",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},body:JSON.stringify({message:{subject:"פנייה חדשה – קטלוג סדנאות מייקרים "+catalog+" | תעשיידע",body:{contentType:"HTML",content:html},toRecipients:[{emailAddress:{address:target}}],ccRecipients:cc,replyTo:[{emailAddress:{address:data.email}}]},saveToSentItems:true}),signal:AbortSignal.timeout(20000)});
 if(r.status!==202){const body=await r.json().catch(()=>({}));throw Error("Mail provider rejected request: "+r.status+" "+String(body?.error?.code||"").slice(0,80))}
}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"";
 const cors={"Access-Control-Allow-Origin":origins.has(origin)?origin:"https://taasiyeda.work","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
 if(req.method==="OPTIONS")return origins.has(origin)?new Response(null,{status:204,headers:cors}):json({error:"Forbidden"},403);
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(!origins.has(origin))return json({error:"Forbidden"},403);
 try{
  if(!service||!base)return json({error:"Service unavailable"},503);
  const len=Number(req.headers.get("content-length")||0);if(len>20000)return json({error:"Request too large"},413);
  const raw=await req.text();if(raw.length>20000)return json({error:"Request too large"},413);
  let b:any;try{b=JSON.parse(raw)}catch{return json({error:"טופס לא תקין"},400)}
  if(!b||typeof b!=="object"||Array.isArray(b)||b.website)return json({error:"טופס לא תקין"},400);
  const d={id:limit(b.id,36),catalog:limit(b.catalog,5),name:limit(b.name,100),organization:limit(b.organization,160),email:limit(b.email,254).toLowerCase(),phone:limit(b.phone,40),notes:limit(b.notes,2000)};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.id)||!["stem","space"].includes(d.catalog)||d.name.length<2||d.name.length>100||d.organization.length<2||d.organization.length>160||d.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)||/[\r\n]/.test(d.email)||d.phone.length<7||d.phone.length>40||!/^[+\d\s().-]+$/.test(d.phone)||d.notes.length>2000||!Array.isArray(b.items)||b.items.length<1||b.items.length>41)return json({error:"יש למלא פרטי קשר תקינים ולבחור סדנאות"},400);
  const items=b.items.map((x:any)=>({id:limit(x?.id,40),age:limit(x?.age,10),model:limit(x?.model,40)}));
  if(items.some((i:any)=>!/^STM-\d{3}$/.test(i.id)||!["א׳–ג׳","ד׳–ו׳"].includes(i.age)||!/^\d+(?:-\d+)?$/.test(i.model)))return json({error:"בחירת הסדנאות אינה תקינה"},400);
  const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim().slice(0,128);
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(service+":"+ip));
  const rate=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
  const marketing=typeof b.marketing==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.marketing)?b.marketing:null;
  let record:any;
  try{record=await rpc("stem_catalog_create_routed_inquiry",{p_id:d.id,p_catalog:d.catalog,p_name:d.name,p_org:d.organization,p_email:d.email,p_phone:d.phone,p_notes:d.notes,p_items:items,p_rate_key:rate,p_marketing:marketing})}
  catch(e){const msg=String(e);if(msg.includes("rate limit"))return json({error:"בוצעו יותר מדי פניות. נסו שוב מאוחר יותר."},429);if(msg.includes("invalid"))return json({error:"פרטי הפנייה אינם תקינים"},400);throw e}
  if(!record.new)return json({ok:true,id:d.id,status:record.status});
  let sent=false;
  try{await send(d,record.selections,record.marketing_name,record.marketing_email);sent=true}catch(e){console.error("catalog inquiry mail failed",d.id,String(e))}
  try{await rpc("stem_catalog_finish_inquiry",{p_id:d.id,p_sent:sent})}catch(e){console.error("catalog inquiry status update failed",d.id)}
  return json({ok:true,id:d.id,status:sent?"sent":"failed"});
 }catch(e){console.error("catalog inquiry failed",String(e).slice(0,200));return json({error:"לא ניתן היה לשמור את הפנייה. נסו שוב."},500)}
});
