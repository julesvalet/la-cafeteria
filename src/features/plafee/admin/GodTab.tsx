import { useEffect, useId, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Coins, ImageUp, Loader2, Minus, Plus, Search, Sparkles, Swords, Tag, Trash2, UserCog, Zap } from 'lucide-react';
import { UserAvatar } from '../../social/components/UserAvatar';
import { achievementIcon } from '../../achievements/icons';
import { ACCEPT_ATTR, exportSquare, loadImage, removeAvatarFiles, uploadAvatar } from '../../account/avatarUpload';
import { BADGE_RARITY_LABELS, BADGE_TYPE_LABELS, SHOP_CATEGORIES, TIER_RANK } from '../api';
import { RarityTag } from '../components/bits';
import { formatFees } from '../format';
import { getAdminPlayers, godLoad, godSave, type AdminPlayer, type GodState } from './adminApi';
import { applyWinRate, diffDraft, draftFrom, MAX_RESULTS, parseCount, winRate, type GodDraft } from './god';
import { ConfirmAction, Field, Flash } from './ui';
import { fmtDate, useFlash } from './helpers';

type SetDraft = Dispatch<SetStateAction<GodDraft>>;

/**
 * God mode : tout modifier d'un joueur. Réservé au super admin (la base le
 * vérifie). Rien ne part avant « Sauvegarder » : un seul envoi, tout ou rien,
 * et une ligne de journal par modification.
 */
export function GodTab() {
  const [params, setParams] = useSearchParams();
  const target = params.get('joueur');
  const [state, setState] = useState<GodState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!target) {
      setState(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    godLoad(target)
      .then((s) => !cancelled && setState(s))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [target]);

  const pick = (userId: string) => {
    if (userId === target) return;
    if (dirty && !window.confirm('Des modifications ne sont pas sauvegardées. Changer de joueur quand même ?')) return;
    setDirty(false);
    setParams({ onglet: 'god', joueur: userId });
  };

  return (
    <div className="adm-stack god">
      <section className="acc-card acc-card-wide god-intro">
        <h2 className="acc-section-title">
          <Zap size={18} aria-hidden /> God mode
        </h2>
        <p className="neon-hint">
          Modifie tout d'un joueur : profil, solde, victoires, trophées, cosmétiques. Rien ne part avant « Sauvegarder », et chaque
          modification est inscrite au journal.
        </p>
        <PlayerPicker current={target} onPick={pick} />
      </section>

      {error && (
        <p className="neon-error" role="alert">
          {error}
        </p>
      )}
      {loading && !state && (
        <p className="neon-hint" role="status">
          Chargement du joueur…
        </p>
      )}
      {state && <GodEditor key={state.profile.id} state={state} onSaved={setState} onDirty={setDirty} />}
    </div>
  );
}

