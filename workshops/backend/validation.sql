
alter table stem_catalog.product_images add constraint stem_no_blank_approval check(not approved or source_status is distinct from 'blank');
create unique index stem_one_cover_per_workshop on stem_catalog.product_images(workshop_id) where product_id is null and is_primary;
create function stem_catalog.validate_model_image_link() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
declare w stem_catalog.workshops%rowtype; p stem_catalog.products%rowtype; v stem_catalog.workshop_variants%rowtype;
begin
 if tg_table_name='products' then
  select * into w from stem_catalog.workshops where id=new.workshop_id;
  if new.image_group<>w.image_base or not (new.model_id=w.image_base or new.model_id ~ ('^'||w.image_base||'-[0-9]+$')) then raise exception 'Model image group mismatch'; end if;
  if exists(select 1 from stem_catalog.variant_products l join stem_catalog.workshop_variants va on va.id=l.variant_id where l.product_id=new.id and l.approved and new.age_label not in(va.age_group,'א׳–ו׳')) then raise exception 'Remove incompatible approved age links first'; end if;
 elsif tg_table_name='workshop_variants' then
  select * into w from stem_catalog.workshops where id=new.workshop_id;
  if w.age_label not in(new.age_group,'א׳–ו׳') then raise exception 'Variant age does not match workshop'; end if;
  if exists(select 1 from stem_catalog.variant_products l join stem_catalog.products pr on pr.id=l.product_id where l.variant_id=new.id and l.approved and pr.age_label not in(new.age_group,'א׳–ו׳')) then raise exception 'Remove incompatible approved model links first'; end if;
 elsif tg_table_name='variant_products' then
  select * into v from stem_catalog.workshop_variants where id=new.variant_id;
  select * into p from stem_catalog.products where id=new.product_id;
  if p.age_label not in(v.age_group,'א׳–ו׳') and (new.approved or new.is_default) then raise exception 'Model age mismatch'; end if;
 elsif tg_table_name='product_images' then
  select * into w from stem_catalog.workshops where id=new.workshop_id;
  if new.image_group<>w.image_base then raise exception 'Image group mismatch'; end if;
  if new.filename !~ '^[0-9]+(-[0-9]+)?(\.[0-9]+)?\.webp$' then raise exception 'Invalid WebP filename'; end if;
  if new.storage_path is not null and new.storage_path not in('private:'||new.filename,'/space-workshops/images/'||new.filename) then raise exception 'Invalid storage path'; end if;
  if new.approved and new.storage_path like 'private:%' and not exists(select 1 from storage.objects o where o.bucket_id='stem-catalog-images' and o.name=new.filename) then raise exception 'Uploaded image is missing'; end if;
 end if;
 return new;
