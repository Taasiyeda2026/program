
-- The only catalog administrators are active linked dashboard administrators.
create function stem_catalog.is_admin() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and exists(select 1 from public.users u where u.auth_user_id=auth.uid() and u.is_active and u.role='admin')
$$;
revoke all on function stem_catalog.is_admin() from public,anon,authenticated;
grant execute on function stem_catalog.is_admin() to authenticated;
grant usage on schema stem_catalog to anon,authenticated;
-- Catalog tables stay in an unexposed schema; access only via explicitly granted views/RPC.
do $$ declare t text; begin
 foreach t in array array['categories','workshops','products','workshop_variants','variant_products','product_images','internal_product_costs','import_notes','catalogs','catalog_workshops'] loop
 execute format('grant select,insert,update on stem_catalog.%I to authenticated',t);
 execute format('create policy stem_admin on stem_catalog.%I for all to authenticated using ((select stem_catalog.is_admin())) with check ((select stem_catalog.is_admin()))',t);
 end loop;
end $$;
grant select on stem_catalog.categories,stem_catalog.workshops,stem_catalog.products,stem_catalog.workshop_variants,stem_catalog.variant_products,stem_catalog.product_images,stem_catalog.catalogs,stem_catalog.catalog_workshops to anon;
create policy public_categories on stem_catalog.categories for select to anon,authenticated using (true);
create policy public_workshops on stem_catalog.workshops for select to anon,authenticated using(status='published');
create policy public_variants on stem_catalog.workshop_variants for select to anon,authenticated using(status='published' and exists(select 1 from stem_catalog.workshops w where w.id=workshop_id and w.status='published'));
create policy public_models on stem_catalog.products for select to anon,authenticated using(status='published' and availability='available' and exists(select 1 from stem_catalog.workshops w where w.id=workshop_id and w.status='published'));
create policy public_variant_products on stem_catalog.variant_products for select to anon,authenticated using(approved and exists(select 1 from stem_catalog.workshop_variants v where v.id=variant_id and v.status='published') and exists(select 1 from stem_catalog.products p where p.id=product_id and p.status='published' and p.availability='available'));
create policy public_images on stem_catalog.product_images for select to anon,authenticated using(approved and storage_path is not null and exists(select 1 from stem_catalog.workshops w where w.id=workshop_id and w.status='published') and (product_id is null or exists(select 1 from stem_catalog.products p where p.id=product_id and p.status='published' and p.availability='available')));
create policy public_catalogs on stem_catalog.catalogs for select to anon,authenticated using(status='published');
create policy public_catalog_workshops on stem_catalog.catalog_workshops for select to anon,authenticated using(approved and exists(select 1 from stem_catalog.catalogs c where c.id=catalog_id and c.status='published') and exists(select 1 from stem_catalog.workshops w where w.id=workshop_id and w.status='published'));
-- RPC invoker uses underlying RLS, explicit whitelist and explicit published filter even for administrators.
create function public.stem_catalog_public() returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
select jsonb_build_object(
'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'description',description,'sort_order',sort_order) order by sort_order) from stem_catalog.categories),'[]'::jsonb),
'workshops',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'subtitle',w.subtitle,'summary',w.summary,'category_id',w.category_id,'duration_minutes',w.duration_minutes,'age_label',w.age_label,'sort_order',w.sort_order,'default_price',w.default_price,'pricing_unit',w.pricing_unit,'default_product_id',w.default_product_id,
'catalogs',coalesce((select jsonb_agg(cw.catalog_id) from stem_catalog.catalog_workshops cw join stem_catalog.catalogs c on c.id=cw.catalog_id where cw.workshop_id=w.id and cw.approved and c.status='published'),'[]'::jsonb),
'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'age_group',v.age_group,'duration_minutes',v.duration_minutes,'summary',v.summary,'lesson',v.lesson,'activity',v.activity,'concepts',v.concepts,'product_description',v.product_description,'skills',v.skills,'models',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'model_name',p.model_name,'description',p.description,'price',p.price,'pricing_unit',p.pricing_unit,'is_default',vp.is_default,'activity_override',vp.activity_override,'learning_override',vp.learning_override,'product_override',vp.product_override,
'images',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'filename',i.filename,'storage_path',i.storage_path,'stage',i.stage,'title',i.title,'is_primary',i.is_primary,'sort_order',i.sort_order) order by i.sort_order) from stem_catalog.product_images i where i.product_id=p.id and i.approved and i.storage_path is not null),'[]'::jsonb)) order by vp.is_default desc,p.sort_order) from stem_catalog.variant_products vp join stem_catalog.products p on p.id=vp.product_id where vp.variant_id=v.id and vp.approved and p.status='published' and p.availability='available'),'[]'::jsonb)) order by v.age_group) from stem_catalog.workshop_variants v where v.workshop_id=w.id and v.status='published'),'[]'::jsonb),
'cover', (select jsonb_build_object('storage_path',i.storage_path,'title',i.title) from stem_catalog.product_images i where i.workshop_id=w.id and i.product_id is null and i.approved and i.storage_path is not null order by i.sort_order limit 1)) order by w.sort_order) from stem_catalog.workshops w where w.status='published' and exists(select 1 from stem_catalog.workshop_variants v where v.workshop_id=w.id and v.status='published') and exists(select 1 from stem_catalog.catalog_workshops cw join stem_catalog.catalogs c on c.id=cw.catalog_id where cw.workshop_id=w.id and cw.approved and c.status='published')),'[]'::jsonb))
$$;
revoke all on function public.stem_catalog_public() from public;
grant execute on function public.stem_catalog_public() to anon,authenticated;
create function public.stem_catalog_admin_data() returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
declare result jsonb; t text; rows jsonb;
begin
 if not stem_catalog.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 result='{}'::jsonb;
 foreach t in array array['categories','workshops','products','workshop_variants','variant_products','product_images','internal_product_costs','catalogs','catalog_workshops','import_notes'] loop
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from stem_catalog.%I x',t) into rows;
 result=result||jsonb_build_object(t,rows);
 end loop;
 return result;
