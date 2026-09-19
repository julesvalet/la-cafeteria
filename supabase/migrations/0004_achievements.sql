-- ===========================================================================
-- La Cafétéria — trophées
--
-- Le catalogue vit en base (ajuster un seuil est un UPDATE), la progression
-- de chaque joueur aussi. Tout se calcule côté base, à partir des parties
-- enregistrées : un client ne peut pas se décerner un trophée, seulement
-- jouer des parties qui y mènent.
--
-- Réserve assumée, la même que pour les points (voir 0001) : en P2P, les
-- compteurs propres à un jeu (scopas, cartes spéciales, arrêts prudents)
-- viennent du client. Ils sont bornés, et ne pèsent sur aucun classement.
--
-- Idempotent : le rejouer sur une base à jour ne change rien.
-- ===========================================================================

-- Compteurs d'une partie, propres à chaque jeu.
alter table public.game_results add column if not exists details jsonb not null default '{}'::jsonb;

create table if not exists public.achievements (
  id          text primary key,
  title       text not null,
  description text not null,
  category    text not null check (category in ('victoires', 'flip7', 'scopa', 'uno', 'puissance4', 'social', 'defis')),
  -- Nom d'icône lucide côté client : jamais d'emoji.
  icon        text not null,
  -- Rang de prestige, pour la couleur : bronze, argent, or, légende.
  tier        text not null default 'bronze' check (tier in ('bronze', 'argent', 'or', 'legende')),
  goal        int  not null check (goal > 0),
  sort_order  int  not null default 0
);

insert into public.achievements (id, title, description, category, icon, tier, goal, sort_order) values
  ('first_win',        'Premier pas',     'Gagner une partie, n''importe laquelle.',                 'victoires',  'Footprints', 'bronze',   1,  10),
  ('warrior',          'Guerrier',        'Gagner 10 parties.',                                      'victoires',  'Swords',     'argent',   10, 20),
  ('champion',         'Champion',        'Gagner 50 parties.',                                      'victoires',  'Trophy',     'or',       50, 30),
  ('king',             'Roi des rois',    'Gagner 100 parties.',                                     'victoires',  'Crown',      'legende',  100, 40),
  ('flip7_cardiac',    'Cardiaque',       'Gagner 5 parties de Flip 7.',                             'flip7',      'HeartPulse', 'argent',   5,  50),
  ('flip7_shy',        'Timide',          'Au Flip 7, t''arrêter dès ta première carte, 10 fois.',   'flip7',      'Hand',       'bronze',   10, 60),
  ('scopa_scopeur',    'Scopeur',         'Réussir 3 scopas dans une même partie.',                  'scopa',      'Sparkles',   'argent',   3,  70),
  ('scopa_legend',     'Légendaire',      'Gagner 20 parties de Scopa.',                             'scopa',      'Gem',        'or',       20, 80),
  ('uno_fast',         'Rapide',          'Gagner 3 parties d''UNO d''affilée.',                     'uno',        'Zap',        'argent',   3,  90),
  ('uno_strategist',   'Stratège',        'Jouer 50 cartes spéciales à l''UNO.',                     'uno',        'Layers',     'argent',   50, 100),
  ('p4_geometer',      'Géomètre',        'Gagner 10 parties de Puissance 4.',                       'puissance4', 'Grid3x3',    'argent',   10, 110),
  ('p4_strategist',    'Stratégiste',     'Gagner 5 parties de Puissance 4 d''affilée.',             'puissance4', 'Brain',      'or',       5,  120),
  ('social_sociable',  'Sociable',        'Jouer avec 5 amis différents.',                           'social',     'Users',      'bronze',   5,  130),
  ('social_groupie',   'Groupie',         'Créer ou rejoindre 3 groupes.',                           'social',     'MessagesSquare', 'bronze', 3, 140),
  ('social_best',      'Meilleur ami',    'Jouer 10 parties avec le même ami.',                      'social',     'HeartHandshake', 'argent', 10, 150),
  ('gold_week',        'Semaine d''or',   'Finir premier du classement d''une semaine.',             'defis',      'Medal',      'or',       1,  160),
  ('fire_month',       'Mois de feu',     'Finir premier du classement d''un mois.',                 'defis',      'Flame',      'legende',  1,  170),
  ('streak',           'Série',           'Gagner 5 parties d''affilée, tous jeux confondus.',       'defis',      'TrendingUp', 'or',       5,  180),
  ('five_stars',       'Cinq étoiles',    'Gagner à 3 jeux différents le même jour.',                'defis',      'Stars',      'argent',   3,  190),
  ('regular',          'Habitué',         'Jouer 100 parties.',                                      'defis',      'Coffee',     'or',       100, 200)
