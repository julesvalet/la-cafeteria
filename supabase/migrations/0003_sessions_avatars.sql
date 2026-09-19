-- ===========================================================================
-- La Cafétéria — sessions publiques, « où joue mon ami », photos de profil
--
-- Suite de 0002, mêmes principes : lecture filtrée, écriture par RPC.
--
-- Les parties restent P2P : la base ne voit jamais un coup joué. Elle tient
-- seulement un annuaire — quelles tables sont ouvertes, à quel jeu, combien
-- de places — que l'hôte met à jour tant que sa table vit. Une ligne qui n'est
-- plus rafraîchie depuis 90 secondes est une table fermée (onglet coupé,
-- réseau perdu) : on ne compte pas sur un « au revoir » que le navigateur
-- n'envoie pas toujours.
--
-- Idempotent : le rejouer sur une base à jour ne change rien.
-- ===========================================================================

-- --- Tables ouvertes ---------------------------------------------------------
-- Une ligne par table *publique*. Une table privée n'est jamais écrite ici :
-- ce qui n'est pas en base ne peut pas fuiter par une policy mal réglée.
create table if not exists public.game_rooms (
  game_type       text        not null references public.game_types (id),
  room_code       text        not null check (room_code ~ '^[A-Z0-9]{3,12}$'),
  host_id         uuid        not null references public.profiles (id) on delete cascade,
  status          text        not null default 'waiting' check (status in ('waiting', 'playing')),
  player_count    int         not null default 1 check (player_count between 0 and 8),
  max_players     int         not null default 2 check (max_players between 1 and 8),
  spectator_count int         not null default 0 check (spectator_count between 0 and 16),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (game_type, room_code)
);

create index if not exists game_rooms_host_idx on public.game_rooms (host_id);

-- Où se trouve chaque joueur connecté, hôte ou invité. C'est ce qui allume le
-- bouton « Rejoindre » à côté d'un ami : l'ami n'est pas forcément l'hôte.
create table if not exists public.player_rooms (
  user_id    uuid        primary key references public.profiles (id) on delete cascade,
  game_type  text        not null references public.game_types (id),
  room_code  text        not null check (room_code ~ '^[A-Z0-9]{3,12}$'),
  role       text        not null default 'player' check (role in ('player', 'spectator')),
  updated_at timestamptz not null default now()
);

-- Aucune policy : ni lecture ni écriture directes. Tout passe par les
-- fonctions ci-dessous, qui décident qui voit quoi (les amis, et seulement
-- pour les tables publiques).
alter table public.game_rooms   enable row level security;
alter table public.player_rooms enable row level security;

-- Fraîcheur d'une ligne d'annuaire. Un battement toutes les 30 s côté client :
-- trois battements manqués, la table est considérée fermée.
create or replace function public._room_fresh(p_at timestamptz)
returns boolean
language sql
stable
as $$ select p_at > now() - interval '90 seconds' $$;

