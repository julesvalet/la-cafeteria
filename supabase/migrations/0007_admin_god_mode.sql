-- ===========================================================================
-- PLAFEE — God mode
-- ===========================================================================
-- Le super admin modifie tout d'un joueur : pseudo, photo, bio, solde de FEES,
-- victoires et défaites par jeu, trophées, objets de boutique, badges.
--
-- Même règle que le reste : aucune écriture directe, une fonction en base qui
-- vérifie l'appelant. Ici, le rôle `super_admin` de `admin_users` — un admin
-- simple n'y a pas accès. Chaque modification laisse une ligne dans
-- `admin_logs` (action `god_edit`) : qui, quoi, pour qui, avant, après.
--
-- Les victoires et défaites ne sont pas des compteurs : tout (profil,
-- classements, trophées) se calcule à partir des lignes de `game_results`.
-- Ajuster un total, c'est donc ajouter ou retirer des lignes. Les lignes
-- ajoutées portent `details.admin`, 0 point de classement, et sont datées de
-- l'inscription du joueur avec un `seq` négatif : elles comptent dans les
-- totaux mais ne remontent ni dans les classements de la semaine, ni dans la
-- série en cours, ni en tête de l'historique. Pour baisser un total, on retire
-- d'abord ces lignes-là, puis les plus anciennes parties réelles.
--
-- À appliquer après 0006.
-- ===========================================================================

-- --- Super admin ---------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_users a on lower(a.email) = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null and a.role = 'super_admin'
  );
$$;

create or replace function public._require_super_admin()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Réservé au super admin.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- Le client sait s'il doit montrer l'onglet.
create or replace function public.my_standing()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'banned', exists (select 1 from public.player_bans where user_id = auth.uid()),
    'ban_reason', (select reason from public.player_bans where user_id = auth.uid()),
    'is_admin', public.is_admin(),
    'is_super_admin', public.is_super_admin(),
    'warnings', coalesce((
      select jsonb_agg(jsonb_build_object('message', w.message, 'created_at', w.created_at) order by w.created_at desc)
      from (select * from public.player_warnings where user_id = auth.uid() order by created_at desc limit 5) w
    ), '[]'::jsonb)
  );
$$;

