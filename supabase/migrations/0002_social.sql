-- ===========================================================================
-- La Cafétéria — amis, groupes, discussions, notifications, présence
--
-- Suite de 0001. Même règle du jeu : pas de serveur applicatif, donc la base
-- porte tout ce qui doit être garanti.
--
--   * Lecture : la RLS. Chaque table ne montre que ce qui concerne le joueur
--     connecté (ses amitiés, les groupes dont il est membre, ses notifications).
--   * Écriture : exclusivement des fonctions SECURITY DEFINER. Aucune table de
--     ce fichier n'a de policy INSERT/UPDATE/DELETE : une règle comme « seul un
--     admin peut retirer un membre » ou « on ne peut pas écrire à quelqu'un qui
--     nous a bloqué » s'exprime bien mieux en PL/pgSQL qu'en policies croisées.
--   * Temps réel : Supabase Realtime. Les notifications et les messages de
--     groupe sont publiés (postgres_changes, filtrés par la RLS) ; l'indicateur
--     de frappe et le statut en ligne passent par des canaux privés
--     (broadcast / presence) autorisés plus bas sur realtime.messages.
--
-- Ce que le cahier des charges décrivait comme des événements Socket.io
-- (« friend_request_accepted », « group_deleted »…) devient ici une ligne de
-- `notifications` : le destinataire la reçoit en direct s'il est connecté, et
-- la retrouve dans sa cloche s'il ne l'était pas — ce qu'un événement Socket.io
-- émis dans le vide n'aurait pas permis.
--
-- Idempotent, comme 0001 : le rejouer sur une base à jour ne change rien.
-- ===========================================================================

-- --- Présence ---------------------------------------------------------------
-- « Vu pour la dernière fois ». Table à part plutôt que colonne de profiles :
-- les profils sont lisibles sans être connecté (classements publics), et
-- l'heure de passage de quelqu'un n'a pas à l'être.
create table if not exists public.last_seen (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);

-- --- Amitiés ----------------------------------------------------------------
-- Une seule ligne par paire, qu'elle soit en attente ou acceptée. Le cahier
-- des charges tenait trois listes (friends, incoming, outgoing) par joueur :
-- autant de copies à garder cohérentes. Ici, accepter une demande est un
-- UPDATE sur une ligne, et il est impossible d'être « ami d'un seul côté ».
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid        not null references public.profiles (id) on delete cascade,
  addressee_id uuid        not null references public.profiles (id) on delete cascade,
  status       text        not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- La paire non ordonnée est unique : A→B et B→A sont la même relation.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

create table if not exists public.blocks (
  blocker_id uuid        not null references public.profiles (id) on delete cascade,
  blocked_id uuid        not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- --- Groupes ----------------------------------------------------------------
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  -- Privé : on n'entre que sur invitation d'un admin, le code ne suffit pas.
  is_private  boolean     not null default false,
  -- Alphabet sans 0/O ni 1/I : le code se lit à voix haute autour d'une table.
  invite_code text        not null unique,
  created_by  uuid        not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint groups_name_length        check (char_length(btrim(name)) between 3 and 50),
  constraint groups_description_length check (description is null or char_length(description) <= 500),
  constraint groups_invite_code_format check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$')
);

create table if not exists public.group_members (
  group_id  uuid        not null references public.groups (id)   on delete cascade,
  user_id   uuid        not null references public.profiles (id) on delete cascade,
  role      text        not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- Une invitation n'existe que tant qu'elle attend : l'accepter crée l'adhésion,
-- la refuser l'efface. Garder un historique « declined » n'apprendrait rien et
-- empêcherait de réinviter.
create table if not exists public.group_invitations (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups (id)   on delete cascade,
  invitee_id uuid        not null references public.profiles (id) on delete cascade,
  invited_by uuid                 references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, invitee_id)
);

create index if not exists group_invitations_invitee_idx on public.group_invitations (invitee_id);

-- Identifiant séquentiel plutôt qu'uuid : il donne l'ordre d'arrivée exact (deux
-- messages peuvent partager la même milliseconde) et sert de curseur pour
-- charger l'historique page par page sans décalage quand d'autres messages
-- arrivent entre-temps — ce qu'un skip/offset ne garantit pas.
create table if not exists public.group_messages (
  id         bigint generated always as identity primary key,
  group_id   uuid        not null references public.groups (id) on delete cascade,
  -- Nul pour les messages système, et pour ceux d'un compte supprimé.
  sender_id  uuid                 references public.profiles (id) on delete set null,
  kind       text        not null default 'text' check (kind in ('text', 'system')),
  content    text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Suppression « douce » : la ligne reste (la conversation garde sa forme, un
  -- « message supprimé » à sa place), mais le texte, lui, disparaît vraiment.
  constraint group_messages_content check (
    (deleted_at is null and content is not null and char_length(content) between 1 and 500)
    or (deleted_at is not null and content is null)
  )
);

create index if not exists group_messages_group_idx on public.group_messages (group_id, id desc);