-- L'hôte annonce (ou met à jour) sa table. Une table privée retire sa ligne,
-- au cas où l'hôte aurait changé d'avis.
create or replace function public.publish_room(
  p_game_type    text,
  p_room_code    text,
  p_is_public    boolean,
  p_status       text,
  p_player_count int,
  p_max_players  int,
  p_spectators   int default 0
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := public._require_uid();
  v_code text := upper(btrim(coalesce(p_room_code, '')));
  v_row  public.game_rooms%rowtype;
begin
  if not exists (select 1 from public.game_types where id = p_game_type) then
    raise exception 'Jeu inconnu : %', p_game_type using errcode = '22023';
  end if;
  if v_code !~ '^[A-Z0-9]{3,12}$' then
    raise exception 'Code de room invalide.' using errcode = '22023';
  end if;

  -- Ménage des tables abandonnées : l'annuaire ne grossit pas indéfiniment.
  delete from public.game_rooms   where updated_at < now() - interval '10 minutes';
  delete from public.player_rooms where updated_at < now() - interval '10 minutes';

  select * into v_row from public.game_rooms where game_type = p_game_type and room_code = v_code for update;

  -- Un code déjà annoncé par quelqu'un d'autre, et encore vivant : on ne
  -- s'approprie pas la table d'un autre.
  if found and v_row.host_id <> v_uid and public._room_fresh(v_row.updated_at) then
    raise exception 'Cette table appartient à un autre hôte.' using errcode = '42501';
  end if;

  if not coalesce(p_is_public, false) then
    delete from public.game_rooms where game_type = p_game_type and room_code = v_code;
  else
    insert into public.game_rooms as g
      (game_type, room_code, host_id, status, player_count, max_players, spectator_count, updated_at)
    values (
      p_game_type, v_code, v_uid,
      case when p_status = 'playing' then 'playing' else 'waiting' end,
      least(greatest(coalesce(p_player_count, 1), 0), 8),
      least(greatest(coalesce(p_max_players, 2), 1), 8),
      least(greatest(coalesce(p_spectators, 0), 0), 16),
      now()
    )
    on conflict (game_type, room_code) do update
      set host_id         = excluded.host_id,
          status          = excluded.status,
          player_count    = excluded.player_count,
          max_players     = excluded.max_players,
          spectator_count = excluded.spectator_count,
          -- Une table reprise après expiration repart d'une date neuve.
          created_at      = case when g.host_id = excluded.host_id then g.created_at else now() end,
          updated_at      = now();
  end if;

  insert into public.player_rooms (user_id, game_type, room_code, role, updated_at)
  values (v_uid, p_game_type, v_code, 'player', now())
  on conflict (user_id) do update
    set game_type = excluded.game_type, room_code = excluded.room_code,
        role = excluded.role, updated_at = now();
end;
$$;

-- Un invité (ou un observateur) signale où il se trouve.
create or replace function public.set_current_room(p_game_type text, p_room_code text, p_role text default 'player')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := public._require_uid();
  v_code text := upper(btrim(coalesce(p_room_code, '')));
begin
  if not exists (select 1 from public.game_types where id = p_game_type) then
    raise exception 'Jeu inconnu : %', p_game_type using errcode = '22023';
  end if;
  if v_code !~ '^[A-Z0-9]{3,12}$' then
    raise exception 'Code de room invalide.' using errcode = '22023';
  end if;

  insert into public.player_rooms (user_id, game_type, room_code, role, updated_at)
  values (v_uid, p_game_type, v_code, case when p_role = 'spectator' then 'spectator' else 'player' end, now())
  on conflict (user_id) do update
    set game_type = excluded.game_type, room_code = excluded.room_code,
        role = excluded.role, updated_at = now();
end;
$$;

-- Quitter une table : on n'y est plus, et si on l'hébergeait, elle ferme.
create or replace function public.leave_current_room()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
begin
  delete from public.player_rooms where user_id = v_uid;
  delete from public.game_rooms   where host_id = v_uid;
end;
$$;

-- Les tables publiques qui concernent le joueur : celles qu'un ami héberge, et
-- celles où un ami est assis ou regarde. `friends_inside` dit qui, pour que la
-- liste et le panneau d'amis puissent écrire « Bob et Carol y sont ».
create or replace function public.list_friend_sessions()
returns table (
  game_type       text,
  room_code       text,
  host_id         uuid,
  host_username   text,
  host_avatar     text,
  status          text,
  player_count    int,
  max_players     int,
  spectator_count int,
  created_at      timestamptz,
  is_mine         boolean,
  friends_inside  jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as uid),
  friends as (
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as fid
    from public.friendships f, me
    where f.status = 'accepted' and me.uid in (f.requester_id, f.addressee_id)
  ),
  rooms as (
    select g.* from public.game_rooms g
    where public._room_fresh(g.updated_at)
  )
  select
    r.game_type,
    r.room_code,
    r.host_id,
    hp.username,
    hp.avatar,
    r.status,
    r.player_count,
    r.max_players,
    r.spectator_count,
    r.created_at,
    r.host_id = (select uid from me),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.id, 'username', p.username, 'avatar', p.avatar, 'role', pr.role)
             order by p.username)
      from public.player_rooms pr
      join friends fr on fr.fid = pr.user_id
      join public.profiles p on p.id = pr.user_id
      where pr.game_type = r.game_type and pr.room_code = r.room_code
        and public._room_fresh(pr.updated_at)
    ), '[]'::jsonb)
  from rooms r
  join public.profiles hp on hp.id = r.host_id
  where r.host_id = (select uid from me)
     or r.host_id in (select fid from friends)
     or exists (
       select 1 from public.player_rooms pr
       join friends fr on fr.fid = pr.user_id
       where pr.game_type = r.game_type and pr.room_code = r.room_code
         and public._room_fresh(pr.updated_at)
     )
  order by (r.status = 'waiting') desc, r.updated_at desc;
