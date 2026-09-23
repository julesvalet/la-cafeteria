import { SHOP_CATEGORIES, type ShopCategory } from '../api';
import { formatFees } from '../format';
import type { GodChanges, GodState } from './adminApi';

/*
 * Le God mode côté client : un brouillon modifiable, tiré de l'état lu en
 * base, et la différence entre les deux. Seule la différence part au serveur,
 * qui l'applique en une transaction et journalise chaque ligne.
 */

export const MAX_RESULTS = 50_000;
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;
const PLATE = /^[A-Z0-9 !?]{1,5}$/;

export interface GodDraft {
  username: string;
  avatar: string | null;
  bio: string;
  /** Champs de saisie : du texte, validé au moment du calcul. */
  balance: string;
  stats: Record<string, { wins: string; losses: string }>;
  trophies: Set<string>;
  /** Objets possédés → texte de plaque perso éventuel. */
  items: Map<string, string | null>;
  /** L'objet équipé par rayon ; null = celui par défaut. */
  equipped: Partial<Record<ShopCategory, string | null>>;
  badges: Set<string>;
}

export function draftFrom(s: GodState): GodDraft {
  const equipped: GodDraft['equipped'] = {};
  for (const owned of s.items) {
    if (!owned.equipped) continue;
    const item = s.catalog.items.find((i) => i.id === owned.item_id);
    if (item) equipped[item.category] = item.id;
  }
  return {
    username: s.profile.username,
    avatar: s.profile.avatar,
    bio: s.profile.bio ?? '',
    balance: String(s.fees.balance),
    stats: Object.fromEntries(s.stats.map((g) => [g.game, { wins: String(g.wins), losses: String(g.losses) }])),
    trophies: new Set(s.trophies.map((t) => t.id)),
    items: new Map(s.items.map((i) => [i.item_id, i.custom_text])),
    equipped,
    badges: new Set(s.badges.map((b) => b.badge_id)),
  };
}

/** Un entier positif saisi, ou null s'il n'en est pas un. */
export function parseCount(raw: string, max = Number.MAX_SAFE_INTEGER): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= max ? n : null;
}

/** Le taux de victoire d'un ensemble de lignes, en %, ou null sans partie. */
export function winRate(rows: { wins: number; losses: number }[]): number | null {
  const wins = rows.reduce((s, r) => s + r.wins, 0);
  const games = rows.reduce((s, r) => s + r.wins + r.losses, 0);
  return games ? (wins / games) * 100 : null;
}

/**
 * Fixe le taux de victoire global sans changer le nombre de parties d'aucun
 * jeu : chaque jeu reçoit sa part des victoires voulues, au plus fort reste
 * pour que le total tombe juste.
 */