function PlayerPicker({ current, onPick }: { current: string | null; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminPlayer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setRows(await getAdminPlayers(query.trim(), 12, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="god-picker">
      <form className="adm-search" onSubmit={onSearch} role="search">
        <input
          className="neon-input"
          placeholder="Pseudo, e-mail ou identifiant"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher un joueur"
        />
        <button type="submit" className="neon-btn adm-btn" data-variant="solid" disabled={busy}>
          {busy ? <Loader2 size={14} className="neon-spin" aria-hidden /> : <Search size={14} aria-hidden />} Chercher
        </button>
      </form>
      {error && <p className="neon-error">{error}</p>}
      {rows &&
        (rows.length === 0 ? (
          <p className="soc-empty">Aucun joueur ne correspond.</p>
        ) : (
          <ul className="god-results">
            {rows.map((r) => (
              <li key={r.user_id}>
                <button type="button" className="god-result" aria-pressed={r.user_id === current} onClick={() => onPick(r.user_id)}>
                  <UserAvatar username={r.username} src={r.avatar} size={28} />
                  <span className="god-result-name">{r.username}</span>
                  <span className="god-result-mail">{r.email ?? '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function GodEditor({ state, onSaved, onDirty }: { state: GodState; onSaved: (s: GodState) => void; onDirty: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<GodDraft>(() => draftFrom(state));
  const [msg, flash] = useFlash();
  const diff = useMemo(() => diffDraft(state, draft), [state, draft]);
  const count = diff.lines.length;

  useEffect(() => onDirty(count > 0), [count, onDirty]);

  const save = async () => {
    if (diff.errors.length) return;
    const removedPhoto = state.profile.avatar && !draft.avatar;
    try {
      const r = await godSave(state.profile.id, diff.changes);
      if (removedPhoto) void removeAvatarFiles(state.profile.id);
      setDraft(draftFrom(r.state));
      onSaved(r.state);
      flash('ok', `${r.changes} modification${r.changes > 1 ? 's' : ''} enregistrée${r.changes > 1 ? 's' : ''}.`);
    } catch (e) {
      flash('error', e instanceof Error ? e.message : 'Sauvegarde impossible.');
    }
  };

  const p = state.profile;
  return (
    <>
      <section className="acc-card acc-card-wide god-who">
        <UserAvatar username={p.username} src={p.avatar} size={56} userId={p.id} />
        <div className="god-who-text">
          <h2 className="acc-section-title">{p.username}</h2>
          <p className="neon-hint">
            {p.email ?? 'e-mail inconnu'} · inscrit le {fmtDate(p.created_at)}
            {p.banned && (
              <>
                {' '}
                ·{' '}
                <span className="adm-pill" data-tone="danger">
                  Banni
                </span>
              </>
            )}
          </p>
          <p className="adm-mono">{p.id}</p>
        </div>
      </section>

      <div className="god-grid">
        <ProfileSection state={state} draft={draft} setDraft={setDraft} onError={(t) => flash('error', t)} />
        <StatsSection state={state} draft={draft} setDraft={setDraft} />
      </div>
      <TrophiesSection state={state} draft={draft} setDraft={setDraft} />
      <ItemsSection state={state} draft={draft} setDraft={setDraft} />
      <BadgesSection state={state} draft={draft} setDraft={setDraft} />

      <div className="god-savebar" data-dirty={count > 0 || undefined}>
        <Flash msg={msg} />
        {diff.errors.length > 0 && (
          <ul className="god-errors" role="alert">
            {diff.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="god-savebar-row">
          {count > 0 ? (
            <details className="god-pending">
              <summary>
                {count} modification{count > 1 ? 's' : ''} en attente
              </summary>
              <ul>
                {diff.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="neon-hint">Aucune modification.</span>
          )}
          <div className="adm-actions">
            <button type="button" className="neon-btn adm-btn" data-variant="ghost" disabled={count === 0} onClick={() => setDraft(draftFrom(state))}>
              Annuler
            </button>
            <ConfirmAction
              variant="solid"
              label={<>Sauvegarder modifs</>}
              confirm={`Confirmer (${count})`}
              disabled={count === 0 || diff.errors.length > 0}
              onConfirm={save}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// --- Profil et FEES -----------------------------------------------------------------

function ProfileSection({ state, draft, setDraft, onError }: { state: GodState; draft: GodDraft; setDraft: SetDraft; onError: (t: string) => void }) {
  const fileId = useId();
  const [uploading, setUploading] = useState(false);
  const balance = parseCount(draft.balance);
  const delta = balance === null ? null : balance - state.fees.balance;

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const bitmap = await loadImage(file);
      const blob = await exportSquare(bitmap, { zoom: 1, x: 0, y: 0 });
      bitmap.close();
      const url = await uploadAvatar(state.profile.id, blob, () => {});
      setDraft((d) => ({ ...d, avatar: url }));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="acc-card acc-card-wide god-card">
      <h3 className="adm-block-title">
        <UserCog size={15} aria-hidden /> Profil
      </h3>
      <div className="god-photo">
        <UserAvatar username={draft.username || state.profile.username} src={draft.avatar} size={64} />
        <div className="adm-actions">
          <label htmlFor={fileId} className="neon-btn adm-btn" data-variant="ghost">
            {uploading ? <Loader2 size={14} className="neon-spin" aria-hidden /> : <ImageUp size={14} aria-hidden />}
            Changer la photo
          </label>
          <input
            id={fileId}
            type="file"
            accept={ACCEPT_ATTR}
            className="adm-file"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onFile(f);
            }}
          />
          {draft.avatar && (
            <button type="button" className="neon-btn adm-btn" data-variant="ghost" onClick={() => setDraft((d) => ({ ...d, avatar: null }))}>
              <Trash2 size={14} aria-hidden /> Retirer
            </button>
          )}
        </div>
      </div>
      <small className="neon-hint">La nouvelle photo est recadrée au centre et déposée tout de suite ; « Sauvegarder » l'attache au profil.</small>
      <Field label="Pseudo" hint="3 à 20 caractères : lettres, chiffres ou _.">
        <input className="neon-input" value={draft.username} maxLength={20} onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))} />
      </Field>
      <Field label={`Bio (${draft.bio.trim().length}/200)`}>
        <textarea className="neon-input" rows={3} maxLength={200} value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} />
      </Field>

      <h3 className="adm-block-title god-subtitle">
        <Coins size={15} aria-hidden /> Solde FEES
      </h3>
      <Field
        label="Nouveau solde"
        hint={`Actuel : ${formatFees(state.fees.balance)} · gagnés au total : ${formatFees(state.fees.lifetime_earned)} · dépensés : ${formatFees(state.fees.lifetime_spent)}`}
      >
        <input className="neon-input" inputMode="numeric" value={draft.balance} onChange={(e) => setDraft((d) => ({ ...d, balance: e.target.value }))} />
      </Field>
      {delta !== null && delta !== 0 && (
        <p className="god-delta" data-sign={delta > 0 ? 'plus' : 'minus'}>
          {delta > 0 ? '+' : '−'}
          {formatFees(Math.abs(delta))} FEES
        </p>
      )}
    </section>
  );
}

// --- Statistiques -------------------------------------------------------------------

function StatsSection({ state, draft, setDraft }: { state: GodState; draft: GodDraft; setDraft: SetDraft }) {
  const rows = state.stats.map((g) => ({
    ...g,
    w: parseCount(draft.stats[g.game]?.wins ?? '', MAX_RESULTS),
    l: parseCount(draft.stats[g.game]?.losses ?? '', MAX_RESULTS),
  }));
  const valid = rows.every((r) => r.w !== null && r.l !== null);
  const numeric = rows.map((r) => ({ game: r.game, wins: r.w ?? 0, losses: r.l ?? 0 }));
  const rate = valid ? winRate(numeric) : null;
  const before = winRate(state.stats);
  const rateText = rate === null ? '' : String(Math.round(rate * 10) / 10);

  const setCell = (game: string, key: 'wins' | 'losses', value: string) =>
    setDraft((d) => ({ ...d, stats: { ...d.stats, [game]: { ...d.stats[game], [key]: value } } }));

  const applyRate = (value: number) =>
    setDraft((d) => ({
      ...d,
      stats: Object.fromEntries(applyWinRate(numeric, value).map((r) => [r.game, { wins: String(r.wins), losses: String(r.losses) }])),
    }));

  return (
    <section className="acc-card acc-card-wide god-card">
      <h3 className="adm-block-title">
        <Swords size={15} aria-hidden /> Statistiques
      </h3>
      {/* Remonté à chaque changement du tableau : le champ affiche toujours le taux réel. */}
      <RateInput key={rateText} initial={rateText} disabled={!valid || numeric.every((r) => r.wins + r.losses === 0)} onApply={applyRate} />
      <small className="neon-hint">
        Actuel : {before === null ? 'aucune partie' : `${Math.round(before * 10) / 10} %`}. Changer le taux répartit les victoires sans changer le nombre de
        parties de chaque jeu.
      </small>
      <div className="acc-table-scroll">
        <table className="acc-table adm-table god-stats">
          <thead>
            <tr>
              <th scope="col">Jeu</th>
              <th scope="col">Victoires</th>
              <th scope="col">Défaites</th>
              <th scope="col" className="acc-col-opt">
                Parties
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.game}>
                <th scope="row">
                  {r.label}
                  {r.added > 0 && <span className="adm-sub">dont {r.added} ajoutées</span>}
                </th>
                <td>
                  <input
                    className="neon-input god-num"
                    inputMode="numeric"
                    aria-label={`Victoires ${r.label}`}
                    aria-invalid={r.w === null || undefined}
                    value={draft.stats[r.game]?.wins ?? ''}
                    onChange={(e) => setCell(r.game, 'wins', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="neon-input god-num"
                    inputMode="numeric"
                    aria-label={`Défaites ${r.label}`}
                    aria-invalid={r.l === null || undefined}
                    value={draft.stats[r.game]?.losses ?? ''}
                    onChange={(e) => setCell(r.game, 'losses', e.target.value)}
                  />
                </td>
                <td className="acc-col-opt">{r.w !== null && r.l !== null ? r.w + r.l : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small className="neon-hint">
        Les parties ajoutées valent 0 point et sont datées de l'inscription : elles comptent dans le profil, les totaux et les trophées, pas dans
        les classements de la semaine. Pour baisser un total, elles partent en premier.
      </small>
    </section>
  );
}

function RateInput({ initial, disabled, onApply }: { initial: string; disabled: boolean; onApply: (rate: number) => void }) {
  const [value, setValue] = useState(initial);
  const n = Number(value.replace(',', '.'));
  const ok = value.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100;
  return (
    <form
      className="god-rate"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onApply(n);
      }}
    >
      <Field label="Win rate (%)">
        <input className="neon-input" inputMode="decimal" value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <button type="submit" className="neon-btn adm-btn" disabled={disabled || !ok || value === initial}>
        Appliquer
      </button>
    </form>
  );
}

// --- Trophées -----------------------------------------------------------------------

type OwnFilter = 'all' | 'owned' | 'missing';
const FILTERS: { id: OwnFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'owned', label: 'Possédés' },
  { id: 'missing', label: 'Manquants' },
];

function FilterTabs({ value, onChange }: { value: OwnFilter; onChange: (f: OwnFilter) => void }) {
  return (
    <div className="soc-tabs" role="group" aria-label="Filtrer">
      {FILTERS.map((f) => (
        <button key={f.id} type="button" className="soc-tab" aria-pressed={value === f.id} onClick={() => onChange(f.id)}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="god-toggle" data-on={on || undefined} onClick={onClick} aria-label={`${on ? 'Retirer' : 'Ajouter'} ${label}`}>
      {on ? <Minus size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
    </button>
  );
}

function TrophiesSection({ state, draft, setDraft }: { state: GodState; draft: GodDraft; setDraft: SetDraft }) {
  const [filter, setFilter] = useState<OwnFilter>('all');
  const [q, setQ] = useState('');
  const had = new Set(state.trophies.map((t) => t.id));
  const list = [...state.catalog.trophies]
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])
    .filter((t) => (filter === 'owned' ? draft.trophies.has(t.id) : filter === 'missing' ? !draft.trophies.has(t.id) : true))
    .filter((t) => !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = (id: string) =>
    setDraft((d) => {
      const next = new Set(d.trophies);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...d, trophies: next };
    });

  return (
    <section className="acc-card acc-card-wide god-card">
      <div className="adm-row-between">
        <h3 className="adm-block-title">
          <Award size={15} aria-hidden /> Trophées · {draft.trophies.size} / {state.catalog.trophies.length}
        </h3>
        <div className="adm-actions">
          <FilterTabs value={filter} onChange={setFilter} />
          <input className="neon-input god-filter" placeholder="Filtrer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrer les trophées" />
        </div>
      </div>
      <ul className="god-list">
        {list.map((t) => {
          const Icon = achievementIcon(t.icon);
          const on = draft.trophies.has(t.id);
          const changed = on !== had.has(t.id);
          return (
            <li key={t.id} className="god-row" data-on={on || undefined} data-changed={changed || undefined}>
              {t.image_url ? <img src={t.image_url} alt="" className="god-row-img" /> : <Icon size={18} aria-hidden className="god-row-icon" />}
              <span className="god-row-name">
                {t.title}
                {!t.active && <span className="adm-sub">inactif</span>}
              </span>
              <RarityTag tier={t.tier} />
              <Toggle on={on} label={`le trophée ${t.title}`} onClick={() => toggle(t.id)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- Cosmétiques --------------------------------------------------------------------

function ItemsSection({ state, draft, setDraft }: { state: GodState; draft: GodDraft; setDraft: SetDraft }) {
  const [filter, setFilter] = useState<OwnFilter>('all');
  const [plates, setPlates] = useState<Record<string, string>>({});
  const owned = new Set(state.items.map((i) => i.item_id));

  const toggle = (id: string, custom: boolean) =>
    setDraft((d) => {
      const items = new Map(d.items);
      const equipped = { ...d.equipped };
      if (items.has(id)) {
        items.delete(id);
        for (const [cat, eq] of Object.entries(equipped)) if (eq === id) equipped[cat as keyof typeof equipped] = null;
      } else {
        items.set(id, custom ? (plates[id] ?? '').toUpperCase() : null);
      }
      return { ...d, items, equipped };
    });

  return (
    <section className="acc-card acc-card-wide god-card">
      <div className="adm-row-between">
        <h3 className="adm-block-title">
          <Sparkles size={15} aria-hidden /> Cosmétiques · {draft.items.size} possédé{draft.items.size > 1 ? 's' : ''}
        </h3>
        <FilterTabs value={filter} onChange={setFilter} />
      </div>
      <div className="god-cats">
        {SHOP_CATEGORIES.map((cat) => {
          const items = state.catalog.items
            .filter((i) => i.category === cat.id)
            .filter((i) => (filter === 'owned' ? draft.items.has(i.id) || i.is_default : filter === 'missing' ? !draft.items.has(i.id) && !i.is_default : true));
          if (items.length === 0) return null;
          const equippable = cat.id !== 'badge';
          const current = draft.equipped[cat.id] ?? null;
          return (
            <fieldset key={cat.id} className="god-cat">
              <legend>{cat.label}</legend>
              <ul className="god-list">
                {items.map((i) => {
                  const on = i.is_default || draft.items.has(i.id);
                  const custom = Boolean(i.payload.custom);
                  const changed = !i.is_default && draft.items.has(i.id) !== owned.has(i.id);
                  const isEquipped = i.is_default ? current === null : current === i.id;
                  return (
                    <li key={i.id} className="god-row" data-on={on || undefined} data-changed={changed || undefined}>
                      <span className="god-row-name">
                        {i.name}
                        {custom && draft.items.get(i.id) && <span className="adm-sub">« {draft.items.get(i.id)} »</span>}
                        <span className="adm-sub">{i.is_default ? 'Gratuit, pour tous' : `${formatFees(i.price)} FEES${i.is_active ? '' : ' · retiré de la vente'}`}</span>
                      </span>
                      {equippable && on && (
                        <label className="adm-check god-equip">
                          <input
                            type="radio"
                            name={`equip-${cat.id}`}
                            checked={isEquipped}
                            onChange={() => setDraft((d) => ({ ...d, equipped: { ...d.equipped, [cat.id]: i.is_default ? null : i.id } }))}
                          />
                          Équipé
                        </label>
                      )}
                      {custom && !on && (
                        <input
                          className="neon-input god-plate"
                          placeholder="GOAT"
                          maxLength={5}
                          aria-label="Texte de la plaque perso"
                          value={plates[i.id] ?? ''}
                          onChange={(e) => setPlates((p) => ({ ...p, [i.id]: e.target.value.toUpperCase() }))}
                        />
                      )}
                      {!i.is_default && <Toggle on={on} label={i.name} onClick={() => toggle(i.id, custom)} />}
                    </li>
                  );
                })}
              </ul>
              {equippable && !items.some((i) => i.is_default) && draft.equipped[cat.id] && (
                <button type="button" className="adm-link god-unequip" onClick={() => setDraft((d) => ({ ...d, equipped: { ...d.equipped, [cat.id]: null } }))}>
                  Revenir au défaut
                </button>
              )}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

// --- Badges -------------------------------------------------------------------------

function BadgesSection({ state, draft, setDraft }: { state: GodState; draft: GodDraft; setDraft: SetDraft }) {
  const had = new Set(state.badges.map((b) => b.badge_id));
  const toggle = (id: string) =>
    setDraft((d) => {
      const next = new Set(d.badges);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...d, badges: next };
    });
  return (
    <section className="acc-card acc-card-wide god-card">
      <h3 className="adm-block-title">
        <Tag size={15} aria-hidden /> Badges · {draft.badges.size}
      </h3>
      {state.catalog.badges.length === 0 ? (
        <p className="soc-empty">Aucun badge créé.</p>
      ) : (
        <ul className="god-list god-list-cols">
          {state.catalog.badges.map((b) => {
            const Icon = achievementIcon(b.style.icon ?? 'Star');
            const on = draft.badges.has(b.id);
            return (
              <li key={b.id} className="god-row" data-on={on || undefined} data-changed={on !== had.has(b.id) || undefined}>
                {b.image_url ? (
                  <img src={b.image_url} alt="" className="god-row-img" />
                ) : (
                  <Icon size={18} aria-hidden className="god-row-icon" style={{ color: b.style.color }} />
                )}
                <span className="god-row-name">
                  {b.name}
                  <span className="adm-sub">
                    {BADGE_TYPE_LABELS[b.type]} · {BADGE_RARITY_LABELS[b.rarity]}
                    {b.sku ? ' · boutique / auto' : ''}
                  </span>
                </span>
                <Toggle on={on} label={`le badge ${b.name}`} onClick={() => toggle(b.id)} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
