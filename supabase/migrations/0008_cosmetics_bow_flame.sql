-- ===========================================================================
-- PLAFEE — Nœud papillon et contour Flammes
-- ===========================================================================
-- Un nouveau rayon de boutique, les accessoires d'avatar : un objet posé sur
-- la photo (le nœud papillon, en haut à droite), qui se cumule avec le contour.
-- Et un contour de plus, les flammes.
--
-- `profile_cosmetics` gagne une colonne `accessory` : son type de retour
-- change, il faut donc la recréer.
--
-- À appliquer après 0007.
-- ===========================================================================

alter table public.shop_items drop constraint if exists shop_items_category_check;
alter table public.shop_items add constraint shop_items_category_check
  check (category in ('card_theme', 'site_theme', 'badge', 'profile_border', 'nameplate', 'victory_animation', 'avatar_accessory'));

insert into public.shop_items (sku, name, description, category, price, payload, requirement, is_default, sort_order) values
  ('border_flame',   'Contour Flammes',   'Ta photo prend feu. Littéralement.',         'profile_border',   700, '{"border":"flame"}',     '{}', false, 44),
  ('accessory_none', 'Sans accessoire',   'La photo, rien que la photo.',               'avatar_accessory', 0,   '{"accessory":null}',     '{}', true,  70),
  ('accessory_bow',  'Nœud papillon',     'Un nœud magenta, en haut à droite de ta photo.', 'avatar_accessory', 450, '{"accessory":"bow"}', '{}', false, 71)
on conflict (sku) do update
  set name = excluded.name, description = excluded.description, category = excluded.category,
      payload = excluded.payload, is_default = excluded.is_default, sort_order = excluded.sort_order;

drop function if exists public.profile_cosmetics(uuid[]);

create function public.profile_cosmetics(p_user_ids uuid[])
returns table (
  user_id uuid, border text, plate text, title text, site_skin text, card_skin text,
  victory_anim text, accessory text, badges jsonb, banned boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id,
    coalesce(
      (select i.payload ->> 'border' from public.user_shop_purchases p join public.shop_items i on i.id = p.item_id
        where p.user_id = u.id and p.equipped and i.category = 'profile_border' limit 1),
      (select coalesce(b.style ->> 'border', 'badge') from public.user_badges ub join public.badges b on b.id = ub.badge_id
        where ub.user_id = u.id and b.type = 'border' and b.is_active and (b.expiry_date is null or b.expiry_date > now())
        order by ub.awarded_at desc limit 1)
    ),
    coalesce(
      (select coalesce(p.custom_text, i.payload ->> 'plate') from public.user_shop_purchases p join public.shop_items i on i.id = p.item_id
        where p.user_id = u.id and p.equipped and i.category = 'nameplate' limit 1),
      (select b.name from public.user_badges ub join public.badges b on b.id = ub.badge_id
        where ub.user_id = u.id and b.type = 'plate' and b.is_active and (b.expiry_date is null or b.expiry_date > now())
        order by ub.awarded_at desc limit 1)
    ),
    (select coalesce(ub.note, b.name) from public.user_badges ub join public.badges b on b.id = ub.badge_id
      where ub.user_id = u.id and b.type = 'title' and b.is_active and (b.expiry_date is null or b.expiry_date > now())
      order by array_position(array['legendary','epic','rare','common'], b.rarity), ub.awarded_at desc limit 1),
    (select i.payload ->> 'skin' from public.user_shop_purchases p join public.shop_items i on i.id = p.item_id
      where p.user_id = u.id and p.equipped and i.category = 'site_theme' limit 1),
    (select i.payload ->> 'skin' from public.user_shop_purchases p join public.shop_items i on i.id = p.item_id
      where p.user_id = u.id and p.equipped and i.category = 'card_theme' limit 1),
    (select i.payload ->> 'anim' from public.user_shop_purchases p join public.shop_items i on i.id = p.item_id
      where p.user_id = u.id and p.equipped and i.category = 'victory_animation' limit 1),
    (select i.payload ->> 'accessory' from public.user_shop_purchases p join public.shop_items i on i.id = p.item_id
      where p.user_id = u.id and p.equipped and i.category = 'avatar_accessory' limit 1),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'name', b.name, 'description', b.description, 'type', b.type, 'rarity', b.rarity,
               'image_url', b.image_url, 'style', b.style, 'note', ub.note, 'awarded_at', ub.awarded_at,
               'expiry_date', b.expiry_date)
             order by array_position(array['legendary','epic','rare','common'], b.rarity), ub.awarded_at desc)
      from public.user_badges ub join public.badges b on b.id = ub.badge_id
      where ub.user_id = u.id and b.is_active and (b.expiry_date is null or b.expiry_date > now())
    ), '[]'::jsonb),
    exists (select 1 from public.player_bans pb where pb.user_id = u.id)
  from public.profiles u
  where u.id = any (p_user_ids[1:100]);
$$;

revoke all on function public.profile_cosmetics(uuid[]) from public;
grant execute on function public.profile_cosmetics(uuid[]) to anon, authenticated;