end $$;
create trigger stem_validate_models before insert or update on stem_catalog.products for each row execute function stem_catalog.validate_model_image_link();
create trigger stem_validate_variants before insert or update on stem_catalog.workshop_variants for each row execute function stem_catalog.validate_model_image_link();
create trigger stem_validate_links before insert or update on stem_catalog.variant_products for each row execute function stem_catalog.validate_model_image_link();
create trigger stem_validate_images before insert or update on stem_catalog.product_images for each row execute function stem_catalog.validate_model_image_link();
create or replace function public.stem_catalog_public() returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
select jsonb_build_object(
'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'description',description,'sort_order',sort_order) order by sort_order) from stem_catalog.categories),'[]'::jsonb),
'workshops',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'subtitle',w.subtitle,'summary',w.summary,'category_id',w.category_id,'duration_minutes',w.duration_minutes,'age_label',w.age_label,'sort_order',w.sort_order,'default_price',w.default_price,'pricing_unit',w.pricing_unit,'default_product_id',w.default_product_id,
'catalog_order',coalesce((select jsonb_object_agg(cw.catalog_id,coalesce(cw.sort_order,w.sort_order)) from stem_catalog.catalog_workshops cw join stem_catalog.catalogs c on c.id=cw.catalog_id where cw.workshop_id=w.id and cw.approved and c.status='published'),'{}'::jsonb),'catalogs',coalesce((select jsonb_agg(cw.catalog_id) from stem_catalog.catalog_workshops cw join stem_catalog.catalogs c on c.id=cw.catalog_id where cw.workshop_id=w.id and cw.approved and c.status='published'),'[]'::jsonb),
'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'age_group',v.age_group,'duration_minutes',v.duration_minutes,'summary',v.summary,'lesson',v.lesson,'activity',v.activity,'concepts',v.concepts,'product_description',v.product_description,'skills',v.skills,'models',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'model_name',p.model_name,'description',p.description,'price',p.price,'pricing_unit',p.pricing_unit,'is_default',vp.is_default,'activity_override',vp.activity_override,'learning_override',vp.learning_override,'product_override',vp.product_override,
'images',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'filename',i.filename,'storage_path',i.storage_path,'stage',i.stage,'title',i.title,'is_primary',i.is_primary,'sort_order',i.sort_order) order by i.sort_order) from stem_catalog.product_images i where i.product_id=p.id and i.approved and i.storage_path is not null),'[]'::jsonb)) order by vp.is_default desc,p.sort_order) from stem_catalog.variant_products vp join stem_catalog.products p on p.id=vp.product_id where vp.variant_id=v.id and vp.approved and p.status='published' and p.availability='available' and p.age_label in (v.age_group,'א׳–ו׳')),'[]'::jsonb)) order by v.age_group) from stem_catalog.workshop_variants v where v.workshop_id=w.id and v.status='published' and exists(select 1 from stem_catalog.variant_products vp join stem_catalog.products p on p.id=vp.product_id where vp.variant_id=v.id and vp.approved and p.status='published' and p.availability='available' and p.age_label in (v.age_group,'א׳–ו׳'))),'[]'::jsonb),
'cover', (select jsonb_build_object('storage_path',i.storage_path,'title',i.title) from stem_catalog.product_images i where i.workshop_id=w.id and i.product_id is null and i.approved and i.storage_path is not null order by i.sort_order limit 1)) order by w.sort_order) from stem_catalog.workshops w where w.status='published' and exists(select 1 from stem_catalog.workshop_variants v where v.workshop_id=w.id and v.status='published' and exists(select 1 from stem_catalog.variant_products vp join stem_catalog.products p on p.id=vp.product_id where vp.variant_id=v.id and vp.approved and p.status='published' and p.availability='available' and p.age_label in (v.age_group,'א׳–ו׳'))) and exists(select 1 from stem_catalog.catalog_workshops cw join stem_catalog.catalogs c on c.id=cw.catalog_id where cw.workshop_id=w.id and cw.approved and c.status='published')),'[]'::jsonb))
$$;
create or replace function public.stem_catalog_save(entity text, record jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
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
 if entity='variant_products' and coalesce((record->>'is_default')::boolean,false) then
  update stem_catalog.variant_products set is_default=false where variant_id=record->>'variant_id' and product_id<>record->>'product_id' and is_default;
 end if;
 if entity='product_images' and coalesce((record->>'is_primary')::boolean,false) then
  if record->>'product_id' is null then update stem_catalog.product_images set is_primary=false where workshop_id=record->>'workshop_id' and product_id is null and id<>record->>'id' and is_primary;
  else update stem_catalog.product_images set is_primary=false where product_id=record->>'product_id' and id<>record->>'id' and is_primary; end if;
 end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position),string_agg(format('%I=excluded.%I',column_name,column_name),',' order by ordinal_position) filter(where not(column_name=any(string_to_array(keys,',')))) into tablecols,updates from information_schema.columns where table_schema='stem_catalog' and table_name=entity;
 if tablecols is null or updates is null then raise exception 'Unknown columns'; end if;
 execute format('insert into stem_catalog.%I (%s) select %s from jsonb_populate_record(null::stem_catalog.%I,$1) on conflict (%s) do update set %s',entity,tablecols,tablecols,entity,keys,updates) using record;
 return jsonb_build_object('saved',true);
end $$;
