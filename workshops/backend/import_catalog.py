"""Validate and convert the canonical XLSX to an atomic PostgreSQL import.
Usage: python import_catalog.py catalog.xlsx > seed.sql
The output includes draft/internal records: do NOT publish or commit seed.sql.
Requires openpyxl. All identifiers are treated as text. No image file is assumed present.
"""
import sys, re, json, collections
from openpyxl import load_workbook

def fail(msg): raise ValueError(msg)
def require(ok,msg):
    if not ok: fail(msg)
def text(v):
    if v is None: return None
    if isinstance(v,str): return v
    return str(v)
def identifier(v):
    require(isinstance(v,str) and v.strip()==v and bool(v),"Missing or non-text identifier: "+repr(v))
    return v
def sql(v):
    if v is None: return 'NULL'
    if isinstance(v,bool): return 'TRUE' if v else 'FALSE'
    if isinstance(v,(int,float)): return str(v)
    return "'"+str(v).replace("'","''")+"'"
def insert(table,columns,values):
    return "INSERT INTO stem_catalog."+table+" ("+",".join(columns)+") VALUES ("+",".join(map(sql,values))+");"
def ages(label):
    return {'א׳–ג׳':{'א׳–ג׳'},'ד׳–ו׳':{'ד׳–ו׳'},'א׳–ו׳':{'א׳–ג׳','ד׳–ו׳'}}[label]
def parse_filename(name):
    m=re.fullmatch(r'([0-9]+)(?:-([0-9]+))?(?:\.([123]))?\.webp',name)
    require(m is not None,"Invalid image filename "+name)
    base,model,stage=m.groups()
    return base,base+('-'+model if model else ''),{None:'finished','1':'intermediate','2':'raw','3':'demo'}[stage]
def read_rows(book,sheet):
    it=iter(book[sheet].values)
    headers=next(it)
    return [(tuple(row),dict(zip(headers,row))) for row in it if any(x is not None for x in row)]
def index(rows):
    out={}
    for row,_ in rows:
        key=identifier(row[0])
        require(key not in out,"Duplicate ID "+key)
        out[key]=row
    return out
def main(path):
    wb=load_workbook(path,data_only=True,read_only=True)
    wr,vr,cr,pr,ir=[read_rows(wb,s) for s in ('סדנאות','תוכן פדגוגי','תחומי STEM','תוצרים ודגמים','תמונות')]
    w,v,c,p,i=map(index,(wr,vr,cr,pr,ir))
    base_to_workshop={identifier(r[17]):k for k,r in w.items()}
    require(len(base_to_workshop)==len(w),"Duplicate image group")
    out=['BEGIN;','SET CONSTRAINTS ALL DEFERRED;']
    for k,r in c.items():
        out.append(insert('categories',['id','name','color','icon','description','sort_order'],[k,*r[1:6]]))
    for k,r in w.items():
        require(r[7] in c,'Unknown category '+k)
        default=identifier(r[16])
        require(default in p and p[default][1]==k,'Wrong default model '+k)
        require(r[5] in ('א׳–ג׳','ד׳–ו׳','א׳–ו׳'),'Wrong age '+k)
        out.append(insert('workshops',['id','image_base','title','subtitle','summary','category_id','duration_minutes','age_label','sort_order','default_price','pricing_unit','default_product_id'],[k,r[17],r[3],r[4],r[8],r[7],r[6],r[5],r[25],r[14],r[15],default]))
    for k,r in p.items():
        require(r[1] in w and r[6]==w[r[1]][17],'Wrong model group '+k)
        require(identifier(r[13])==k,'Wrong model ID '+k)
        out.append(insert('products',['id','workshop_id','image_group','model_id','name','model_name','description','age_label','sort_order','price','pricing_unit'],[k,r[1],r[6],r[13],r[2],r[3],r[4],r[5],r[10],r[7],r[8]]))
        out.append(insert('internal_product_costs',['product_id','internal_cost','notes'],[k,r[9],r[12]]))
    seen_ages=collections.defaultdict(set)
    for k,r in v.items():
        wid,default,age=r[1:4]
        require(wid in w and default in p and p[default][1]==wid,'Wrong variant model '+k)
        require(age in ages(w[wid][5]) and age in ages(p[default][5]),'Wrong variant age '+k)
        require(age not in seen_ages[wid],'Duplicate age variant '+k)
        seen_ages[wid].add(age)
        out.append(insert('workshop_variants',['id','workshop_id','age_group','duration_minutes','summary','lesson','activity','concepts','product_description','skills'],[k,wid,*r[3:11]]))
        # Explicit source association is the default; compatible alternative models
        # are candidates only, never automatically approved.
        for pid,prod in p.items():
            if prod[1]==wid and age in ages(prod[5]):
                out.append(insert('variant_products',['variant_id','product_id','workshop_id','is_default','approved'],[k,pid,wid,pid==default,False]))
    for wid,r in w.items():
        require(seen_ages[wid]==ages(r[5]),'Missing age variant '+wid)
    seen_names=set()
    for k,r in i.items():
        pid,group,name=r[1:4]
        require(group in base_to_workshop,'Unknown image group '+k)
        wid=base_to_workshop[group]
        base,model,stage=parse_filename(identifier(name))
        require(base==group and name==k+'.webp' and name not in seen_names,'Wrong image filename '+k)
        seen_names.add(name)
        if pid is None:
            require(r[12]=='שער סדנה' and model==base and stage=='finished','Invalid shared cover '+k)
            stage='cover'
        else:
            require(pid in p and p[pid][1]==wid and model==p[pid][13] and r[11]==model,'Wrong image model '+k)
            require({'מוגמר':'finished','ביניים':'intermediate','גולמי':'raw','הדגמה':'demo'}.get(r[5])==stage,'Wrong image stage '+k)
        out.append(insert('product_images',['id','workshop_id','product_id','image_group','filename','stage','purpose','title','sort_order','is_primary','canva_page','previous_filename','source_status'],[k,wid,pid,group,name,stage,r[12],r[6],r[8],r[7]=='כן',text(r[4]),r[13],r[9]]))
    # Preserve every original cell in a restricted audit table, not in the public frontend.
    for entity,rows in [('workshop',wr),('variant',vr),('category',cr),('product',pr),('image',ir)]:
        for r,record in rows:
            out.append(insert('import_notes',['entity_type','entity_id','source_row'],[entity,r[0],json.dumps(record,ensure_ascii=False,default=str)]))
    for cid,name in [('stem','כל סדנאות STEM'),('space','סדנאות חלל')]:
        out.append(insert('catalogs',['id','name'],[cid,name]))
    for wid,r in w.items():
        out.append(insert('catalog_workshops',['catalog_id','workshop_id','sort_order','approved'],['stem',wid,r[25],False]))
        if r[7]=='SPACE':
            out.append(insert('catalog_workshops',['catalog_id','workshop_id','sort_order','approved'],['space',wid,r[25],False]))
    out.append('COMMIT;')
    print('\n'.join(out))
    print('Validated:',len(w),'workshops;',len(v),'variants;',len(p),'models;',len(c),'categories;',len(i),'image records',file=sys.stderr)

if __name__=='__main__': main(sys.argv[1])