on conflict (id) do update
  set title = excluded.title, description = excluded.description, category = excluded.category,
      icon = excluded.icon, tier = excluded.tier, goal = excluded.goal, sort_order = excluded.sort_order;

create table if not exists public.user_achievements (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  progress       int  not null default 0,
  unlocked_at    timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

-- Publics, comme les profils : les trophées se montrent.
drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements for select to anon, authenticated using (true);
drop policy if exists user_achievements_read on public.user_achievements;
create policy user_achievements_read on public.user_achievements for select to anon, authenticated using (true);

create or replace view public.achievement_counts
with (security_invoker = on) as
select user_id, count(*) filter (where unlocked_at is not null) as unlocked
from public.user_achievements
group by user_id;

-- ===========================================================================
-- Calcul
-- ===========================================================================

-- Meilleure série de victoires consécutives, sur un ensemble de jeux (nul :
-- tous). L'ordre d'arrivée est `seq`, comme pour la prime de série.
create or replace function public._best_streak(p_user uuid, p_games text[] default null)
returns int
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_best int := 0;
  v_cur  int := 0;
  r      record;
begin
  for r in
    select won from public.game_results
    where user_id = p_user and (p_games is null or game_type = any (p_games))
    order by seq
  loop
    if r.won then
      v_cur := v_cur + 1;
      v_best := greatest(v_best, v_cur);
    else
      v_cur := 0;
    end if;
  end loop;
  return v_best;
end;
$$;

-- A-t-il fini premier d'une période close (semaine ou mois) ?
create or replace function public._topped_period(p_user uuid, p_unit text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  with per_period as (
    select date_trunc(p_unit, r.created_at at time zone 'utc') as period, r.user_id, sum(r.points) as pts
    from public.game_results r
    group by 1, 2
    having sum(r.points) > 0
  ),
  ranked as (
    select period, user_id, rank() over (partition by period order by pts desc) as rk
    from per_period
    -- Une période en cours n'est pas encore gagnée.
    where period < date_trunc(p_unit, now() at time zone 'utc')
  )
  select exists (select 1 from ranked where user_id = p_user and rk = 1);
$$;

create or replace function public._achievement_progress(p_user uuid)
returns table (achievement_id text, progress int)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_wins     int;
  v_games    int;
  v_friends  int := 0;
  v_best_pal int := 0;
begin
  select count(*) filter (where won), count(*) into v_wins, v_games
  from public.game_results where user_id = p_user;

  -- Les partenaires de jeu : les autres lignes des mêmes parties.
  if to_regclass('public.friendships') is not null then
    select count(distinct o.user_id), coalesce(max(cnt), 0) into v_friends, v_best_pal
    from (
      select o.user_id, count(*) over (partition by o.user_id) as cnt
      from public.game_results m
      join public.game_results o on o.session_id = m.session_id and o.user_id <> m.user_id
      where m.user_id = p_user
        and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and least(f.requester_id, f.addressee_id) = least(p_user, o.user_id)
            and greatest(f.requester_id, f.addressee_id) = greatest(p_user, o.user_id)
        )
    ) o;
  end if;

  return query values
    ('first_win',       v_wins),
    ('warrior',         v_wins),
    ('champion',        v_wins),
    ('king',            v_wins),
    ('regular',         v_games),
    ('flip7_cardiac',   (select count(*)::int from public.game_results where user_id = p_user and game_type = 'flip7' and won)),
    ('flip7_shy',       (select coalesce(sum((details ->> 'early_stays')::int), 0)::int from public.game_results where user_id = p_user and game_type = 'flip7')),
    ('scopa_scopeur',   (select coalesce(max((details ->> 'scopas')::int), 0)::int from public.game_results where user_id = p_user and game_type = 'scopa')),
    ('scopa_legend',    (select count(*)::int from public.game_results where user_id = p_user and game_type = 'scopa' and won)),
    ('uno_fast',        public._best_streak(p_user, array['uno'])),
    ('uno_strategist',  (select coalesce(sum((details ->> 'special_cards')::int), 0)::int from public.game_results where user_id = p_user and game_type = 'uno')),
    ('p4_geometer',     (select count(*)::int from public.game_results where user_id = p_user and game_type in ('puissance4', 'puissance4-original') and won)),
    ('p4_strategist',   public._best_streak(p_user, array['puissance4', 'puissance4-original'])),
    ('social_sociable', v_friends),
    ('social_groupie',  case when to_regclass('public.group_members') is null then 0
                             else (select count(*)::int from public.group_members where user_id = p_user) end),
    ('social_best',     v_best_pal::int),
    ('gold_week',       public._topped_period(p_user, 'week')::int),
    ('fire_month',      public._topped_period(p_user, 'month')::int),
    ('streak',          public._best_streak(p_user, null)),
    ('five_stars',      (select coalesce(max(n), 0)::int from (
                           select count(distinct game_type) as n from public.game_results
                           where user_id = p_user and won
                           group by date_trunc('day', created_at at time zone 'utc')) d));
end;
$$;

-- Met à jour la progression et renvoie ce qui vient d'être débloqué. La
-- progression ne recule jamais : quitter un groupe ne reprend pas un trophée.
create or replace function public._evaluate_achievements(p_user uuid)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_new jsonb := '[]'::jsonb;
  r     record;
begin
  for r in
    select a.id, a.title, a.icon, a.tier, a.goal, p.progress
    from public._achievement_progress(p_user) p
    join public.achievements a on a.id = p.achievement_id
  loop
    insert into public.user_achievements as ua (user_id, achievement_id, progress, unlocked_at, updated_at)
    values (p_user, r.id, least(r.progress, r.goal), case when r.progress >= r.goal then now() end, now())
    on conflict (user_id, achievement_id) do update
      set progress    = greatest(ua.progress, excluded.progress),
          unlocked_at = coalesce(ua.unlocked_at, excluded.unlocked_at),
          updated_at  = now()
      where ua.progress < excluded.progress or (ua.unlocked_at is null and excluded.unlocked_at is not null);

    -- Débloqué à l'instant : la ligne vient d'être écrite avec cette date.
    if r.progress >= r.goal and exists (
      select 1 from public.user_achievements
      where user_id = p_user and achievement_id = r.id and unlocked_at >= now()
    ) then
      v_new := v_new || jsonb_build_object('id', r.id, 'title', r.title, 'icon', r.icon, 'tier', r.tier);
      if to_regprocedure('public._notify(uuid,text,uuid,uuid,jsonb,boolean)') is not null then
        perform public._notify(p_user, 'achievement', null, null,
          jsonb_build_object('achievement_id', r.id, 'title', r.title, 'icon', r.icon, 'tier', r.tier));
      end if;
    end if;
  end loop;
  return v_new;
end;
$$;

-- Pour les trophées qui ne viennent pas d'une partie (groupes, classement de
-- la semaine passée) : relu à l'ouverture de l'accueil ou du profil.
create or replace function public.refresh_my_achievements()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Il faut être connecté.' using errcode = '42501';
  end if;
  return public._evaluate_achievements(v_uid);