$$;

revoke all on function public._room_fresh(timestamptz) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.publish_room(text, text, boolean, text, int, int, int)',
    'public.set_current_room(text, text, text)',
    'public.leave_current_room()',
    'public.list_friend_sessions()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- ===========================================================================
-- Photos de profil
-- ===========================================================================
-- Bucket public : une photo de profil s'affiche dans les classements, qui se
-- consultent sans compte. Chaque joueur n'écrit que sous `users/<son id>/`.
--
-- Le client recadre et réencode l'image avant l'envoi (512 × 512, WebP) :
-- le fichier stocké pèse quelques dizaines de kilo-octets, loin du plafond de
-- 2 Mo posé ici par sécurité. La limite de 5 Mo du cahier des charges porte
-- sur le fichier choisi, et se vérifie avant le recadrage.
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
  on conflict (id) do update
    set public             = true,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Le dépôt avec écrasement (upsert) demande les trois droits : lire pour
  -- savoir si le fichier existe, insérer, mettre à jour.
  execute 'drop policy if exists avatars_select_own on storage.objects';
  execute $p$create policy avatars_select_own on storage.objects
    for select to authenticated
    using (bucket_id = 'avatars' and name like 'users/' || (select auth.uid())::text || '/%')$p$;

  execute 'drop policy if exists avatars_insert_own on storage.objects';
  execute $p$create policy avatars_insert_own on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and name like 'users/' || (select auth.uid())::text || '/%')$p$;

  execute 'drop policy if exists avatars_update_own on storage.objects';
  execute $p$create policy avatars_update_own on storage.objects
    for update to authenticated
    using (bucket_id = 'avatars' and name like 'users/' || (select auth.uid())::text || '/%')
    with check (bucket_id = 'avatars' and name like 'users/' || (select auth.uid())::text || '/%')$p$;

  execute 'drop policy if exists avatars_delete_own on storage.objects';
  execute $p$create policy avatars_delete_own on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatars' and name like 'users/' || (select auth.uid())::text || '/%')$p$;
end;
$$;

-- Un profil n'affiche qu'une image de son propre dossier. Sans cette règle, la
-- policy « je modifie mon profil » laisserait pointer `avatar` vers n'importe
-- quelle URL du web — un pixel de suivi affiché à chaque visiteur des
-- classements, ou pire. NOT VALID : les lignes existantes ne sont pas
-- revérifiées, seules les écritures à venir le sont.
alter table public.profiles drop constraint if exists profiles_avatar_own_storage;
alter table public.profiles add constraint profiles_avatar_own_storage check (
  avatar is null
  or (
    avatar ~ '^https://'
    and strpos(avatar, '/storage/v1/object/public/avatars/users/' || id::text || '/') > 0
  )
) not valid;
