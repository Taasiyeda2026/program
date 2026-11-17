
-- Private uploads; only approved objects may be signed for a public viewer.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('stem-catalog-images','stem-catalog-images',false,10485760,array['image/webp'])
on conflict(id) do nothing;
create policy stem_catalog_storage_admin_read on storage.objects for select to authenticated using(bucket_id='stem-catalog-images' and (select stem_catalog.is_admin()));
create policy stem_catalog_storage_admin_insert on storage.objects for insert to authenticated with check(bucket_id='stem-catalog-images' and (select stem_catalog.is_admin()) and name ~ '^[0-9]+(-[0-9]+)?(\.[0-9]+)?\.webp$');
create policy stem_catalog_storage_admin_update on storage.objects for update to authenticated using(bucket_id='stem-catalog-images' and (select stem_catalog.is_admin())) with check(bucket_id='stem-catalog-images' and (select stem_catalog.is_admin()) and name ~ '^[0-9]+(-[0-9]+)?(\.[0-9]+)?\.webp$');
create policy stem_catalog_storage_public_approved on storage.objects for select to anon,authenticated using(bucket_id='stem-catalog-images' and exists(select 1 from stem_catalog.product_images i join stem_catalog.workshops w on w.id=i.workshop_id where i.storage_path='private:'||storage.objects.name and i.approved and w.status='published' and (i.product_id is null or exists(select 1 from stem_catalog.products p where p.id=i.product_id and p.status='published' and p.availability='available'))));
-- Ensure a publish operation is explicit and atomic. No missing-photo requirement.
create function public.stem_catalog_publish(p_workshop text,p_catalog_ids text[],p_publish boolean) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if not stem_catalog.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from stem_catalog.workshops where id=p_workshop) then raise exception 'Unknown workshop'; end if;
 if not p_publish then
  update stem_catalog.workshops set status='draft' where id=p_workshop;
  update stem_catalog.catalog_workshops set approved=false where workshop_id=p_workshop;
  return jsonb_build_object('published',false);
 end if;
 if coalesce(array_length(p_catalog_ids,1),0)=0 or exists(select 1 from unnest(p_catalog_ids) x where not exists(select 1 from stem_catalog.catalogs c where c.id=x)) then raise exception 'Select valid catalogs'; end if;
 if not exists(select 1 from stem_catalog.workshop_variants where workshop_id=p_workshop and status='published') then raise exception 'Approve at least one pedagogical version first'; end if;
 if exists(select 1 from stem_catalog.workshop_variants v where v.workshop_id=p_workshop and v.status='published' and not exists(select 1 from stem_catalog.variant_products vp join stem_catalog.products p on p.id=vp.product_id where vp.variant_id=v.id and vp.approved and p.status='published' and p.availability='available')) then raise exception 'Each published age needs an approved available model'; end if;
 if exists(select 1 from stem_catalog.workshops w where w.id=p_workshop and w.default_price is not null and nullif(w.pricing_unit,'') is null) or exists(select 1 from stem_catalog.products p join stem_catalog.workshops w on w.id=p.workshop_id where p.workshop_id=p_workshop and p.status='published' and p.price is not null and coalesce(nullif(p.pricing_unit,''),nullif(w.pricing_unit,'')) is null) then raise exception 'Define pricing unit'; end if;
 update stem_catalog.workshops set status='published' where id=p_workshop;
 update stem_catalog.catalog_workshops set approved=false where workshop_id=p_workshop;
 insert into stem_catalog.catalog_workshops(catalog_id,workshop_id,sort_order,approved) select c.id,p_workshop,w.sort_order,true from stem_catalog.catalogs c cross join stem_catalog.workshops w where c.id=any(p_catalog_ids) and w.id=p_workshop on conflict(catalog_id,workshop_id) do update set approved=true;
 update stem_catalog.catalogs set status='published' where id=any(p_catalog_ids);
 return jsonb_build_object('published',true);
end $$;
revoke all on function public.stem_catalog_publish(text,text[],boolean) from public,anon;
grant execute on function public.stem_catalog_publish(text,text[],boolean) to authenticated;