end;
$$;

-- ===========================================================================
-- Enregistrement d'une partie : compteurs du jeu, et trophées au passage
-- ===========================================================================
-- Nouvelle signature (compteurs `p_details`, trophées débloqués en retour) :
-- l'ancienne est retirée, sinon PostgREST ne saurait laquelle appeler.
drop function if exists public.record_game_result(text, text, text, int, boolean, int, int);

create or replace function public.record_game_result(
  p_session_key      text,
  p_game_type        text,
  p_room_code        text,
  p_player_count     int,
  p_won              boolean,
  p_score            int     default 0,
  p_duration_seconds int     default null,
  p_details          jsonb   default '{}'::jsonb
)
returns table (
  session_id   uuid,
  points       int,
  streak       int,
  streak_bonus boolean,
  already      boolean,
  unlocked     jsonb
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
  v_details     jsonb := '{}'::jsonb;
  v_key         text;
  r             record;
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour enregistrer une partie.' using errcode = '42501';
  end if;

  select * into v_game from public.game_types where id = p_game_type;
  if not found then
    raise exception 'Jeu inconnu : %', p_game_type using errcode = '22023';
  end if;

  if p_session_key is null or char_length(p_session_key) < 8 then
    raise exception 'Clé de session invalide.' using errcode = '22023';
  end if;

  p_player_count := least(greatest(coalesce(p_player_count, 2), 1), 8);

  -- Seuls les compteurs connus passent, en entiers bornés.
  foreach v_key in array array['scopas', 'special_cards', 'early_stays'] loop
    if jsonb_typeof(p_details -> v_key) = 'number' then
      v_details := v_details || jsonb_build_object(v_key, least(greatest((p_details ->> v_key)::numeric::int, 0), 200));
    end if;
  end loop;

  insert into public.game_sessions (session_key, game_type, room_code, player_count, duration_seconds)
  values (p_session_key, p_game_type, nullif(p_room_code, ''), p_player_count, nullif(p_duration_seconds, 0))
  on conflict (session_key) do nothing
  returning id into v_session;

  if v_session is null then
    select id into v_session from public.game_sessions where session_key = p_session_key;
  end if;

  select * into v_existing from public.game_results gr where gr.session_id = v_session and gr.user_id = v_uid;
  if found then
    return query select v_session, v_existing.points, 0, v_existing.streak_bonus, true, '[]'::jsonb;
    return;
  end if;

  if p_won then
    v_max_winners := greatest(1, p_player_count / 2);
    select count(*) into v_winners from public.game_results gr where gr.session_id = v_session and gr.won;
    if v_winners >= v_max_winners then
      raise exception 'Cette partie compte déjà tous ses vainqueurs.' using errcode = '23514';
    end if;

    v_points := v_game.win_points + v_game.per_extra_player_points * greatest(p_player_count - 2, 0);

    for r in
      select gr.won from public.game_results gr where gr.user_id = v_uid order by gr.seq desc limit 100
    loop
      exit when not r.won;
      v_streak := v_streak + 1;
    end loop;
    v_streak := v_streak + 1;

    if v_streak % 3 = 0 then
      v_points := v_points + 50;
      v_bonus  := true;
    end if;
  end if;

  insert into public.game_results (session_id, user_id, game_type, won, score, points, streak_bonus, details)
  values (v_session, v_uid, p_game_type, p_won, coalesce(p_score, 0), v_points, v_bonus, v_details);

  return query select v_session, v_points, v_streak, v_bonus, false, public._evaluate_achievements(v_uid);
end;
$$;

-- Le jeu le plus joué des sept derniers jours, pour la tuile « jeu tendance ».
create or replace function public.trending_game()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select game_type from public.game_sessions
    where ended_at > now() - interval '7 days'
    group by game_type
    order by count(*) desc, game_type
    limit 1
  ), 'flip7');
$$;

revoke all on function public._best_streak(uuid, text[])        from public, anon, authenticated;
revoke all on function public._topped_period(uuid, text)        from public, anon, authenticated;
revoke all on function public._achievement_progress(uuid)       from public, anon, authenticated;
revoke all on function public._evaluate_achievements(uuid)      from public, anon, authenticated;
revoke all on function public.refresh_my_achievements()         from public, anon;
grant execute on function public.refresh_my_achievements()      to authenticated;
revoke all on function public.record_game_result(text, text, text, int, boolean, int, int, jsonb) from public, anon;
grant execute on function public.record_game_result(text, text, text, int, boolean, int, int, jsonb) to authenticated;
grant execute on function public.trending_game()                to anon, authenticated;
