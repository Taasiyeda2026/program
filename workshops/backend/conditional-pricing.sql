-- Existing catalog upgrade; safe after the initial schema has been installed.
alter table stem_catalog.workshops add column if not exists included_students integer, add column if not exists additional_student_price numeric(12,2);
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='stem_catalog.workshops'::regclass and conname='workshops_conditional_price_valid') then
 alter table stem_catalog.workshops add constraint workshops_conditional_price_valid check (
    (included_students is null and additional_student_price is null)
    or (included_students is not null and included_students > 0
      and additional_student_price is not null and additional_student_price >= 0
      and default_price is not null and pricing_unit is not null
      and pricing_unit in ('סדנה','לסדנה','כיתה','לכיתה','קבוצה','לקבוצה'))
  );
 end if;
end $$;
CREATE OR REPLACE FUNCTION public.stem_catalog_public()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
select jsonb_build_object(
'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'description',description,'sort_order',sort_order) order by sort_order) from stem_catalog.categories),'[]'::jsonb),
'workshops',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'subtitle',w.subtitle,'summary',w.summary,'category_id',w.category_id,'duration_minutes',w.duration_minutes,'age_label',w.age_label,'sort_order',w.sort_order,'default_price',w.default_price,'pricing_unit',w.pricing_unit,'included_students',w.included_students,'additional_student_price',w.additional_student_price,'default_product_id',w.default_product_id,
'catalog_order',coalesce((select jsonb_object_agg(cw.catalog_id,coalesce(cw.sort_order,w.sort_order)) from stem_catalog.catalog_workshops cw join stem_catalog.catalogs c on c.id=cw.catalog_id where cw.workshop_id=w.id and cw.approved and c.status='published'),'{}'::jsonb),'catalogs',coalesce((select jsonb_agg(cw.catalog_id) from stem_catalog.catalog_workshops cw join stem_catalog.catalogs c on c.id=cw.catalog_id where cw.workshop_id=w.id and cw.approved and c.status='published'),'[]'::jsonb),
'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'age_group',v.age_group,'duration_minutes',v.duration_minutes,'summary',v.summary,'lesson',v.lesson,'activity',v.activity,'concepts',v.concepts,'product_description',v.product_description,'skills',v.skills,'models',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'model_name',p.model_name,'description',p.description,'price',p.price,'pricing_unit',p.pricing_unit,'is_default',vp.is_default,'activity_override',vp.activity_override,'learning_override',vp.learning_override,'product_override',vp.product_override,
'images',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'filename',i.filename,'storage_path',i.storage_path,'stage',i.stage,'title',i.title,'is_primary',i.is_primary,'sort_order',i.sort_order) order by i.sort_order) from stem_catalog.product_images i where i.product_id=p.id and i.approved and i.storage_path is not null),'[]'::jsonb)) order by vp.is_default desc,p.sort_order) from stem_catalog.variant_products vp join stem_catalog.products p on p.id=vp.product_id where vp.variant_id=v.id and vp.approved and p.status='published' and p.availability='available' and p.age_label in (v.age_group,'א׳–ו׳')),'[]'::jsonb)) order by v.age_group) from stem_catalog.workshop_variants v where v.workshop_id=w.id and v.status='published' and exists(select 1 from stem_catalog.variant_products vp join stem_catalog.products p on p.id=vp.product_id where vp.variant_id=v.id and vp.approved and p.status='published' and p.availability='available' and p.age_label in (v.age_group,'א׳–ו׳'))),'[]'::jsonb),
'cover', (select jsonb_build_object('storage_path',i.storage_path,'title',i.title) from stem_catalog.product_images i where i.workshop_id=w.id and i.product_id is null and i.approved and i.storage_path is not null order by i.sort_order limit 1)) order by w.sort_order) from stem_catalog.workshops w where w.status='published' and exists(select 1 from stem_catalog.workshop_variants v where v.workshop_id=w.id and v.status='published' and exists(select 1 from stem_catalog.variant_products vp join stem_catalog.products p on p.id=vp.product_id where vp.variant_id=v.id and vp.approved and p.status='published' and p.availability='available' and p.age_label in (v.age_group,'א׳–ו׳'))) and exists(select 1 from stem_catalog.catalog_workshops cw join stem_catalog.catalogs c on c.id=cw.catalog_id where cw.workshop_id=w.id and cw.approved and c.status='published')),'[]'::jsonb))
$function$;