export function applyWinRate<T extends { wins: number; losses: number }>(rows: T[], rate: number): T[] {
  const r = Math.min(Math.max(rate, 0), 100) / 100;
  const games = rows.map((x) => x.wins + x.losses);
  const target = Math.round(games.reduce((s, g) => s + g, 0) * r);
  const quotas = games.map((g) => g * r);
  const wins = quotas.map(Math.floor);
  let left = target - wins.reduce((s, w) => s + w, 0);
  const order = quotas.map((q, i) => ({ i, frac: q - Math.floor(q) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    if (wins[i] < games[i]) {
      wins[i] += 1;
      left -= 1;
    }
  }
  return rows.map((x, i) => ({ ...x, wins: wins[i], losses: games[i] - wins[i] }));
}

export interface GodDiff {
  changes: GodChanges;
  /** Une ligne lisible par modification, pour le récapitulatif. */
  lines: string[];
  errors: string[];
}

const categoryLabel = (c: ShopCategory) => SHOP_CATEGORIES.find((x) => x.id === c)?.label ?? c;

export function diffDraft(s: GodState, d: GodDraft): GodDiff {
  const changes: GodChanges = {};
  const lines: string[] = [];
  const errors: string[] = [];

  // Profil
  const profile: NonNullable<GodChanges['profile']> = {};
  const username = d.username.trim();
  if (username !== s.profile.username) {
    if (!USERNAME.test(username)) errors.push('Pseudo : 3 à 20 caractères, lettres, chiffres ou _.');
    profile.username = username;
    lines.push(`Pseudo : ${s.profile.username} → ${username}`);
  }
  if (d.avatar !== s.profile.avatar) {
    profile.avatar = d.avatar;
    lines.push(d.avatar ? 'Photo : nouvelle photo' : 'Photo : retirée');
  }
  const bio = d.bio.trim();
  if (bio !== (s.profile.bio ?? '')) {
    if (bio.length > 200) errors.push('Bio : 200 caractères au maximum.');
    profile.bio = bio || null;
    lines.push(bio ? 'Bio modifiée' : 'Bio effacée');
  }
  if (Object.keys(profile).length) changes.profile = profile;

  // FEES
  const balance = parseCount(d.balance, 1_000_000_000_000);
  if (balance === null) errors.push('Solde FEES : un nombre entier positif.');
  else if (balance !== s.fees.balance) {
    changes.fees_balance = balance;
    lines.push(`Solde FEES : ${formatFees(s.fees.balance)} → ${formatFees(balance)}`);
  }

  // Victoires et défaites
  const stats: NonNullable<GodChanges['stats']> = [];
  for (const g of s.stats) {
    const draft = d.stats[g.game];
    if (!draft) continue;
    const wins = parseCount(draft.wins, MAX_RESULTS);
    const losses = parseCount(draft.losses, MAX_RESULTS);
    if (wins === null || losses === null) {
      errors.push(`${g.label} : de 0 à ${MAX_RESULTS.toLocaleString('fr-FR')} victoires et défaites.`);
      continue;
    }
    if (wins === g.wins && losses === g.losses) continue;
    stats.push({ game: g.game, wins, losses });
    if (wins !== g.wins) lines.push(`Victoires ${g.label} : ${g.wins} → ${wins}`);
    if (losses !== g.losses) lines.push(`Défaites ${g.label} : ${g.losses} → ${losses}`);
  }
  if (stats.length) changes.stats = stats;

  // Trophées
  const had = new Set(s.trophies.map((t) => t.id));
  const title = (id: string) => s.catalog.trophies.find((t) => t.id === id)?.title ?? id;
  const tAdd = [...d.trophies].filter((id) => !had.has(id));
  const tRemove = [...had].filter((id) => !d.trophies.has(id));
  if (tAdd.length || tRemove.length) {
    changes.trophies = { add: tAdd, remove: tRemove };
    tAdd.forEach((id) => lines.push(`+ Trophée « ${title(id)} »`));
    tRemove.forEach((id) => lines.push(`− Trophée « ${title(id)} »`));
  }

  // Objets de boutique
  const owned = new Map(s.items.map((i) => [i.item_id, i]));
  const item = (id: string) => s.catalog.items.find((i) => i.id === id);
  const iAdd: NonNullable<GodChanges['items']>['add'] = [];
  for (const [id, text] of d.items) {
    if (owned.has(id)) continue;
    const it = item(id);
    if (it?.payload.custom) {
      const plate = (text ?? '').trim().toUpperCase();
      if (!PLATE.test(plate)) errors.push(`${it.name} : 1 à 5 caractères (lettres, chiffres, espace, ! ou ?).`);
      iAdd.push({ item_id: id, custom_text: plate });
      lines.push(`+ Objet « ${it.name} : ${plate} »`);
    } else {
      iAdd.push({ item_id: id });
      lines.push(`+ Objet « ${it?.name ?? id} »`);
    }
  }
  const iRemove = [...owned.keys()].filter((id) => !d.items.has(id));
  iRemove.forEach((id) => lines.push(`− Objet « ${item(id)?.name ?? id} »`));

  const was = draftFrom(s).equipped;
  const equip: NonNullable<GodChanges['items']>['equip'] = [];
  for (const { id: cat } of SHOP_CATEGORIES) {
    if (cat === 'badge') continue;
    // Retirer l'objet équipé le déséquipe de lui-même : rien à envoyer.
    const before = was[cat] && d.items.has(was[cat]!) ? was[cat]! : null;
    const after = d.equipped[cat] ?? null;
    if (before === after) continue;
    equip.push({ category: cat, item_id: after });
    lines.push(`Équipé (${categoryLabel(cat)}) : ${before ? item(before)?.name : 'défaut'} → ${after ? item(after)?.name : 'défaut'}`);
  }
  if (iAdd.length || iRemove.length || equip.length) changes.items = { add: iAdd, remove: iRemove, equip };

  // Badges
  const hadB = new Set(s.badges.map((b) => b.badge_id));
  const badgeName = (id: string) => s.catalog.badges.find((b) => b.id === id)?.name ?? id;
  const bAdd = [...d.badges].filter((id) => !hadB.has(id));
  const bRemove = [...hadB].filter((id) => !d.badges.has(id));
  if (bAdd.length || bRemove.length) {
    changes.badges = { add: bAdd, remove: bRemove };
    bAdd.forEach((id) => lines.push(`+ Badge « ${badgeName(id)} »`));
    bRemove.forEach((id) => lines.push(`− Badge « ${badgeName(id)} »`));
  }

  return { changes, lines, errors };
}