-- --- Notifications ----------------------------------------------------------
-- La boîte de réception de chaque joueur, et le canal temps réel qui le
-- prévient. `silent` couvre les changements dont le client doit être informé
-- pour rafraîchir une liste, mais qu'il serait déplacé d'afficher — « X t'a
-- retiré de ses amis » par exemple.
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  kind       text        not null,
  actor_id   uuid                 references public.profiles (id) on delete set null,
  group_id   uuid                 references public.groups (id)   on delete set null,
  payload    jsonb       not null default '{}'::jsonb,
  silent     boolean     not null default false,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists notifications_user_idx on public.notifications (user_id, id desc);

-- ===========================================================================
-- Fonctions utilitaires
-- ===========================================================================

create or replace function public._require_uid()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Il faut être connecté.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Utilisées par les policies : elles doivent contourner la RLS de
-- group_members, sans quoi la policy de group_members s'interrogerait
-- elle-même à l'infini.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public._are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.friendships
    where least(requester_id, addressee_id) = least(p_a, p_b)
      and greatest(requester_id, addressee_id) = greatest(p_a, p_b)
      and status = 'accepted'
  );
$$;

-- Dans un sens ou dans l'autre : qui bloque ne veut plus rien recevoir, et
-- n'a pas à pouvoir relancer celui qu'il a bloqué non plus.
create or replace function public._is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

create or replace function public._notify(
  p_user_id  uuid,
  p_kind     text,
  p_actor_id uuid,
  p_group_id uuid    default null,
  p_payload  jsonb   default '{}'::jsonb,
  p_silent   boolean default false
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, kind, actor_id, group_id, payload, silent)
  values (p_user_id, p_kind, p_actor_id, p_group_id, coalesce(p_payload, '{}'::jsonb), p_silent);

  -- Ménage au fil de l'eau plutôt qu'une tâche planifiée : les signaux
  -- silencieux ne servent qu'à l'instant où ils partent, et une notification
  -- lue depuis deux mois n'intéresse plus personne.
  delete from public.notifications
  where user_id = p_user_id
    and ((silent and created_at < now() - interval '1 day')
      or (read_at is not null and read_at < now() - interval '60 days'));
end;
$$;

-- Huit caractères tirés d'un alphabet de 32 : un octet aléatoire modulo 32
-- ne biaise aucune lettre. gen_random_uuid() est la seule source aléatoire
-- cryptographique disponible sans extension ; ses 16 octets en fournissent
-- largement huit.
create or replace function public._new_invite_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes    bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_code     text  := '';
begin
  -- Les octets 6 et 8 d'un uuid v4 portent la version et la variante : on
  -- puise dans les octets 9 à 15, plus l'octet 0, qui sont tous aléatoires.
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, case when i = 0 then 0 else 8 + i end) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function public._group_system_message(p_group_id uuid, p_content text)
returns void
language sql
set search_path = public, pg_temp
as $$
  insert into public.group_messages (group_id, kind, content)
  values (p_group_id, 'system', left(p_content, 500));
$$;

