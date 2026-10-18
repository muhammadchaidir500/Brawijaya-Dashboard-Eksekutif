-- Permintaan "Lupa password" dari halaman login (sudah diterapkan ke Supabase)
create table public.password_requests(
  id bigint generated always as identity primary key,
  username text not null check (char_length(username) between 1 and 64),
  kontak text not null default '' check (char_length(kontak) <= 120),
  catatan text not null default '' check (char_length(catatan) <= 300),
  status text not null default 'baru' check (status in ('baru','selesai')),
  created_at timestamptz not null default now()
);
alter table public.password_requests enable row level security;
create policy pr_ins on public.password_requests for insert to anon, authenticated with check (status='baru');
create policy pr_sel on public.password_requests for select to authenticated using ((select private.pb_is_sa()));
create policy pr_upd on public.password_requests for update to authenticated using ((select private.pb_is_sa())) with check ((select private.pb_is_sa()));
create policy pr_del on public.password_requests for delete to authenticated using ((select private.pb_is_sa()));
grant insert on public.password_requests to anon;
grant select, insert, update, delete on public.password_requests to authenticated;
