-- ===========================================================================
-- La Cafétéria — comptes, parties et statistiques (socle)
--
-- Le site est un build statique servi par GitHub Pages : il n'y a pas de
-- serveur applicatif où faire respecter une règle. Tout ce qui doit être
-- garanti l'est donc ici — par la RLS pour les droits de lecture et
-- d'écriture, et par des fonctions SECURITY DEFINER pour tout calcul qu'un
-- client ne doit pas pouvoir influencer (les points, avant tout).
--
-- Ce fichier décrit l'état complet du schéma. Il est idempotent : le rejouer
-- sur une base déjà à jour ne change rien.
-- ===========================================================================

-- --- Catalogue des jeux -----------------------------------------------------
-- Le barème vit en base plutôt que dans un CASE : ajuster le prix d'une
-- victoire est un UPDATE, pas une migration et un redéploiement.
create table if not exists public.game_types (
  id                      text primary key,
  label                   text    not null,
  win_points              int     not null check (win_points >= 0),
  -- Bonus par joueur au-delà du duel : récompense une victoire sur une table
  -- plus fournie. Seul Flip 7 s'en sert aujourd'hui.
  per_extra_player_points int     not null default 0 check (per_extra_player_points >= 0),
  sort_order              int     not null default 0
);

insert into public.game_types (id, label, win_points, per_extra_player_points, sort_order) values
  ('flip7',               'Flip 7',               100, 10, 1),
  ('scopa',               'Scopa',                150,  0, 2),
  ('uno',                 'UNO',                  120,  0, 3),
  ('puissance4',          'Puissance 4',          110,  0, 4),
  ('puissance4-original', 'Puissance 4 Original', 110,  0, 5)
on conflict (id) do update
  set label                   = excluded.label,
      win_points              = excluded.win_points,
      per_extra_player_points = excluded.per_extra_player_points,
      sort_order              = excluded.sort_order;

-- --- Profils ----------------------------------------------------------------
-- L'e-mail et le mot de passe restent dans auth.users : les dupliquer ici
-- créerait une seconde source de vérité à tenir synchronisée, et exposerait
-- l'e-mail à la policy de lecture publique plus bas.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text        not null,
  avatar      text,
  bio         text,
  preferences jsonb       not null default '{"theme":"system","notifications":true,"language":"fr"}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_bio_length      check (bio is null or char_length(bio) <= 200)
);

-- Unicité insensible à la casse : "Jules" et "jules" ne peuvent pas coexister,
-- sinon la recherche d'un ami par pseudo devient ambiguë.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- --- Parties ----------------------------------------------------------------
-- Une ligne par partie terminée. `session_key` est dérivée de l'état final de
-- façon déterministe et identique chez tous les pairs : c'est ce qui permet à
-- quatre joueurs d'enregistrer chacun leur résultat et de se retrouver
-- rattachés à la même partie, sans qu'aucun serveur n'arbitre.
create table if not exists public.game_sessions (
  id               uuid primary key default gen_random_uuid(),
  session_key      text        not null unique,
  game_type        text        not null references public.game_types (id),
  room_code        text,
  player_count     int         not null check (player_count between 1 and 8),
  duration_seconds int         check (duration_seconds >= 0),
  ended_at         timestamptz not null default now()
);

-- Le résultat d'un joueur dans une partie. `game_type` est dupliqué depuis la
-- session : les classements filtrent par jeu et par date, et cette
-- dénormalisation leur évite une jointure sur chaque agrégation.
create table if not exists public.game_results (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid        not null references public.game_sessions (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id)      on delete cascade,
  game_type    text        not null references public.game_types (id),
  won          boolean     not null,
  -- Score brut affiché dans le jeu (points Scopa, total Flip 7…). Purement
  -- informatif : il vient du client et ne pèse sur aucun classement.
  score        int         not null default 0,
  -- Points de classement. Calculés par record_game_result(), jamais fournis
  -- par le client.
  points       int         not null default 0,
  streak_bonus boolean     not null default false,
  created_at   timestamptz not null default now(),
  -- L'ordre d'arrivée doit être total et stable : la série de victoires se lit
  -- en remontant les lignes une à une. `created_at` ne suffit pas — deux
  -- résultats écrits dans la même transaction partagent le même now(), et
  -- départager sur un uuid aléatoire revient à tirer l'ordre au sort.
  seq          bigint      generated by default as identity,
  unique (session_id, user_id)
);

create index if not exists game_results_leaderboard_idx
  on public.game_results (game_type, created_at desc);
create index if not exists game_results_user_idx
  on public.game_results (user_id, created_at desc);
create index if not exists game_results_user_seq_idx
  on public.game_results (user_id, seq desc);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles      enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_results  enable row level security;
alter table public.game_types    enable row level security;

-- Le barème est public en lecture (l'UI l'affiche dans les règles). Aucune
-- policy d'écriture : seul le service_role, qui contourne la RLS, le modifie.
drop policy if exists game_types_read on public.game_types;
create policy game_types_read on public.game_types
  for select to anon, authenticated using (true);

