create schema if not exists vpm_private;
revoke all on schema vpm_private from public, anon, authenticated;
create table vpm_private.app_data_snapshots (
 snapshot_id bigint generated always as identity primary key,
 captured_at timestamptz not null default now(),
 reason text not null,
 payload jsonb not null
);
alter table vpm_private.app_data_snapshots enable row level security;
revoke all on vpm_private.app_data_snapshots from public, anon, authenticated;
insert into vpm_private.app_data_snapshots(reason,payload)
select 'Before integrity and least-privilege maintenance 2026-11-03',to_jsonb(a) from public.app_data a;
alter table public.app_data add constraint app_data_document_shapes check (
 properties is not null and jsonb_typeof(properties)='array'
 and clienti is not null and jsonb_typeof(clienti)='array'
 and operatori is not null and jsonb_typeof(operatori)='array'
 and settings is not null and jsonb_typeof(settings)='object'
);
revoke insert, delete, truncate, references, trigger, update on public.app_data from anon, authenticated;
grant update(properties,clienti,operatori,settings,updated_at) on public.app_data to anon, authenticated;
drop policy "accesso pubblico insert" on public.app_data;
alter policy "accesso pubblico select" on public.app_data using (id='main');
alter policy "accesso pubblico update" on public.app_data using (id='main') with check (id='main');
comment on table vpm_private.app_data_snapshots is 'Private maintenance restore points. Not an external disaster-recovery backup. Never expose through Data API.';
comment on constraint app_data_document_shapes on public.app_data is 'Preserve the JSON document types required by the existing Vivere PM client.';