create or replace function public._username(p_user_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select username from public.profiles where id = p_user_id;
$$;

-- touch_updated_at() vient de 0001.
drop trigger if exists groups_touch_updated_at on public.groups;
create trigger groups_touch_updated_at
  before update on public.groups
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Row Level Security — lecture seule, écriture par les fonctions ci-dessous
-- ===========================================================================
alter table public.last_seen         enable row level security;
alter table public.friendships       enable row level security;
alter table public.blocks            enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.group_invitations enable row level security;
alter table public.group_messages    enable row level security;
alter table public.notifications     enable row level security;

-- Visible des joueurs connectés, comme le canal de présence : cacher l'heure
-- de passage tout en diffusant le statut en ligne n'aurait pas de sens.
drop policy if exists last_seen_read on public.last_seen;
create policy last_seen_read on public.last_seen
  for select to authenticated using (true);

drop policy if exists friendships_read_own on public.friendships;
create policy friendships_read_own on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- On voit qui l'on a bloqué, jamais qui nous a bloqué.
drop policy if exists blocks_read_own on public.blocks;
create policy blocks_read_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists groups_read_member on public.groups;
create policy groups_read_member on public.groups
  for select to authenticated
  using (public.is_group_member(id));

drop policy if exists group_members_read_member on public.group_members;
create policy group_members_read_member on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists group_invitations_read on public.group_invitations;
create policy group_invitations_read on public.group_invitations
  for select to authenticated
  using (invitee_id = (select auth.uid()) or public.is_group_admin(group_id));

-- Aussi ce qui filtre le temps réel : Realtime n'envoie un nouveau message qu'aux
-- abonnés que cette policy laisse le lire. Un membre retiré cesse de recevoir
-- la conversation à l'instant où sa ligne de group_members disparaît.
drop policy if exists group_messages_read_member on public.group_messages;
create policy group_messages_read_member on public.group_messages
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- Présence
-- ===========================================================================
create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
begin
  insert into public.last_seen (user_id, seen_at) values (v_uid, now())
  on conflict (user_id) do update set seen_at = excluded.seen_at;
end;
$$;

-- ===========================================================================
-- Amis
-- ===========================================================================

-- Si la cible nous a déjà envoyé une demande, lui en renvoyer une revient à
-- accepter la sienne : deux demandes croisées ne doivent pas rester bloquées
-- chacune de son côté.
create or replace function public.send_friend_request(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := public._require_uid();
  v_target  public.profiles%rowtype;
  v_row     public.friendships%rowtype;
  v_pending int;
begin
  select * into v_target from public.profiles
  where lower(username) = lower(btrim(coalesce(p_username, '')));

  if not found then
    raise exception 'Aucun joueur ne porte ce pseudo.' using errcode = 'P0002';
  end if;
  if v_target.id = v_uid then
    raise exception 'Tu ne peux pas t''ajouter toi-même.' using errcode = '22023';
  end if;
  -- Même message que pour un pseudo introuvable ou presque : dire « ce joueur
  -- t'a bloqué » serait une information que le bloqueur n'a pas choisi de donner.
  if public._is_blocked_between(v_uid, v_target.id) then
    raise exception 'Impossible d''envoyer une demande à ce joueur.' using errcode = '42501';
  end if;

  select * into v_row from public.friendships
  where least(requester_id, addressee_id) = least(v_uid, v_target.id)
    and greatest(requester_id, addressee_id) = greatest(v_uid, v_target.id)
  for update;

  if found then
    if v_row.status = 'accepted' then
      raise exception 'Vous êtes déjà amis.' using errcode = '23505';
    end if;
    if v_row.requester_id = v_uid then
      raise exception 'Demande déjà envoyée.' using errcode = '23505';
    end if;

    update public.friendships
    set status = 'accepted', accepted_at = now()
    where id = v_row.id
    returning * into v_row;

    perform public._notify(v_target.id, 'friend_accepted', v_uid, null,
      jsonb_build_object('friendship_id', v_row.id));
    update public.notifications set read_at = now()
    where user_id = v_uid and read_at is null and kind = 'friend_request'
      and payload ->> 'friendship_id' = v_row.id::text;
  else
    -- Un plafond contre l'envoi en rafale à tout l'annuaire.
    select count(*) into v_pending from public.friendships
    where requester_id = v_uid and status = 'pending';
    if v_pending >= 50 then
      raise exception 'Trop de demandes en attente. Attends que quelques-unes reçoivent une réponse.'
        using errcode = '54000';
    end if;

    begin
      insert into public.friendships (requester_id, addressee_id)
      values (v_uid, v_target.id)
      returning * into v_row;
    exception when unique_violation then
      -- L'autre joueur a envoyé la sienne au même instant.
      raise exception 'Une demande vient de se croiser avec la tienne, recharge la page.'
        using errcode = '40001';
    end;

    perform public._notify(v_target.id, 'friend_request', v_uid, null,
      jsonb_build_object('friendship_id', v_row.id));
  end if;

  return jsonb_build_object(
    'id',           v_row.id,
    'status',       v_row.status,
    'user_id',      v_target.id,
    'username',     v_target.username,
    'avatar',       v_target.avatar,
    'created_at',   v_row.created_at
  );
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
  v_row public.friendships%rowtype;
  v_friend public.profiles%rowtype;
begin
  select * into v_row from public.friendships
  where id = p_request_id and status = 'pending' and addressee_id = v_uid
  for update;

  if not found then
    raise exception 'Cette demande n''existe plus.' using errcode = 'P0002';
  end if;

  -- La notification de la demande a reçu sa réponse : elle quitte la cloche.
  update public.notifications set read_at = now()
  where user_id = v_uid and read_at is null and kind = 'friend_request'
    and payload ->> 'friendship_id' = v_row.id::text;

  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now() where id = v_row.id;
    perform public._notify(v_row.requester_id, 'friend_accepted', v_uid, null,
      jsonb_build_object('friendship_id', v_row.id));
  else
    delete from public.friendships where id = v_row.id;
    -- Silencieux : le demandeur voit sa demande disparaître, sans message.
    perform public._notify(v_row.requester_id, 'friend_request_declined', v_uid, null, '{}'::jsonb, true);
  end if;

  select * into v_friend from public.profiles where id = v_row.requester_id;
  return jsonb_build_object(
    'accepted', p_accept,
    'user_id',  v_friend.id,
    'username', v_friend.username,
    'avatar',   v_friend.avatar
  );
end;
$$;

-- Retire l'ami, ou annule la demande, dans un sens comme dans l'autre : pour
-- le joueur, « ne plus être lié à cette personne » est une seule action.
create or replace function public.remove_friend(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
  v_deleted int;
begin
  delete from public.friendships
  where least(requester_id, addressee_id) = least(v_uid, p_user_id)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_user_id);
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    -- Une demande annulée ne doit pas continuer d'attendre dans la cloche de
    -- son destinataire.
    update public.notifications set read_at = now()
    where user_id = p_user_id and actor_id = v_uid and read_at is null
      and kind = 'friend_request';
    perform public._notify(p_user_id, 'friend_removed', v_uid, null, '{}'::jsonb, true);
  end if;
end;
$$;

create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
begin
  if p_user_id = v_uid then
    raise exception 'Tu ne peux pas te bloquer toi-même.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Joueur introuvable.' using errcode = 'P0002';
  end if;

  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user_id)
  on conflict do nothing;

  -- Rompre le lien et effacer ce qu'il avait laissé chez le bloqueur. Le
  -- bloqué, lui, n'est pas prévenu : il voit l'ami disparaître de sa liste,
  -- comme après un simple retrait.
  perform public.remove_friend(p_user_id);
  update public.notifications set read_at = now()
  where user_id = v_uid and actor_id = p_user_id and read_at is null;
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
begin
  delete from public.blocks where blocker_id = v_uid and blocked_id = p_user_id;
end;
$$;

-- Amis, demandes reçues et demandes envoyées, en une requête : la page Amis
-- affiche les trois, et un seul aller-retour évite qu'elles se désynchronisent
-- entre deux chargements.
create or replace function public.list_friendships()
returns table (
  friendship_id uuid,
  user_id       uuid,
  username      text,
  avatar        text,
  bio           text,
  status        text,
  direction     text,
  created_at    timestamptz,
  accepted_at   timestamptz,
  last_seen_at  timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    f.id,
    p.id,
    p.username,
    p.avatar,
    p.bio,
    f.status,
    case
      when f.status = 'accepted'    then 'friend'
      when f.addressee_id = auth.uid() then 'incoming'
      else 'outgoing'
    end,
    f.created_at,
    f.accepted_at,
    ls.seen_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  left join public.last_seen ls on ls.user_id = p.id
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by lower(p.username);
$$;

create or replace function public.list_blocked()
returns table (user_id uuid, username text, avatar text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.avatar, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- ===========================================================================
-- Groupes
-- ===========================================================================
create or replace function public.create_group(
  p_name        text,
  p_description text    default null,
  p_is_private  boolean default false
)
returns public.groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := public._require_uid();
  v_name  text := btrim(coalesce(p_name, ''));
  v_desc  text := nullif(btrim(coalesce(p_description, '')), '');
  v_group public.groups%rowtype;
begin
  if char_length(v_name) not between 3 and 50 then
    raise exception 'Le nom du groupe doit faire entre 3 et 50 caractères.' using errcode = '22023';
  end if;
  if v_desc is not null and char_length(v_desc) > 500 then
    raise exception 'La description est limitée à 500 caractères.' using errcode = '22023';
  end if;
  if (select count(*) from public.groups where created_by = v_uid) >= 25 then
    raise exception 'Tu as déjà créé 25 groupes : supprimes-en un pour en créer un autre.' using errcode = '54000';
  end if;

  -- 32^8 codes possibles : une collision est improbable, mais pas impossible.
  for attempt in 1..5 loop
    begin
      insert into public.groups (name, description, is_private, invite_code, created_by)
      values (v_name, v_desc, coalesce(p_is_private, false), public._new_invite_code(), v_uid)
      returning * into v_group;
      exit;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;

  insert into public.group_members (group_id, user_id, role) values (v_group.id, v_uid, 'admin');
  perform public._group_system_message(v_group.id, public._username(v_uid) || ' a créé le groupe.');

  return v_group;
end;
$$;

create or replace function public.update_group(
  p_group_id    uuid,
  p_name        text    default null,
  p_description text    default null,
  p_is_private  boolean default null
)
returns public.groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := public._require_uid();
  v_old   public.groups%rowtype;
  v_group public.groups%rowtype;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Seul un admin du groupe peut le modifier.' using errcode = '42501';
  end if;
  if v_name is not null and char_length(v_name) not between 3 and 50 then
    raise exception 'Le nom du groupe doit faire entre 3 et 50 caractères.' using errcode = '22023';
  end if;
  if p_description is not null and char_length(btrim(p_description)) > 500 then
    raise exception 'La description est limitée à 500 caractères.' using errcode = '22023';
  end if;

  select * into v_old from public.groups where id = p_group_id for update;

  -- Un paramètre nul laisse le champ tel quel ; une description vide l'efface.
  update public.groups
  set name        = coalesce(v_name, name),
      description = case when p_description is null then description
                         else nullif(btrim(p_description), '') end,
      is_private  = coalesce(p_is_private, is_private)
  where id = p_group_id
  returning * into v_group;

  if v_group.name is distinct from v_old.name then
    perform public._group_system_message(p_group_id,
      public._username(v_uid) || ' a renommé le groupe en « ' || v_group.name || ' ».');
  end if;
  if v_group.is_private is distinct from v_old.is_private then
    perform public._group_system_message(p_group_id,
      public._username(v_uid) || case when v_group.is_private
        then ' a rendu le groupe privé : on n''y entre plus que sur invitation.'
        else ' a ouvert le groupe : le code d''invitation suffit pour le rejoindre.' end);
  end if;

  return v_group;
end;
$$;

create or replace function public.regenerate_group_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  perform public._require_uid();
  if not public.is_group_admin(p_group_id) then
    raise exception 'Seul un admin du groupe peut changer le code.' using errcode = '42501';
  end if;

  for attempt in 1..5 loop
    begin
      update public.groups set invite_code = public._new_invite_code()
      where id = p_group_id
      returning invite_code into v_code;
      exit;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;

  return v_code;
end;
$$;

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := public._require_uid();
  v_group public.groups%rowtype;
  r       record;
begin
  select * into v_group from public.groups where id = p_group_id for update;
  if not found or v_group.created_by <> v_uid then
    raise exception 'Seul le créateur du groupe peut le supprimer.' using errcode = '42501';
  end if;

  -- Prévenir avant d'effacer : après, il n'y a plus de membres à qui écrire.
  for r in select user_id from public.group_members where group_id = p_group_id and user_id <> v_uid loop
    perform public._notify(r.user_id, 'group_deleted', v_uid, null,
      jsonb_build_object('group_id', p_group_id, 'group_name', v_group.name));
  end loop;

  -- Messages, membres et invitations suivent par cascade.
  delete from public.groups where id = p_group_id;
end;
$$;

create or replace function public.invite_to_group(p_group_id uuid, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := public._require_uid();
  v_group  public.groups%rowtype;
  v_target public.profiles%rowtype;
  v_inv    public.group_invitations%rowtype;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Seul un admin du groupe peut inviter.' using errcode = '42501';
  end if;
  select * into v_group from public.groups where id = p_group_id;

  select * into v_target from public.profiles
  where lower(username) = lower(btrim(coalesce(p_username, '')));
  if not found then
    raise exception 'Aucun joueur ne porte ce pseudo.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_target.id) then
    raise exception '% fait déjà partie du groupe.', v_target.username using errcode = '23505';
  end if;
  if public._is_blocked_between(v_uid, v_target.id) then
    raise exception 'Impossible d''inviter ce joueur.' using errcode = '42501';
  end if;

  -- Réinviter quelqu'un qui n'a pas encore répondu ne renvoie pas une seconde
  -- notification : l'invitation en attente suffit.
  select * into v_inv from public.group_invitations
  where group_id = p_group_id and invitee_id = v_target.id;

  if not found then
    insert into public.group_invitations (group_id, invitee_id, invited_by)
    values (p_group_id, v_target.id, v_uid)
    returning * into v_inv;

    perform public._notify(v_target.id, 'group_invite', v_uid, p_group_id,
      jsonb_build_object('invitation_id', v_inv.id, 'group_name', v_group.name));
  end if;

  return jsonb_build_object(
    'id',         v_inv.id,
    'group_id',   p_group_id,
    'group_name', v_group.name,
    'username',   v_target.username
  );
end;
$$;

create or replace function public._add_group_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.group_members where group_id = p_group_id) >= 50 then
    raise exception 'Ce groupe est complet (50 membres).' using errcode = '54000';
  end if;

  insert into public.group_members (group_id, user_id, role) values (p_group_id, p_user_id, 'member');
  delete from public.group_invitations where group_id = p_group_id and invitee_id = p_user_id;
  update public.notifications set read_at = now()
  where user_id = p_user_id and group_id = p_group_id and kind = 'group_invite' and read_at is null;

  perform public._group_system_message(p_group_id, public._username(p_user_id) || ' a rejoint le groupe.');
end;
$$;

create or replace function public.respond_group_invitation(p_invitation_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
  v_inv public.group_invitations%rowtype;
begin
  select * into v_inv from public.group_invitations
  where id = p_invitation_id and invitee_id = v_uid
  for update;
  if not found then
    raise exception 'Cette invitation n''existe plus.' using errcode = 'P0002';
  end if;

  if p_accept then
    if not exists (select 1 from public.group_members where group_id = v_inv.group_id and user_id = v_uid) then
      perform public._add_group_member(v_inv.group_id, v_uid);
    end if;
    return v_inv.group_id;
  end if;

  delete from public.group_invitations where id = v_inv.id;
  update public.notifications set read_at = now()
  where user_id = v_uid and kind = 'group_invite' and read_at is null
    and payload ->> 'invitation_id' = v_inv.id::text;
  return null;
end;
$$;

create or replace function public.list_group_invitations()
returns table (
  invitation_id      uuid,
  group_id           uuid,
  group_name         text,
  invited_by_username text,
  created_at         timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, g.id, g.name, p.username, i.created_at
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  left join public.profiles p on p.id = i.invited_by
  where i.invitee_id = auth.uid()
  order by i.created_at desc;
$$;

create or replace function public.join_group_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := public._require_uid();
  -- On tolère les espaces, tirets et minuscules d'un code recopié à la main.
  v_code  text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_group public.groups%rowtype;
begin
  select * into v_group from public.groups where invite_code = v_code;
  if not found then
    raise exception 'Aucun groupe ne correspond à ce code.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.group_members where group_id = v_group.id and user_id = v_uid) then
    return v_group.id;
  end if;

  -- Une invitation en attente vaut laissez-passer, même pour un groupe privé.
  if v_group.is_private and not exists (
    select 1 from public.group_invitations where group_id = v_group.id and invitee_id = v_uid
  ) then
    raise exception 'Ce groupe est privé : il faut l''invitation d''un admin.' using errcode = '42501';
  end if;

  perform public._add_group_member(v_group.id, v_uid);
  return v_group.id;
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Tu ne fais pas partie de ce groupe.' using errcode = 'P0002';
  end if;
  -- Un groupe sans créateur n'aurait plus personne pour le supprimer.
  if exists (select 1 from public.groups where id = p_group_id and created_by = v_uid) then
    raise exception 'Tu as créé ce groupe : supprime-le plutôt que de le quitter.' using errcode = '42501';
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = v_uid;
  perform public._group_system_message(p_group_id, public._username(v_uid) || ' a quitté le groupe.');
end;
$$;

create or replace function public.remove_group_member(p_group_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := public._require_uid();
  v_group  public.groups%rowtype;
  v_member public.group_members%rowtype;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Seul un admin du groupe peut retirer un membre.' using errcode = '42501';
  end if;
  if p_member_id = v_uid then
    raise exception 'Pour partir, quitte le groupe.' using errcode = '22023';
  end if;

  select * into v_group from public.groups where id = p_group_id;
  select * into v_member from public.group_members where group_id = p_group_id and user_id = p_member_id;
  if not found then
    raise exception 'Ce joueur ne fait pas partie du groupe.' using errcode = 'P0002';
  end if;
  if p_member_id = v_group.created_by then
    raise exception 'Le créateur du groupe ne peut pas en être retiré.' using errcode = '42501';
  end if;
  -- Entre admins, seul le créateur tranche : sinon deux admins pourraient
  -- s'exclure mutuellement dans une course.
  if v_member.role = 'admin' and v_group.created_by <> v_uid then
    raise exception 'Seul le créateur du groupe peut retirer un admin.' using errcode = '42501';
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = p_member_id;
  perform public._group_system_message(p_group_id, public._username(p_member_id) || ' a été retiré du groupe.');
  perform public._notify(p_member_id, 'group_removed', v_uid, null,
    jsonb_build_object('group_id', p_group_id, 'group_name', v_group.name));
end;
$$;

create or replace function public.set_group_admin(p_group_id uuid, p_member_id uuid, p_admin boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
begin
  if not exists (select 1 from public.groups where id = p_group_id and created_by = v_uid) then
    raise exception 'Seul le créateur du groupe nomme les admins.' using errcode = '42501';
  end if;
  if p_member_id = v_uid then
    raise exception 'Le créateur reste admin.' using errcode = '22023';
  end if;

  update public.group_members
  set role = case when p_admin then 'admin' else 'member' end
  where group_id = p_group_id and user_id = p_member_id;
  if not found then
    raise exception 'Ce joueur ne fait pas partie du groupe.' using errcode = 'P0002';
  end if;
end;
$$;

-- Les groupes du joueur, avec de quoi afficher la liste sans autre requête :
-- nombre de membres et dernier message.
create or replace function public.get_my_groups()
returns table (
  id               uuid,
  name             text,
  description      text,
  is_private       boolean,
  role             text,
  is_creator       boolean,
  member_count     bigint,
  last_message     text,
  last_message_kind text,
  last_message_deleted boolean,
  last_sender      text,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    g.id,
    g.name,
    g.description,
    g.is_private,
    m.role,
    g.created_by = auth.uid(),
    (select count(*) from public.group_members gm where gm.group_id = g.id),
    lm.content,
    lm.kind,
    lm.deleted_at is not null,
    sp.username,
    greatest(g.updated_at, coalesce(lm.created_at, g.created_at))
  from public.group_members m
  join public.groups g on g.id = m.group_id
  left join lateral (
    select msg.content, msg.kind, msg.created_at, msg.deleted_at, msg.sender_id
    from public.group_messages msg
    where msg.group_id = g.id
    order by msg.id desc
    limit 1
  ) lm on true
  left join public.profiles sp on sp.id = lm.sender_id
  where m.user_id = auth.uid()
  order by 12 desc;
$$;

-- ===========================================================================
-- Messages
-- ===========================================================================
create or replace function public.send_group_message(p_group_id uuid, p_content text)
returns public.group_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := public._require_uid();
  v_content text := btrim(coalesce(p_content, ''));
  v_msg     public.group_messages%rowtype;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Tu ne fais pas partie de ce groupe.' using errcode = '42501';
  end if;
  if char_length(v_content) not between 1 and 500 then
    raise exception 'Un message fait entre 1 et 500 caractères.' using errcode = '22023';
  end if;
  -- Anti-rafale : vingt messages en dix secondes, c'est déjà beaucoup pour
  -- des doigts humains.
  if (select count(*) from public.group_messages
      where group_id = p_group_id and sender_id = v_uid
        and created_at > now() - interval '10 seconds') >= 20 then
    raise exception 'Doucement ! Attends quelques secondes avant d''écrire à nouveau.' using errcode = '54000';
  end if;

  insert into public.group_messages (group_id, sender_id, kind, content)
  values (p_group_id, v_uid, 'text', v_content)
  returning * into v_msg;

  return v_msg;
end;
$$;

-- L'auteur retire son message ; un admin peut aussi modérer celui d'un autre.
create or replace function public.delete_group_message(p_message_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
  v_msg public.group_messages%rowtype;
begin
  select * into v_msg from public.group_messages where id = p_message_id for update;
  if not found or not public.is_group_member(v_msg.group_id) then
    raise exception 'Message introuvable.' using errcode = 'P0002';
  end if;
  if v_msg.kind <> 'text' then
    raise exception 'Les messages du groupe ne se suppriment pas.' using errcode = '42501';
  end if;
  if v_msg.sender_id is distinct from v_uid and not public.is_group_admin(v_msg.group_id) then
    raise exception 'Tu ne peux supprimer que tes propres messages.' using errcode = '42501';
  end if;
  if v_msg.deleted_at is not null then
    return;
  end if;

  update public.group_messages set content = null, deleted_at = now() where id = p_message_id;
end;
$$;

-- ===========================================================================
-- Notifications
-- ===========================================================================
-- Nul = tout marquer comme lu.
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
begin
  update public.notifications
  set read_at = now()
  where user_id = v_uid
    and read_at is null
    and (p_ids is null or id = any (p_ids));
end;
$$;

-- ===========================================================================
-- Inviter un ami à une partie
-- ===========================================================================
-- La room reste P2P : l'invitation ne fait que porter le code jusqu'à la cloche
-- de l'ami, qui rejoint ensuite comme s'il avait reçu le lien.
create or replace function public.invite_to_game(p_user_id uuid, p_game_type text, p_room_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := public._require_uid();
  v_code text := upper(btrim(coalesce(p_room_code, '')));
begin
  if not public._are_friends(v_uid, p_user_id) then
    raise exception 'Tu ne peux inviter que tes amis.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.game_types where id = p_game_type) then
    raise exception 'Jeu inconnu : %', p_game_type using errcode = '22023';
  end if;
  if v_code !~ '^[A-Z0-9]{3,12}$' then
    raise exception 'Code de room invalide.' using errcode = '22023';
  end if;

  -- Un double clic ne doit pas faire sonner deux fois.
  if exists (
    select 1 from public.notifications
    where user_id = p_user_id and actor_id = v_uid and kind = 'game_invite'
      and payload ->> 'room_code' = v_code and payload ->> 'game_type' = p_game_type
      and created_at > now() - interval '2 minutes'
  ) then
    return;
  end if;

  perform public._notify(p_user_id, 'game_invite', v_uid, null,
    jsonb_build_object('game_type', p_game_type, 'room_code', v_code));
end;
$$;

-- ===========================================================================
-- Statistiques par jeu et classements
-- ===========================================================================
create or replace view public.profile_game_stats
with (security_invoker = on) as
select
  r.user_id,
  r.game_type,
  count(*)                          as played,
  count(*) filter (where r.won)     as wins,
  coalesce(sum(r.points), 0)::bigint as points
from public.game_results r
group by r.user_id, r.game_type;

-- Le classement complet d'une période, classé. get_leaderboard() en coupe le
-- haut, get_leaderboard_rank() y cherche un joueur : les deux lisent donc
-- exactement le même classement, et une position affichée « 142e » ne peut pas
-- contredire le tableau des cent premiers.
create or replace function public.leaderboard_ranked(
  p_period    text default 'weekly',
  p_game_type text default null
)
returns table (
  "position" bigint,
  user_id    uuid,
  username   text,
  avatar     text,
  points     bigint,
  wins       bigint,
  games      bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with bounds as (
    select case lower(coalesce(p_period, 'weekly'))
             when 'daily'   then date_trunc('day',   now() at time zone 'utc')
             when 'weekly'  then date_trunc('week',  now() at time zone 'utc')
             when 'monthly' then date_trunc('month', now() at time zone 'utc')
             else null
           end at time zone 'utc' as since
  ),
  tallied as (
    select
      r.user_id                     as uid,
      sum(r.points)::bigint         as pts,
      count(*) filter (where r.won) as win_count,
      count(*)                      as game_count
    from public.game_results r, bounds b
    where (b.since is null or r.created_at >= b.since)
      and (p_game_type is null or r.game_type = p_game_type)
    group by r.user_id
    having sum(r.points) > 0
  )
  select
    row_number() over (order by t.pts desc, t.win_count desc, p.username),
    t.uid,
    p.username,
    p.avatar,
    t.pts,
    t.win_count,
    t.game_count
  from tallied t
  join public.profiles p on p.id = t.uid;
$$;

create or replace function public.get_leaderboard(
  p_period    text default 'weekly',
  p_game_type text default null,
  p_limit     int  default 100
)
returns table (
  "position" bigint,
  user_id    uuid,
  username   text,
  avatar     text,
  points     bigint,
  wins       bigint,
  games      bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select * from public.leaderboard_ranked(p_period, p_game_type) l
  order by l."position"
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

-- La position d'un joueur, et la taille du classement pour la situer (« 12e
-- sur 40 »). Aucune ligne quand le joueur n'a rien marqué sur la période.
-- `total` doit compter tout le classement : le filtre sur le joueur vient donc
-- après la fenêtre, dans la requête englobante.
create or replace function public.get_leaderboard_rank(
  p_period    text default 'weekly',
  p_game_type text default null,
  p_user_id   uuid default null
)
returns table (
  "position" bigint,
  user_id    uuid,
  username   text,
  avatar     text,
  points     bigint,
  wins       bigint,
  games      bigint,
  total      bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select * from (
    select l.*, count(*) over () as total
    from public.leaderboard_ranked(p_period, p_game_type) l
  ) ranked
  where ranked.user_id = coalesce(p_user_id, auth.uid());
$$;

-- ===========================================================================
-- Droits d'exécution
-- ===========================================================================
-- Supabase accorde EXECUTE à anon et authenticated sur toute nouvelle fonction
-- de `public`. Les utilitaires internes n'ont rien à faire sur /rest/v1/rpc.
revoke all on function public._require_uid()                               from public, anon, authenticated;
revoke all on function public._are_friends(uuid, uuid)                    from public, anon, authenticated;
revoke all on function public._is_blocked_between(uuid, uuid)             from public, anon, authenticated;
revoke all on function public._notify(uuid, text, uuid, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public._new_invite_code()                          from public, anon, authenticated;
revoke all on function public._group_system_message(uuid, text)           from public, anon, authenticated;
revoke all on function public._username(uuid)                             from public, anon, authenticated;
revoke all on function public._add_group_member(uuid, uuid)               from public, anon, authenticated;

-- Appelées depuis les policies : le rôle qui lit doit pouvoir les exécuter.
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_admin(uuid)  from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid)  to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.touch_last_seen()',
    'public.send_friend_request(text)',
    'public.respond_friend_request(uuid, boolean)',
    'public.remove_friend(uuid)',
    'public.block_user(uuid)',
    'public.unblock_user(uuid)',
    'public.list_friendships()',
    'public.list_blocked()',
    'public.create_group(text, text, boolean)',
    'public.update_group(uuid, text, text, boolean)',
    'public.regenerate_group_invite_code(uuid)',
    'public.delete_group(uuid)',
    'public.invite_to_group(uuid, text)',
    'public.respond_group_invitation(uuid, boolean)',
    'public.list_group_invitations()',
    'public.join_group_by_code(text)',
    'public.leave_group(uuid)',
    'public.remove_group_member(uuid, uuid)',
    'public.set_group_admin(uuid, uuid, boolean)',
    'public.get_my_groups()',
    'public.send_group_message(uuid, text)',
    'public.delete_group_message(bigint)',
    'public.mark_notifications_read(bigint[])',
    'public.invite_to_game(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Les classements restent publics, comme dans 0001.
grant execute on function public.leaderboard_ranked(text, text)            to anon, authenticated;
grant execute on function public.get_leaderboard(text, text, int)          to anon, authenticated;
grant execute on function public.get_leaderboard_rank(text, text, uuid)    to anon, authenticated;

-- ===========================================================================
-- Temps réel
-- ===========================================================================
-- Seules deux tables sont diffusées. Les autres changent toujours en même
-- temps qu'une notification ou un message système, qui sert de signal au
-- client pour relire ce qu'il affiche.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages'
    ) then
      alter publication supabase_realtime add table public.group_messages;
    end if;
  end if;
end;
$$;

-- Canaux privés : « online » (présence des joueurs connectés) et
-- « group:<uuid> » (indicateur de frappe, réservé aux membres). Sans ces
-- policies, n'importe qui muni de la clé publique pourrait écouter qui écrit
-- dans quel groupe.
create or replace function public.realtime_topic_allowed(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or p_topic is null then
    return false;
  end if;
  if p_topic = 'online' then
    return true;
  end if;
  if p_topic ~ '^group:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return public.is_group_member(substr(p_topic, 7)::uuid);
  end if;
  return false;
end;
$$;

revoke all on function public.realtime_topic_allowed(text) from public, anon;
grant execute on function public.realtime_topic_allowed(text) to authenticated;

do $$
begin
  if to_regclass('realtime.messages') is not null
     and to_regprocedure('realtime.topic()') is not null then
    execute 'drop policy if exists lacafet_realtime_read on realtime.messages';
    execute 'create policy lacafet_realtime_read on realtime.messages
               for select to authenticated
               using (public.realtime_topic_allowed(realtime.topic()))';
    execute 'drop policy if exists lacafet_realtime_write on realtime.messages';
    execute 'create policy lacafet_realtime_write on realtime.messages
               for insert to authenticated
               with check (public.realtime_topic_allowed(realtime.topic()))';
  end if;
end;
$$;