-- Un profil est public : il faut pouvoir consulter la fiche d'un adversaire et
-- afficher un pseudo dans un classement sans être connecté.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Parties et résultats : lecture ouverte (classements, historique d'un
-- profil), écriture fermée. L'absence de policy INSERT est délibérée — la
-- seule porte d'entrée est record_game_result(), qui calcule les points. Un
-- client qui tenterait un INSERT direct pour s'attribuer 99 999 points se
-- heurte à la RLS.
drop policy if exists game_sessions_read on public.game_sessions;
create policy game_sessions_read on public.game_sessions
  for select to anon, authenticated using (true);

drop policy if exists game_results_read on public.game_results;
create policy game_results_read on public.game_results
  for select to anon, authenticated using (true);

-- ===========================================================================
-- Création du profil à l'inscription
-- ===========================================================================
-- Le pseudo voyage dans les métadonnées du signUp. Le faire poser par un
-- trigger plutôt que par un second appel client garantit qu'un compte ne peut
-- pas exister sans profil — ce qui arriverait si l'onglet se fermait entre les
-- deux requêtes.
--
-- Ce trigger s'exécute dans la transaction qui crée le compte : s'il lève,
-- l'inscription entière échoue. Deux cas le menacent — un pseudo pris entre la
-- vérification côté client et l'envoi du formulaire, et un pseudo refusé par
-- la contrainte de format (métadonnée posée hors du formulaire). Dans les deux
-- cas, mieux vaut un pseudo dérivé qu'un compte non créé : le joueur pourra le
-- changer depuis son profil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wanted   text := nullif(new.raw_user_meta_data ->> 'username', '');
  v_fallback text := 'joueur_' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  if v_wanted is null or v_wanted !~ '^[A-Za-z0-9_]{3,20}$' then
    v_wanted := v_fallback;
  end if;

  begin
    insert into public.profiles (id, username) values (new.id, v_wanted);
  exception
    when unique_violation then
      -- Le pseudo vient d'être pris. L'identifiant du compte, lui, est unique
      -- par construction : le repli ne peut pas entrer en collision.
      insert into public.profiles (id, username) values (new.id, v_fallback)
      on conflict (id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tenir `updated_at` à jour côté base : un client qui oublie de l'envoyer ne
-- peut pas faire mentir la colonne.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Supabase accorde EXECUTE à anon et authenticated par défaut sur toute
-- nouvelle fonction de `public`. Une fonction de trigger n'a aucune raison
-- d'être appelable via /rest/v1/rpc : on retire le droit explicitement.
revoke all on function public.handle_new_user()  from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- Les comptes créés avant l'existence du trigger n'ont pas de profil, et un
-- compte sans profil est un compte cassé. On dérive un pseudo de l'e-mail, en
-- repliant sur l'identifiant si le résultat est mal formé ou déjà pris.
insert into public.profiles (id, username)
select
  u.id,
  case
    when candidate.value ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(candidate.value))
      then candidate.value
    else 'joueur_' || substr(replace(u.id::text, '-', ''), 1, 8)
  end
