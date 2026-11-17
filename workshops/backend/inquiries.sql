begin;
create table stem_catalog.inquiries (
 id uuid primary key,
 created_at timestamptz not null default now(),
 catalog text not null check(catalog in ('stem','space')),
 contact_name text not null check(length(contact_name) between 2 and 100),
 organization text not null check(length(organization) between 2 and 160),
 email text not null check(length(email)<=254),
 phone text not null check(length(phone) between 7 and 40),
 notes text not null default '' check(length(notes)<=2000),
 selections jsonb not null check(jsonb_typeof(selections)='array'),
 rate_key text not null,
 email_status text not null default 'sending' check(email_status in ('sending','sent','failed')),
 sent_at timestamptz
);
alter table stem_catalog.inquiries enable row level security;
revoke all on stem_catalog.inquiries from public,anon,authenticated;
grant select on stem_catalog.inquiries to authenticated;
grant select,insert,update on stem_catalog.inquiries to service_role;
create policy inquiry_admin_read on stem_catalog.inquiries for select to authenticated using ((select stem_catalog.is_admin()));
create index inquiry_rate_idx on stem_catalog.inquiries(rate_key,created_at);
create index inquiry_email_idx on stem_catalog.inquiries(lower(email),created_at);
create index inquiry_created_idx on stem_catalog.inquiries(created_at desc);
-- Service-only entrypoint; resolve the requested IDs against the published catalog.
create function public.stem_catalog_create_inquiry(p_id uuid,p_catalog text,p_name text,p_org text,p_email text,p_phone text,p_notes text,p_items jsonb,p_rate_key text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare picked jsonb; existing stem_catalog.inquiries%rowtype;
begin
 if p_catalog not in ('stem','space') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 41 or length(p_rate_key)<>64 then raise exception 'invalid request'; end if;
 -- Serialize checks across concurrent requests; fixed recipient plus rate limits prevent mail abuse.
 perform pg_advisory_xact_lock(73519021);
 select * into existing from stem_catalog.inquiries where id=p_id;
 if found then
  if existing.rate_key<>p_rate_key or lower(existing.email)<>lower(p_email) then raise exception 'invalid request'; end if;
  return jsonb_build_object('id',existing.id,'status',existing.email_status,'new',false);
 end if;
 if (select count(*) from stem_catalog.inquiries where rate_key=p_rate_key and created_at>now()-interval '1 hour')>=5
 or (select count(*) from stem_catalog.inquiries where lower(email)=lower(p_email) and created_at>now()-interval '1 hour')>=3
 or (select count(*) from stem_catalog.inquiries where created_at>now()-interval '1 hour')>=60 then raise exception 'rate limit'; end if;
 select jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'age',v.age_group,'model',p.model_name,'model_id',p.id) order by x.ord) into picked
 from jsonb_array_elements(p_items) with ordinality x(item,ord)
 join stem_catalog.workshops w on w.id=x.item->>'id' and w.status='published'
 join stem_catalog.catalog_workshops cw on cw.workshop_id=w.id and cw.catalog_id=p_catalog and cw.approved
 join stem_catalog.catalogs c on c.id=cw.catalog_id and c.status='published'
 join stem_catalog.workshop_variants v on v.workshop_id=w.id and v.age_group=x.item->>'age' and v.status='published'
 join stem_catalog.variant_products l on l.variant_id=v.id and l.approved
 join stem_catalog.products p on p.id=l.product_id and p.id=x.item->>'model' and p.status='published' and p.availability='available';
 if picked is null or jsonb_array_length(picked)<>jsonb_array_length(p_items) or (select count(distinct i->>'id') from jsonb_array_elements(picked) i)<>jsonb_array_length(p_items) then raise exception 'invalid selection'; end if;
 insert into stem_catalog.inquiries(id,catalog,contact_name,organization,email,phone,notes,selections,rate_key)
 values(p_id,p_catalog,p_name,p_org,lower(p_email),p_phone,coalesce(p_notes,''),picked,p_rate_key);
 return jsonb_build_object('id',p_id,'status','sending','new',true,'selections',picked);
end $$;
revoke all on function public.stem_catalog_create_inquiry(uuid,text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.stem_catalog_create_inquiry(uuid,text,text,text,text,text,text,jsonb,text) to service_role;
create function public.stem_catalog_finish_inquiry(p_id uuid,p_sent boolean) returns void language sql security invoker set search_path=pg_catalog as $$
 update stem_catalog.inquiries set email_status=case when p_sent then 'sent' else 'failed' end,sent_at=case when p_sent then now() else null end where id=p_id and email_status='sending'
$$;
revoke all on function public.stem_catalog_finish_inquiry(uuid,boolean) from public,anon,authenticated;
grant execute on function public.stem_catalog_finish_inquiry(uuid,boolean) to service_role;
create function public.stem_catalog_list_inquiries() returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
begin
 if not stem_catalog.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (select id,created_at,catalog,contact_name,organization,email,phone,notes,selections,email_status,sent_at from stem_catalog.inquiries order by created_at desc limit 200) q),'[]'::jsonb);
end $$;
revoke all on function public.stem_catalog_list_inquiries() from public,anon;
grant execute on function public.stem_catalog_list_inquiries() to authenticated;
commit;
