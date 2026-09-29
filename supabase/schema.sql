-- VESTRA — esquema do Supabase (Passo 5: login, banco e imagens)
--
-- Rode este arquivo inteiro uma vez no SQL Editor do projeto Supabase.
-- Ele pode ser rodado de novo sem apagar dados.
--
-- Regras principais:
-- - Cada pessoa só lê e grava os próprios dados e as próprias imagens (RLS).
-- - Papel (role), plano, créditos e início do teste só mudam pelo servidor
--   (chave service_role usada nas funções /api), nunca pelo navegador.

-- ---------------------------------------------------------------------------
-- PERFIS
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null default '',
  role text not null default 'user' check (role in ('user', 'owner')),
  trial_started_at timestamptz not null default now(),
  plan text not null default 'free',
  plan_status text not null default 'ativo',
  credits integer not null default 3,
  -- Preferências editáveis pela própria pessoa: medidas, memória de estilo,
  -- endereços, favoritos, histórico de gerações, foto de perfil etc.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: ler o próprio" on public.profiles;
create policy "profiles: ler o próprio" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles: editar o próprio" on public.profiles;
create policy "profiles: editar o próprio" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- O navegador só pode alterar nome e preferências.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, data) on public.profiles to authenticated;

-- Cria o perfil automaticamente no cadastro (e-mail/senha ou Google).
-- trial_started_at = momento do cadastro (base do teste grátis de 3 dias).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''), 100)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- CLOSET
-- ---------------------------------------------------------------------------
create table if not exists public.closet_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) <= 64),
  name text not null default '' check (char_length(name) <= 120),
  category text not null default '' check (char_length(category) <= 40),
  color text not null default '' check (char_length(color) <= 40),
  size text not null default '' check (char_length(size) <= 20),
  fav boolean not null default false,
  image_path text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.closet_items enable row level security;

drop policy if exists "closet: acesso ao próprio" on public.closet_items;
create policy "closet: acesso ao próprio" on public.closet_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.closet_items to authenticated;

-- ---------------------------------------------------------------------------
-- LOOKS
-- ---------------------------------------------------------------------------
create table if not exists public.looks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) <= 64),
  pieces text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.looks enable row level security;

drop policy if exists "looks: acesso ao próprio" on public.looks;
create policy "looks: acesso ao próprio" on public.looks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.looks to authenticated;

-- ---------------------------------------------------------------------------
-- IMAGENS (bucket privado "vestra")
-- Cada pessoa só usa a pasta com o próprio id: <user_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vestra', 'vestra', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vestra: ler próprias imagens" on storage.objects;
create policy "vestra: ler próprias imagens" on storage.objects
  for select to authenticated
  using (bucket_id = 'vestra' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "vestra: enviar próprias imagens" on storage.objects;
create policy "vestra: enviar próprias imagens" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vestra' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "vestra: substituir próprias imagens" on storage.objects;
create policy "vestra: substituir próprias imagens" on storage.objects
  for update to authenticated
  using (bucket_id = 'vestra' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'vestra' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "vestra: apagar próprias imagens" on storage.objects;
create policy "vestra: apagar próprias imagens" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vestra' and (storage.foldername(name))[1] = auth.uid()::text);