from auth.users u
cross join lateral (
  select left(regexp_replace(split_part(u.email, '@', 1), '[^A-Za-z0-9_]', '', 'g'), 20) as value
) as candidate
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ===========================================================================
-- Enregistrement d'une partie
-- ===========================================================================
-- Seule voie d'écriture dans game_sessions / game_results. Chaque joueur
-- connecté appelle cette fonction pour *sa* ligne ; la clé de session,
-- identique chez tous les pairs, les regroupe sur la même partie.
--
-- Ce que la fonction garantit : les points ne sont jamais fournis par le
-- client, un joueur ne peut écrire que sa propre ligne, et un double appel
-- (re-render, reconnexion, rechargement) ne compte pas deux fois.
--
-- Ce qu'elle ne garantit pas : en P2P il n'existe aucun arbitre pour attester
-- du déroulé réel d'une partie. Un client modifié peut déclarer une victoire
-- qui n'a pas eu lieu. Le plafond de vainqueurs ci-dessous attrape les
-- incohérences accidentelles, pas un tricheur déterminé — ce qui est le bon
-- niveau d'effort pour un site entre amis.
create or replace function public.record_game_result(
  p_session_key      text,
  p_game_type        text,
  p_room_code        text,
  p_player_count     int,
  p_won              boolean,
  p_score            int     default 0,
  p_duration_seconds int     default null
)
returns table (
  session_id   uuid,
  points       int,
  streak       int,
  streak_bonus boolean,
  already      boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_game        public.game_types%rowtype;
  v_session     uuid;
  v_points      int  := 0;
  v_streak      int  := 0;
  v_bonus       boolean := false;
  v_winners     int;
  v_max_winners int;
  v_existing    public.game_results%rowtype;
  r             record;
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour enregistrer une partie.'
      using errcode = '42501';
  end if;

  select * into v_game from public.game_types where id = p_game_type;
  if not found then
    raise exception 'Jeu inconnu : %', p_game_type using errcode = '22023';
  end if;

  if p_session_key is null or char_length(p_session_key) < 8 then
    raise exception 'Clé de session invalide.' using errcode = '22023';
  end if;

  p_player_count := least(greatest(coalesce(p_player_count, 2), 1), 8);

  -- La partie est créée par le premier joueur qui la déclare ; les suivants
  -- retombent sur la même ligne. ON CONFLICT ne renvoie rien quand il ne fait
  -- rien, d'où le SELECT de repli.
  insert into public.game_sessions (session_key, game_type, room_code, player_count, duration_seconds)
  values (p_session_key, p_game_type, nullif(p_room_code, ''), p_player_count, nullif(p_duration_seconds, 0))
  on conflict (session_key) do nothing
  returning id into v_session;

  if v_session is null then
    select id into v_session from public.game_sessions where session_key = p_session_key;
  end if;

  -- Rejoué à l'identique : on renvoie la ligne déjà en base sans rien ajouter.
  select * into v_existing
  from public.game_results gr
  where gr.session_id = v_session and gr.user_id = v_uid;

  if found then
    return query select v_session, v_existing.points, 0, v_existing.streak_bonus, true;
    return;
  end if;

  if p_won then
    -- Une partie ne peut pas être gagnée par tout le monde. La moitié de la
    -- table couvre le 2v2 de Scopa comme les équipes de Puissance 4.
    v_max_winners := greatest(1, p_player_count / 2);
    select count(*) into v_winners
    from public.game_results gr
    where gr.session_id = v_session and gr.won;

    if v_winners >= v_max_winners then
      raise exception 'Cette partie compte déjà tous ses vainqueurs.'
        using errcode = '23514';
    end if;

    v_points := v_game.win_points
              + v_game.per_extra_player_points * greatest(p_player_count - 2, 0);

    -- Série en cours, tous jeux confondus : on remonte par `seq` jusqu'à la
    -- première défaite. Borné à 100 — au-delà la prime est de toute façon
    -- acquise, et la boucle n'a pas à parcourir un historique entier.
    for r in
      select gr.won from public.game_results gr
      where gr.user_id = v_uid
      order by gr.seq desc
      limit 100
    loop
      exit when not r.won;
      v_streak := v_streak + 1;
    end loop;
    v_streak := v_streak + 1;  -- la victoire en cours

    -- Une prime toutes les trois victoires d'affilée, pas à chaque victoire
    -- une fois le cap des trois franchi.
    if v_streak % 3 = 0 then
      v_points := v_points + 50;
      v_bonus  := true;
    end if;
  end if;

  insert into public.game_results (session_id, user_id, game_type, won, score, points, streak_bonus)
  values (v_session, v_uid, p_game_type, p_won, coalesce(p_score, 0), v_points, v_bonus);

  return query select v_session, v_points, v_streak, v_bonus, false;
end;
$$;

revoke all on function public.record_game_result(text, text, text, int, boolean, int, int)
  from public, anon;
grant execute on function public.record_game_result(text, text, text, int, boolean, int, int)
  to authenticated;

-- ===========================================================================
-- Statistiques et classements
-- ===========================================================================
-- Vue plutôt que compteurs tenus à jour sur profiles : des totaux dénormalisés
-- dérivent dès qu'une partie est corrigée ou supprimée, alors qu'une
-- agrégation ne peut pas se désynchroniser de ses propres lignes.
create or replace view public.profile_stats
with (security_invoker = on) as
select
  p.id                                 as user_id,
  p.username,
  p.avatar,
  p.created_at,
  count(r.id)                          as games_played,
  count(r.id) filter (where r.won)     as wins,
  count(r.id) filter (where not r.won) as losses,
  coalesce(sum(r.points), 0)::bigint   as points,
  (
    select r2.game_type
    from public.game_results r2
    where r2.user_id = p.id
    group by r2.game_type
    order by count(*) desc, r2.game_type
    limit 1
  )                                    as favorite_game
from public.profiles p
left join public.game_results r on r.user_id = p.id
group by p.id, p.username, p.avatar, p.created_at;

-- Le spec prévoyait un cron horaire recalculant une table de classements. Une
-- agrégation filtrée par date donne le même résultat, toujours à jour et sans
-- tâche planifiée à surveiller : le classement se calcule à la lecture.
-- "position" est un mot réservé SQL : il reste cité pour garder le nom que
-- l'UI attend plutôt que d'imposer un alias au client.
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
  with bounds as (
    -- Les remises à zéro tombent à 00:00 UTC, et la semaine ISO commence le
    -- lundi — ce que date_trunc('week') fait déjà.
    select case lower(coalesce(p_period, 'weekly'))
             when 'daily'   then date_trunc('day',   now() at time zone 'utc')
             when 'weekly'  then date_trunc('week',  now() at time zone 'utc')
             when 'monthly' then date_trunc('month', now() at time zone 'utc')
             else null  -- 'alltime'
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
    -- Un classement liste ceux qui ont marqué : une colonne de zéros n'apprend
    -- rien et repousse les vrais scores hors des cent premières lignes.
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
  join public.profiles p on p.id = t.uid
  order by t.pts desc, t.win_count desc, p.username
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

grant execute on function public.get_leaderboard(text, text, int) to anon, authenticated;
