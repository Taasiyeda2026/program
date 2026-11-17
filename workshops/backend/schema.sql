-- Isolated STEM catalog schema. Run only in the selected catalog database.
-- Initial import stays private. Public access is granted only via approved projections.
begin;
create schema if not exists stem_catalog;
revoke all on schema stem_catalog from public, anon, authenticated;
create table stem_catalog.categories (
 id text primary key, name text not null, color text, icon text, description text, sort_order integer
);
create table stem_catalog.workshops (
 id text primary key, image_base text unique not null check(image_base ~ '^[0-9]+$'),
 title text not null, subtitle text, summary text, category_id text not null references stem_catalog.categories(id),
 duration_minutes integer check(duration_minutes>0), age_label text, sort_order integer,
 default_price numeric(12,2) check(default_price>=0), pricing_unit text,
 included_students integer, additional_student_price numeric(12,2),
 default_product_id text, status text not null default 'draft' check(status in ('draft','published','archived')),
 constraint workshops_conditional_price_valid check (
    (included_students is null and additional_student_price is null)
    or (included_students is not null and included_students > 0
      and additional_student_price is not null and additional_student_price >= 0
      and default_price is not null and pricing_unit is not null
      and pricing_unit in ('סדנה','לסדנה','כיתה','לכיתה','קבוצה','לקבוצה'))
  )
);
create table stem_catalog.products (
 id text primary key, workshop_id text not null references stem_catalog.workshops(id),
 image_group text not null, model_id text unique not null, name text not null, model_name text,
 description text, age_label text, complexity text, sort_order integer,
 price numeric(12,2) check(price>=0), pricing_unit text,
 availability text not null default 'pending' check(availability in ('pending','available','unavailable')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 unique(id,workshop_id), check(model_id ~ '^[0-9]+(-[0-9]+)?$')
);
alter table stem_catalog.workshops add constraint default_product_same_workshop foreign key(default_product_id,id) references stem_catalog.products(id,workshop_id) deferrable initially deferred;
create table stem_catalog.workshop_variants (
 id text primary key, workshop_id text not null references stem_catalog.workshops(id),
 age_group text not null check(age_group in ('א׳–ג׳','ד׳–ו׳')),
 duration_minutes integer check(duration_minutes>0), summary text, lesson text, activity text, concepts text, product_description text, skills text,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 unique(workshop_id,age_group),unique(id,workshop_id)
);
create table stem_catalog.variant_products (
 variant_id text not null, product_id text not null, workshop_id text not null,
 is_default boolean not null default false, approved boolean not null default false, activity_override text, learning_override text, product_override text,
 primary key(variant_id,product_id), foreign key(variant_id,workshop_id) references stem_catalog.workshop_variants(id,workshop_id),
 foreign key(product_id,workshop_id) references stem_catalog.products(id,workshop_id)
);
create unique index one_default_per_variant on stem_catalog.variant_products(variant_id) where is_default;
create table stem_catalog.product_images (
 id text primary key, workshop_id text not null references stem_catalog.workshops(id),
 product_id text, image_group text not null, filename text unique not null,
 stage text not null check(stage in ('cover','raw','intermediate','finished','demo','additional')),
 purpose text not null, title text, description text, sort_order integer,
 is_primary boolean not null default false, canva_page text, previous_filename text,
 source_status text, storage_path text, approved boolean not null default false,
 foreign key(product_id,workshop_id) references stem_catalog.products(id,workshop_id),
 check(product_id is not null or stage='cover'), check(not approved or storage_path is not null)
);
create unique index one_primary_per_model on stem_catalog.product_images(product_id) where is_primary and product_id is not null;
create table stem_catalog.internal_product_costs (
 product_id text primary key references stem_catalog.products(id), internal_cost numeric(12,2) check(internal_cost>=0), notes text
);
create table stem_catalog.import_notes (
 entity_type text not null, entity_id text not null, source_status text, note text, source_row jsonb not null,
 primary key(entity_type,entity_id)
);
create table stem_catalog.catalogs (
 id text primary key, name text not null, status text not null default 'draft' check(status in ('draft','published','archived'))
);
create table stem_catalog.catalog_workshops (
 catalog_id text references stem_catalog.catalogs(id), workshop_id text references stem_catalog.workshops(id),
 sort_order integer, approved boolean not null default false, primary key(catalog_id,workshop_id)
);
-- Explicit default-deny: all tables protected; no anonymous or normal employee policies.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='stem_catalog' loop
 execute format('alter table stem_catalog.%I enable row level security',t.tablename);
 end loop;
end $$;
revoke all on all tables in schema stem_catalog from public, anon, authenticated;
-- Server-side trusted service may use these tables. Never place service credentials in a browser.
grant usage on schema stem_catalog to service_role;
grant select,insert,update,delete on all tables in schema stem_catalog to service_role;
commit;
