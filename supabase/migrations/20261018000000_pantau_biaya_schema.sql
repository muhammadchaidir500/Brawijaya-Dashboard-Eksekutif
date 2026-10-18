-- Brawijaya Dashboard Eksekutif (Pantau Biaya) – skema database Supabase
-- Status: sudah diterapkan ke proyek Supabase "pantau-biaya-korporat" (ref acwausnccjmlyfdmmgfo).
-- File ini adalah gabungan migrasi yang sudah berjalan, disimpan sebagai dokumentasi & cadangan.

create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  nama text not null default '',
  role text not null check (role in ('superadmin','rs','rs_view')),
  hospital_id text,
  aktif boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now()
);
create table public.hospitals(id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now());
create table public.master_types(id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now());
create table public.master_rows(id text primary key, type text not null, hospital_id text, data jsonb not null default '{}', updated_at timestamptz not null default now());
create index master_rows_type_idx on public.master_rows(type);
create index master_rows_hosp_idx on public.master_rows(hospital_id);
create table public.patients(id text primary key, hospital_id text not null, data jsonb not null default '{}', updated_at timestamptz not null default now());
create index patients_hosp_idx on public.patients(hospital_id);
create table public.settings(id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now());
create table public.audit_log(id bigint generated always as identity primary key, t timestamptz not null default now(), user_id uuid default auth.uid(), username text, action text not null, detail text);

-- Fungsi pembantu di skema privat (tidak terekspos lewat API)
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create or replace function private.pb_role() returns text language sql stable security definer set search_path='' as
$$ select role from public.profiles where id = (select auth.uid()) and aktif $$;
create or replace function private.pb_hosp() returns text language sql stable security definer set search_path='' as
$$ select hospital_id from public.profiles where id = (select auth.uid()) and aktif $$;
create or replace function private.pb_is_sa() returns boolean language sql stable security definer set search_path='' as
$$ select coalesce((select role='superadmin' from public.profiles where id=(select auth.uid()) and aktif),false) $$;
revoke all on function private.pb_role(), private.pb_hosp(), private.pb_is_sa() from public, anon;
grant execute on function private.pb_role(), private.pb_hosp(), private.pb_is_sa() to authenticated;

-- Publik: apakah Superadmin pertama sudah dibuat (untuk halaman penyiapan awal)
create or replace function public.pb_is_initialized() returns boolean language sql stable security definer set search_path='' as
$$ select exists(select 1 from public.profiles where role='superadmin') $$;
revoke all on function public.pb_is_initialized() from public;
grant execute on function public.pb_is_initialized() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.hospitals enable row level security;
alter table public.master_types enable row level security;
alter table public.master_rows enable row level security;
alter table public.patients enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

-- profiles: baca diri sendiri / superadmin; pengguna hanya boleh ubah last_login miliknya.
-- Buat/ubah/hapus akun lewat Edge Function admin-users (service role).
create policy prof_sel on public.profiles for select to authenticated using (id=(select auth.uid()) or (select private.pb_is_sa()));
create policy prof_upd on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update(last_login) on public.profiles to authenticated;

create policy h_sel on public.hospitals for select to authenticated using ((select private.pb_is_sa()) or id=(select private.pb_hosp()));
create policy h_all on public.hospitals for all to authenticated using ((select private.pb_is_sa())) with check ((select private.pb_is_sa()));

create policy mt_sel on public.master_types for select to authenticated using ((select private.pb_role()) is not null);
create policy mt_all on public.master_types for all to authenticated using ((select private.pb_is_sa())) with check ((select private.pb_is_sa()));

create policy mr_sel on public.master_rows for select to authenticated using (
  (select private.pb_is_sa()) or ((select private.pb_role()) is not null and (hospital_id is null or hospital_id='ALL' or hospital_id=(select private.pb_hosp()))));
create policy mr_ins on public.master_rows for insert to authenticated with check ((select private.pb_is_sa()) or ((select private.pb_role())='rs' and hospital_id=(select private.pb_hosp())));
create policy mr_upd on public.master_rows for update to authenticated using ((select private.pb_is_sa()) or ((select private.pb_role())='rs' and hospital_id=(select private.pb_hosp()))) with check ((select private.pb_is_sa()) or ((select private.pb_role())='rs' and hospital_id=(select private.pb_hosp())));
create policy mr_del on public.master_rows for delete to authenticated using ((select private.pb_is_sa()) or ((select private.pb_role())='rs' and hospital_id=(select private.pb_hosp())));

create policy p_sel on public.patients for select to authenticated using ((select private.pb_is_sa()) or hospital_id=(select private.pb_hosp()));
create policy p_ins on public.patients for insert to authenticated with check ((select private.pb_is_sa()) or ((select private.pb_role())='rs' and hospital_id=(select private.pb_hosp())));
create policy p_upd on public.patients for update to authenticated using ((select private.pb_is_sa()) or ((select private.pb_role())='rs' and hospital_id=(select private.pb_hosp()))) with check ((select private.pb_is_sa()) or ((select private.pb_role())='rs' and hospital_id=(select private.pb_hosp())));
create policy p_del on public.patients for delete to authenticated using ((select private.pb_is_sa()) or ((select private.pb_role())='rs' and hospital_id=(select private.pb_hosp())));

-- settings: baris 'branding' (nama & logo) publik untuk halaman login; 'simrs' khusus superadmin
create policy s_sel_anon on public.settings for select to anon using (id='branding');
create policy s_sel_pub on public.settings for select to authenticated using (id='branding' or (select private.pb_is_sa()));
create policy s_all on public.settings for all to authenticated using ((select private.pb_is_sa())) with check ((select private.pb_is_sa()));

create policy a_ins on public.audit_log for insert to authenticated with check ((select private.pb_role()) is not null and user_id=(select auth.uid()));
create policy a_sel on public.audit_log for select to authenticated using ((select private.pb_is_sa()));
create policy a_del on public.audit_log for delete to authenticated using ((select private.pb_is_sa()));

revoke all on all tables in schema public from anon;
grant select on public.settings to anon;