-- La recherche de joueurs accepte aussi un identifiant exact.
create or replace function public.admin_players(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  user_id uuid, username text, email text, avatar text, created_at timestamptz, games bigint, wins bigint,
  losses bigint, trophies bigint, balance bigint, banned boolean, ban_reason text, warnings bigint, last_seen timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public._require_admin();
  return query
  select p.id, p.username, u.email::text, p.avatar, p.created_at,
         (select count(*) from public.game_results g where g.user_id = p.id),
         (select count(*) from public.game_results g where g.user_id = p.id and g.won),
         (select count(*) from public.game_results g where g.user_id = p.id and not g.won),
         (select count(*) from public.user_achievements ua where ua.user_id = p.id and ua.unlocked_at is not null),
         coalesce((select f.balance from public.user_fees f where f.user_id = p.id), 0),
         exists (select 1 from public.player_bans b where b.user_id = p.id),
         (select b.reason from public.player_bans b where b.user_id = p.id),
         (select count(*) from public.player_warnings w where w.user_id = p.id),
         (select ls.seen_at from public.last_seen ls where ls.user_id = p.id)
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p_search is null or btrim(p_search) = ''
     or p.username ilike '%' || btrim(p_search) || '%' or u.email ilike '%' || btrim(p_search) || '%'
     or p.id::text = lower(btrim(p_search))
  order by (select count(*) from public.game_results g where g.user_id = p.id) desc, p.username
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- --- Photos : le super admin écrit dans le dossier de n'importe quel joueur ------

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  execute 'drop policy if exists avatars_super_admin_insert on storage.objects';
  execute $p$create policy avatars_super_admin_insert on storage.objects
    for insert to authenticated with check (bucket_id = 'avatars' and name like 'users/%' and public.is_super_admin())$p$;
  execute 'drop policy if exists avatars_super_admin_update on storage.objects';
  execute $p$create policy avatars_super_admin_update on storage.objects
    for update to authenticated using (bucket_id = 'avatars' and public.is_super_admin())
    with check (bucket_id = 'avatars' and name like 'users/%' and public.is_super_admin())$p$;
  execute 'drop policy if exists avatars_super_admin_delete on storage.objects';
  execute $p$create policy avatars_super_admin_delete on storage.objects
    for delete to authenticated using (bucket_id = 'avatars' and public.is_super_admin())$p$;
  -- L'envoi écrase le fichier (x-upsert) : il faut aussi pouvoir le lire.
  execute 'drop policy if exists avatars_super_admin_select on storage.objects';
  execute $p$create policy avatars_super_admin_select on storage.objects
    for select to authenticated using (bucket_id = 'avatars' and public.is_super_admin())$p$;
end;
$$;

-- --- Internes --------------------------------------------------------------------

-- « Jules a modifié Victoires Scopa pour Alice : 12 → 40 ».
create or replace function public._god_log(p_user uuid, p_username text, p_what text, p_from jsonb, p_to jsonb)
returns void
language sql
set search_path = public, pg_temp
as $$
  select public._admin_log('god_edit', p_user::text,
    jsonb_build_object('user', p_username, 'what', p_what, 'from', p_from, 'to', p_to));
$$;

-- Amène le nombre de victoires (ou de défaites) d'un joueur à un jeu à
-- `p_target`. Renvoie l'ancien nombre.
create or replace function public._god_set_results(p_user uuid, p_game text, p_won boolean, p_target int)
returns int
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_old int;
  v_at  timestamptz;
  v_seq text := pg_get_serial_sequence('public.game_results', 'seq');
begin
  select count(*) into v_old
  from public.game_results where user_id = p_user and game_type = p_game and won = p_won;

  if p_target > v_old then
    select created_at into v_at from public.profiles where id = p_user;
    -- Une session par ligne : (session_id, user_id) est unique.
    with s as (
      insert into public.game_sessions (session_key, game_type, player_count, ended_at)
      select 'admin:' || gen_random_uuid(), p_game, 1, v_at
      from generate_series(1, p_target - v_old)
      returning id
    )
    insert into public.game_results (session_id, user_id, game_type, won, score, points, created_at, seq, details)
    select s.id, p_user, p_game, p_won, 0, 0, v_at, -nextval(v_seq::regclass), '{"admin": true}'::jsonb
    from s;
  elsif p_target < v_old then
    delete from public.game_results
    where id in (
      select id from public.game_results
      where user_id = p_user and game_type = p_game and won = p_won
      order by (details ? 'admin') desc, seq
      limit v_old - p_target
    );
    -- Les sessions fabriquées qui n'ont plus de joueur.
    delete from public.game_sessions s
    where s.session_key like 'admin:%' and s.game_type = p_game
      and not exists (select 1 from public.game_results r where r.session_id = s.id);
  end if;
  return v_old;
end;
$$;

-- --- Lecture : tout ce que le panneau affiche, en un appel -------------------------

create or replace function public.admin_god_load(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_out jsonb;
begin
  perform public._require_super_admin();
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Joueur introuvable.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'profile', (
      select jsonb_build_object('id', p.id, 'username', p.username, 'email', u.email, 'avatar', p.avatar,
                                'bio', p.bio, 'created_at', p.created_at,
                                'banned', exists (select 1 from public.player_bans b where b.user_id = p.id))
      from public.profiles p left join auth.users u on u.id = p.id where p.id = p_user
    ),
    'fees', coalesce((
      select jsonb_build_object('balance', f.balance, 'lifetime_earned', f.lifetime_earned, 'lifetime_spent', f.lifetime_spent)
      from public.user_fees f where f.user_id = p_user
    ), jsonb_build_object('balance', 0, 'lifetime_earned', 0, 'lifetime_spent', 0)),
    'stats', (
      select jsonb_agg(jsonb_build_object(
               'game', t.id, 'label', t.label,
               'wins',   (select count(*) from public.game_results r where r.user_id = p_user and r.game_type = t.id and r.won),
               'losses', (select count(*) from public.game_results r where r.user_id = p_user and r.game_type = t.id and not r.won),
               'added',  (select count(*) from public.game_results r where r.user_id = p_user and r.game_type = t.id and r.details ? 'admin'))
             order by t.sort_order)
      from public.game_types t
    ),
    'trophies', coalesce((
      select jsonb_agg(jsonb_build_object('id', ua.achievement_id, 'unlocked_at', ua.unlocked_at))
      from public.user_achievements ua where ua.user_id = p_user and ua.unlocked_at is not null
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', sp.item_id, 'equipped', sp.equipped, 'custom_text', sp.custom_text,
                                          'purchased_at', sp.purchased_at))
      from public.user_shop_purchases sp where sp.user_id = p_user
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('badge_id', ub.badge_id, 'note', ub.note, 'awarded_at', ub.awarded_at))
      from public.user_badges ub where ub.user_id = p_user
    ), '[]'::jsonb),
    -- Les catalogues, pour cocher ce qui manque.
    'catalog', jsonb_build_object(
      'trophies', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'tier', a.tier, 'icon', a.icon,
                                            'category', a.category, 'image_url', a.image_url, 'active', a.active)
               order by a.sort_order, a.id)
        from public.achievements a
      ), '[]'::jsonb),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'category', i.category, 'price', i.price,
                                            'is_default', i.is_default, 'is_active', i.is_active, 'payload', i.payload)
               order by i.category, i.sort_order, i.name)
        from public.shop_items i
      ), '[]'::jsonb),
      'badges', coalesce((
        select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'type', b.type, 'rarity', b.rarity,
                                            'style', b.style, 'image_url', b.image_url, 'sku', b.sku)
               order by b.name)
        from public.badges b
      ), '[]'::jsonb)
    )
  ) into v_out;
  return v_out;
