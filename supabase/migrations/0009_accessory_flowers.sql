-- ===========================================================================
-- PLAFEE — Accessoire « Plantes japonaises »
-- ===========================================================================
-- Des fleurs de cerisier grises, nichées dans les coins de la photo
-- (public/cosmetics/flowers.svg). Un objet du rayon Accessoires : rien d'autre
-- à changer, profile_cosmetics renvoie déjà l'accessoire équipé (0008).
--
-- À appliquer après 0008.
-- ===========================================================================

insert into public.shop_items (sku, name, description, category, price, payload, requirement, is_default, sort_order) values
  ('accessory_flowers', 'Plantes japonaises', 'Des fleurs de cerisier grises, dans les coins de ta photo.', 'avatar_accessory', 200, '{"accessory":"flowers"}', '{}', false, 72)
on conflict (sku) do update
  set name = excluded.name, description = excluded.description, category = excluded.category,
      price = excluded.price, payload = excluded.payload, sort_order = excluded.sort_order;