end $$;
revoke all on function public.stem_catalog_admin_data() from public,anon;
grant execute on function public.stem_catalog_admin_data() to authenticated;
-- Atomic insert-only initial import; no overwrite or deletion. RLS enforces admin role.
create function public.stem_catalog_import(payload jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare t text; n integer;
begin
 if not stem_catalog.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 if exists(select 1 from stem_catalog.workshops) then raise exception 'Catalog already initialized; use editor'; end if;
 set constraints all deferred;
 foreach t in array array['categories','workshops','products','workshop_variants','variant_products','product_images','internal_product_costs','catalogs','catalog_workshops','import_notes'] loop
 if jsonb_typeof(payload->t) is distinct from 'array' then raise exception 'Missing array %',t; end if;
 execute format('insert into stem_catalog.%I select * from jsonb_populate_recordset(null::stem_catalog.%I,$1)',t,t) using payload->t;
 end loop;
 if exists(select 1 from stem_catalog.workshops where status<>'draft') or exists(select 1 from stem_catalog.products where status<>'draft') or exists(select 1 from stem_catalog.workshop_variants where status<>'draft') or exists(select 1 from stem_catalog.product_images where approved) or exists(select 1 from stem_catalog.variant_products where approved) or exists(select 1 from stem_catalog.catalog_workshops where approved) or exists(select 1 from stem_catalog.catalogs where status<>'draft') then raise exception 'Initial import must be draft only'; end if;
 return jsonb_build_object('workshops',(select count(*) from stem_catalog.workshops),'variants',(select count(*) from stem_catalog.workshop_variants),'products',(select count(*) from stem_catalog.products),'images',(select count(*) from stem_catalog.product_images));
end $$;
revoke all on function public.stem_catalog_import(jsonb) from public,anon;
grant execute on function public.stem_catalog_import(jsonb) to authenticated;
-- Update or insert one normalized record; primary keys are preserved; no destructive delete.
create function public.stem_catalog_save(entity text, record jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare keys text; updates text; allowed text; col text; tablecols text;
begin
 if not stem_catalog.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 case entity
 when 'categories' then keys='id';
 when 'workshops' then keys='id';
 when 'products' then keys='id';
 when 'workshop_variants' then keys='id';
 when 'variant_products' then keys='variant_id,product_id';
 when 'product_images' then keys='id';
 when 'internal_product_costs' then keys='product_id';
 when 'catalogs' then keys='id';
 when 'catalog_workshops' then keys='catalog_id,workshop_id';
 else raise exception 'Unsupported entity';
 end case;
 select string_agg(quote_ident(column_name),',' order by ordinal_position),string_agg(format('%I=excluded.%I',column_name,column_name),',' order by ordinal_position) filter(where not(column_name=any(string_to_array(keys,',')))) into tablecols,updates from information_schema.columns where table_schema='stem_catalog' and table_name=entity;
 if tablecols is null or updates is null then raise exception 'Unknown columns'; end if;
 execute format('insert into stem_catalog.%I (%s) select %s from jsonb_populate_record(null::stem_catalog.%I,$1) on conflict (%s) do update set %s',entity,tablecols,tablecols,entity,keys,updates) using record;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.stem_catalog_save(text,jsonb) from public,anon;
grant execute on function public.stem_catalog_save(text,jsonb) to authenticated;