end;
$$;

-- --- Écriture : un seul enregistrement, tout ou rien -------------------------------
--
-- p_changes, chaque clé facultative :
--   profile      {username?, avatar?, bio?}
--   fees_balance nombre (le solde voulu)
--   stats        [{game, wins, losses}]
--   trophies     {add: [id], remove: [id]}
--   items        {add: [{item_id, custom_text?}], remove: [item_id], equip: [{category, item_id|null}]}
--   badges       {add: [id], remove: [id]}
create or replace function public.admin_god_save(p_user uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin   uuid := public._require_super_admin();
  v_p       public.profiles%rowtype;
  v_c       jsonb := coalesce(p_changes, '{}'::jsonb);
  v         jsonb;
  v_text    text;
  v_num     bigint;
  v_old     bigint;
  v_changed boolean := false;
  r         record;
  a         public.achievements%rowtype;
  i         public.shop_items%rowtype;
  v_badge   uuid;
  v_name    text;
  v_count   int := 0;
begin
  select * into v_p from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Joueur introuvable.' using errcode = '22023';
  end if;

  -- Profil ---------------------------------------------------------------------
  v := v_c -> 'profile';
  if jsonb_typeof(v) = 'object' then
    if v ? 'username' then
      v_text := btrim(coalesce(v ->> 'username', ''));
      if v_text is distinct from v_p.username then
        if v_text !~ '^[A-Za-z0-9_]{3,20}$' then
          raise exception 'Pseudo : 3 à 20 caractères, lettres, chiffres ou _.' using errcode = '22023';
        end if;
        if exists (select 1 from public.profiles where lower(username) = lower(v_text) and id <> p_user) then
          raise exception 'Ce pseudo est déjà pris.' using errcode = '23505';
        end if;
        update public.profiles set username = v_text where id = p_user;
        perform public._god_log(p_user, v_p.username, 'Pseudo', to_jsonb(v_p.username), to_jsonb(v_text));
        v_count := v_count + 1;
      end if;
    end if;

    if v ? 'avatar' then
      v_text := nullif(btrim(coalesce(v ->> 'avatar', '')), '');
      if v_text is distinct from v_p.avatar then
        if v_text is not null and (v_text !~ '^https://'
            or strpos(v_text, '/storage/v1/object/public/avatars/users/' || p_user::text || '/') = 0) then
          raise exception 'Photo invalide : elle doit être déposée dans le dossier du joueur.' using errcode = '22023';
        end if;
        update public.profiles set avatar = v_text where id = p_user;
        perform public._god_log(p_user, v_p.username, 'Photo', to_jsonb(v_p.avatar), to_jsonb(v_text));
        v_count := v_count + 1;
      end if;
    end if;

    if v ? 'bio' then
      v_text := nullif(btrim(coalesce(v ->> 'bio', '')), '');
      if v_text is distinct from v_p.bio then
        if char_length(coalesce(v_text, '')) > 200 then
          raise exception 'Bio : 200 caractères au maximum.' using errcode = '22023';
        end if;
        update public.profiles set bio = v_text where id = p_user;
        perform public._god_log(p_user, v_p.username, 'Bio', to_jsonb(v_p.bio), to_jsonb(v_text));
        v_count := v_count + 1;
      end if;
    end if;
  end if;

  -- Solde de FEES ----------------------------------------------------------------
  if v_c ? 'fees_balance' and jsonb_typeof(v_c -> 'fees_balance') = 'number' then
    v_num := (v_c ->> 'fees_balance')::numeric::bigint;
    if v_num < 0 or v_num > 1000000000000 then
      raise exception 'Solde invalide.' using errcode = '22023';
    end if;
    v_old := coalesce((select balance from public.user_fees where user_id = p_user), 0);
    if v_num <> v_old then
      perform public._fees_add(p_user, v_num - v_old, case when v_num > v_old then 'admin_grant' else 'admin_revoke' end,
        v_admin::text, 'Solde ajusté par l''admin', false);
      perform public._god_log(p_user, v_p.username, 'Solde FEES', to_jsonb(v_old), to_jsonb(v_num));
      v_count := v_count + 1;
    end if;
  end if;

  -- Victoires et défaites par jeu ------------------------------------------------
  if jsonb_typeof(v_c -> 'stats') = 'array' then
    for r in select * from jsonb_to_recordset(v_c -> 'stats') as x(game text, wins int, losses int) loop
      select label into v_name from public.game_types where id = r.game;
      if v_name is null then
        raise exception 'Jeu inconnu : %.', r.game using errcode = '22023';
      end if;
      if r.wins is null or r.losses is null or r.wins < 0 or r.losses < 0 or r.wins > 50000 or r.losses > 50000 then
        raise exception '% : de 0 à 50 000 victoires et défaites.', v_name using errcode = '22023';
      end if;
      v_old := public._god_set_results(p_user, r.game, true, r.wins);
      if v_old <> r.wins then
        perform public._god_log(p_user, v_p.username, 'Victoires ' || v_name, to_jsonb(v_old), to_jsonb(r.wins));
        v_changed := true;
        v_count := v_count + 1;
      end if;
      v_old := public._god_set_results(p_user, r.game, false, r.losses);
      if v_old <> r.losses then
        perform public._god_log(p_user, v_p.username, 'Défaites ' || v_name, to_jsonb(v_old), to_jsonb(r.losses));
        v_changed := true;
        v_count := v_count + 1;
      end if;
    end loop;
    -- De nouveaux totaux peuvent débloquer des trophées. Les retraits
    -- explicites plus bas passent après, et ont donc le dernier mot.
    if v_changed then
      perform public._evaluate_achievements(p_user);
    end if;
  end if;

  -- Trophées ---------------------------------------------------------------------
  v := v_c -> 'trophies';
  if jsonb_typeof(v) = 'object' then
    for v_text in select jsonb_array_elements_text(coalesce(v -> 'add', '[]'::jsonb)) loop
      select * into a from public.achievements where id = v_text;
      if not found then
        raise exception 'Trophée inconnu : %.', v_text using errcode = '22023';
      end if;
      insert into public.user_achievements as ua (user_id, achievement_id, progress, unlocked_at, updated_at)
      values (p_user, a.id, a.goal, now(), now())
      on conflict (user_id, achievement_id) do update
        set progress = greatest(ua.progress, a.goal), unlocked_at = now(), updated_at = now()
        where ua.unlocked_at is null;
      if found then
        perform public._god_log(p_user, v_p.username, 'Trophée « ' || a.title || ' »', '"verrouillé"', '"débloqué"');
        v_count := v_count + 1;
      end if;
    end loop;
    for v_text in select jsonb_array_elements_text(coalesce(v -> 'remove', '[]'::jsonb)) loop
      delete from public.user_achievements where user_id = p_user and achievement_id = v_text and unlocked_at is not null;
      if found then
        select title into v_name from public.achievements where id = v_text;
        perform public._god_log(p_user, v_p.username, 'Trophée « ' || coalesce(v_name, v_text) || ' »', '"débloqué"', '"retiré"');
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  -- Objets de boutique -----------------------------------------------------------
  v := v_c -> 'items';
  if jsonb_typeof(v) = 'object' then
    for r in select * from jsonb_to_recordset(coalesce(v -> 'add', '[]'::jsonb)) as x(item_id uuid, custom_text text) loop
      select * into i from public.shop_items where id = r.item_id;
      if not found then
        raise exception 'Objet inconnu.' using errcode = '22023';
      end if;
      if i.is_default then
        continue; -- gratuit pour tout le monde : rien à posséder
      end if;
      v_text := null;
      if i.payload ? 'custom' then
        v_text := upper(btrim(coalesce(r.custom_text, '')));
        if v_text !~ '^[A-Z0-9 !?]{1,5}$' then
          raise exception 'Plaque perso : 1 à 5 caractères (lettres, chiffres, espace, ! ou ?).' using errcode = '22023';
        end if;
      end if;
      insert into public.user_shop_purchases (user_id, item_id, equipped, custom_text)
      values (p_user, i.id, false, v_text)
      on conflict (user_id, item_id) do nothing;
      if found then
        if i.category = 'badge' then
          select id into v_badge from public.badges where sku = i.payload ->> 'badge_sku';
          if v_badge is not null then
            perform public._award_badge(p_user, v_badge, null, v_admin);
          end if;
        end if;
        perform public._god_log(p_user, v_p.username, 'Objet « ' || i.name || coalesce(' : ' || v_text, '') || ' »', '"absent"', '"ajouté"');
        v_count := v_count + 1;
      end if;
    end loop;

    for r in select * from jsonb_array_elements_text(coalesce(v -> 'remove', '[]'::jsonb)) as x(item_id) loop
      select * into i from public.shop_items where id = r.item_id::uuid;
      delete from public.user_shop_purchases where user_id = p_user and item_id = r.item_id::uuid;
      if found then
        if i.category = 'badge' then
          delete from public.user_badges ub using public.badges b
          where ub.badge_id = b.id and ub.user_id = p_user and b.sku = i.payload ->> 'badge_sku';
        end if;
        perform public._god_log(p_user, v_p.username, 'Objet « ' || coalesce(i.name, r.item_id) || ' »', '"possédé"', '"retiré"');
        v_count := v_count + 1;
      end if;
    end loop;

    -- Un objet équipé par rayon ; sans objet, retour au défaut.
    for r in select * from jsonb_to_recordset(coalesce(v -> 'equip', '[]'::jsonb)) as x(category text, item_id uuid) loop
      i := null;
      if r.category is null or r.category = 'badge' then
        continue;
      end if;
      select si.name into v_name from public.user_shop_purchases sp join public.shop_items si on si.id = sp.item_id
      where sp.user_id = p_user and sp.equipped and si.category = r.category limit 1;
      if r.item_id is not null then
        select * into i from public.shop_items where id = r.item_id and category = r.category;
        if not found then
          raise exception 'Objet inconnu dans ce rayon.' using errcode = '22023';
        end if;
        if not i.is_default and not exists (select 1 from public.user_shop_purchases where user_id = p_user and item_id = i.id) then
          raise exception 'Le joueur ne possède pas « % ».', i.name using errcode = '22023';
        end if;
      end if;
      update public.user_shop_purchases set equipped = coalesce(item_id = r.item_id, false) and not coalesce(i.is_default, false)
      where user_id = p_user and item_id in (select id from public.shop_items where category = r.category);
      if coalesce(v_name, '') is distinct from coalesce(case when r.item_id is not null and not i.is_default then i.name end, '') then
        perform public._god_log(p_user, v_p.username, 'Équipé (' || r.category || ')',
          to_jsonb(coalesce(v_name, 'défaut')), to_jsonb(coalesce(case when r.item_id is not null and not i.is_default then i.name end, 'défaut')));
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  -- Badges -----------------------------------------------------------------------
  v := v_c -> 'badges';
  if jsonb_typeof(v) = 'object' then
    for v_text in select jsonb_array_elements_text(coalesce(v -> 'add', '[]'::jsonb)) loop
      select name into v_name from public.badges where id = v_text::uuid;
      if v_name is null then
        raise exception 'Badge inconnu.' using errcode = '22023';
      end if;
      if public._award_badge(p_user, v_text::uuid, null, v_admin) then
        perform public._god_log(p_user, v_p.username, 'Badge « ' || v_name || ' »', '"absent"', '"attribué"');
        v_count := v_count + 1;
      end if;
    end loop;
    for v_text in select jsonb_array_elements_text(coalesce(v -> 'remove', '[]'::jsonb)) loop
      delete from public.user_badges where user_id = p_user and badge_id = v_text::uuid;
      if found then
        select name into v_name from public.badges where id = v_text::uuid;
        perform public._god_log(p_user, v_p.username, 'Badge « ' || coalesce(v_name, v_text) || ' »', '"attribué"', '"retiré"');
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object('changes', v_count, 'state', public.admin_god_load(p_user));
end;
$$;

-- --- Droits --------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'public._require_super_admin()', 'public._god_log(uuid, text, text, jsonb, jsonb)',
    'public._god_set_results(uuid, text, boolean, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;

  foreach f in array array[
    'public.my_standing()', 'public.admin_players(text, int, int)',
    'public.admin_god_load(uuid)', 'public.admin_god_save(uuid, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  -- Lu par les policies du stockage.
  execute 'revoke all on function public.is_super_admin() from public';
  execute 'grant execute on function public.is_super_admin() to anon, authenticated';
end;
$$;
