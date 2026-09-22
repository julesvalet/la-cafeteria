-- ===========================================================================
-- La Cafétéria — Roulette de Vérité : le jeu, et le pool de questions perso
--
-- À appliquer après 0004. Mêmes principes : lecture filtrée par la RLS,
-- écriture uniquement par des fonctions RPC.
--
-- Comme les autres jeux, une partie est P2P : la base ne voit ni les
-- réponses, ni les verdicts du chef, ni les questions privées (elles vivent
-- dans l'état de la partie, chez l'hôte, et disparaissent avec elle). Elle ne
-- tient que le pool des questions *publiques*, que d'autres parties tirent.
--
-- Les tables `game_sessions` et `notifications` existent déjà pour tout le
-- site : ce jeu n'en crée pas d'homonymes.
--
-- Idempotent : le rejouer sur une base à jour ne change rien.
-- ===========================================================================

-- --- Le jeu au catalogue -----------------------------------------------------
-- Nécessaire pour annoncer une table aux amis (publish_room) et inviter
-- (invite_to_game). Les parties ne sont pas enregistrées au classement : un
-- score attribué par un arbitre entre amis ne se compare pas d'une table à
-- l'autre — d'où 0 point.
insert into public.game_types (id, label, win_points, per_extra_player_points, sort_order) values
  ('verite', 'Roulette de Vérité', 0, 0, 6)
on conflict (id) do update
  set label      = excluded.label,
      sort_order = excluded.sort_order;

-- --- Questions publiques ------------------------------------------------------
create table if not exists public.truth_questions (
  id           uuid        primary key default gen_random_uuid(),
  creator_id   uuid        not null references public.profiles (id) on delete cascade,
  content      text        not null,
  theme        text        not null,
  used_count   int         not null default 0,
  report_count int         not null default 0,
  -- Masquée au troisième signalement : elle ne sort plus du pool.
  hidden       boolean     not null default false,
  created_at   timestamptz not null default now(),
  constraint truth_questions_theme   check (theme in ('clean', 'normal', 'hard')),
  constraint truth_questions_content check (char_length(content) between 5 and 200 and content = btrim(content))
);

create index if not exists truth_questions_pool_idx
  on public.truth_questions (theme) where not hidden;
create index if not exists truth_questions_creator_idx
  on public.truth_questions (creator_id, created_at desc);

-- Un signalement par joueur et par question.
create table if not exists public.truth_question_reports (
  question_id uuid        not null references public.truth_questions (id) on delete cascade,
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);

alter table public.truth_questions        enable row level security;
alter table public.truth_question_reports enable row level security;

-- Lecture : le pool visible, plus ses propres questions (même masquées).
-- Aucune policy d'écriture : tout passe par les fonctions ci-dessous.
drop policy if exists truth_questions_read on public.truth_questions;
create policy truth_questions_read on public.truth_questions
  for select to anon, authenticated
  using (not hidden or creator_id = auth.uid());

-- Les signalements ne se lisent pas : qui a signalé quoi ne regarde personne.

-- --- Fonctions ------------------------------------------------------------------

-- Publie une question. Compte requis ; 20 par jour, pour qu'un compte ne
-- puisse pas noyer le pool.
create or replace function public.add_truth_question(p_content text, p_theme text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := public._require_uid();
  v_content text := btrim(regexp_replace(coalesce(p_content, ''), '\s+', ' ', 'g'));
  v_id      uuid;
begin
  if p_theme is null or p_theme not in ('clean', 'normal', 'hard') then
    raise exception 'Thème inconnu.' using errcode = '22023';
  end if;
  if char_length(v_content) not between 5 and 200 then
    raise exception 'Une question fait entre 5 et 200 caractères.' using errcode = '22023';
  end if;
  if (select count(*) from public.truth_questions
       where creator_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Tu as publié beaucoup de questions aujourd''hui : reviens demain.' using errcode = '54000';
  end if;

  -- Déjà dans le pool (même texte, même thème) : on renvoie l'existante.
  select id into v_id from public.truth_questions
   where lower(content) = lower(v_content) and theme = p_theme and not hidden
   limit 1;
  if found then
    return v_id;
  end if;

  insert into public.truth_questions (creator_id, content, theme)
  values (v_uid, v_content, p_theme)
  returning id into v_id;
  return v_id;
end;
$$;

-- Un échantillon au hasard du pool, pour une partie. Ouvert aux visiteurs
-- sans compte : l'hôte d'une table n'a pas besoin d'être connecté.
create or replace function public.random_truth_questions(p_themes text[], p_limit int default 60)
returns table (id uuid, content text, theme text, author text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.content, q.theme, p.username
    from public.truth_questions q
    left join public.profiles p on p.id = q.creator_id
   where not q.hidden
     and q.theme = any (coalesce(p_themes, array[]::text[]))
   order by random()
   limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

-- Compte un tirage. Sans enjeu : un client peut gonfler le compteur, rien de plus.
create or replace function public.mark_truth_question_used(p_question_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.truth_questions
     set used_count = used_count + 1
   where id = p_question_id and not hidden;
$$;

-- Signale une question. Au troisième joueur différent, elle quitte le pool.
create or replace function public.report_truth_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._require_uid();
begin
  if not exists (select 1 from public.truth_questions where id = p_question_id) then
    raise exception 'Question introuvable.' using errcode = '22023';
  end if;

  insert into public.truth_question_reports (question_id, user_id)
  values (p_question_id, v_uid)
  on conflict do nothing;

  if found then
    update public.truth_questions
       set report_count = report_count + 1,
           hidden       = hidden or report_count + 1 >= 3
     where id = p_question_id;
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.add_truth_question(text, text)',
    'public.report_truth_question(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  foreach f in array array[
    'public.random_truth_questions(text[], int)',
    'public.mark_truth_question_used(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end;
$$;
