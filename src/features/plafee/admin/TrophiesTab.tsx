import { useEffect, useState, type FormEvent } from 'react';
import { Gift, Pencil, Plus, Trash2 } from 'lucide-react';
import { getSupabase } from '../../../lib/supabase';
import { GAME_LABELS, type GameTypeId } from '../../account/types';
import { achievementIcon, ICON_NAMES } from '../../achievements/icons';
import { CATEGORY_LABELS, type Achievement, type Category } from '../../achievements/api';
import { getProfileByUsername } from '../../social/api';
import { TIER_LABELS, TIERS, type Tier } from '../api';
import { RarityTag } from '../components/bits';
import { awardTrophy, deleteTrophy, upsertTrophy, type TrophyInput } from './adminApi';
import { ConfirmAction, Field, Flash, ImagePicker } from './ui';
import { GAME_OPTIONS, useFlash } from './helpers';

const METRICS: { value: TrophyInput['metric']; label: string }[] = [
  { value: 'wins', label: 'Victoires' },
  { value: 'games', label: 'Parties jouées' },
  { value: 'manual', label: 'Personnalisé (décerné à la main)' },
];

const EMPTY: TrophyInput = {
  id: null,
  title: '',
  description: '',
  category: 'special',
  tier: 'bronze',
  goal: 10,
  metric: 'wins',
  game: null,
  icon: 'Award',
  image_url: null,
  active: true,
};

const METRIC_TEXT: Record<Achievement['metric'], string> = {
  builtin: 'Calcul intégré',
  wins: 'Victoires',
  games: 'Parties',
  manual: 'À la main',
  event: 'Événement',
};

async function listAll(): Promise<Achievement[]> {
  const { data, error } = await (await getSupabase()).from('achievements').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as Achievement[];
}

export function TrophiesTab() {
  const [list, setList] = useState<Achievement[] | null>(null);
  const [form, setForm] = useState<TrophyInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, flash] = useFlash();
  const [nonce, setNonce] = useState(0);
  const [awarding, setAwarding] = useState<Achievement | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAll()
      .then((l) => !cancelled && setList(l))
      .catch((e: unknown) => flash('error', e instanceof Error ? e.message : 'Chargement impossible.'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const builtin = form.metric === 'builtin';
  const set = <K extends keyof TrophyInput>(k: K, v: TrophyInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const edit = (a: Achievement) => {
    setForm({
      id: a.id,
      title: a.title,
      description: a.description,
      category: a.category,
      tier: a.tier,
      goal: a.goal,
      metric: a.metric === 'event' ? 'manual' : a.metric,
      game: a.game,
      icon: a.icon,
      image_url: a.image_url,
      active: a.active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 2 || form.description.trim().length < 3) {
      flash('error', 'Un nom et une description, s’il te plaît.');
      return;
    }
    setBusy(true);
    try {
      await upsertTrophy({ ...form, goal: Math.max(1, Math.trunc(form.goal)) });
      flash('ok', form.id ? 'Trophée modifié.' : 'Trophée créé : la progression se calcule à la prochaine partie de chacun.');
      setForm(EMPTY);
      setNonce((n) => n + 1);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const Icon = achievementIcon(form.icon);

  return (
    <div className="adm-stack">
      <form className="acc-card acc-card-wide adm-form" onSubmit={submit}>
        <h2 className="acc-section-title">
          {form.id ? <Pencil size={17} aria-hidden /> : <Plus size={17} aria-hidden />} {form.id ? `Modifier « ${form.title} »` : 'Créer un trophée'}
        </h2>
        {builtin && <p className="neon-hint">Trophée intégré : son calcul est fixé en base. Tu peux changer ses textes, sa rareté, son seuil et son image.</p>}
        <div className="adm-grid-2">
          <Field label="Nom">
            <input className="neon-input" value={form.title} maxLength={40} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Rareté">
            <select className="neon-input" value={form.tier} onChange={(e) => set('tier', e.target.value as Tier)}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          {!builtin && (
            <>
              <Field label="Jeu">
                <select className="neon-input" value={form.game ?? ''} onChange={(e) => set('game', e.target.value || null)}>
                  {GAME_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type d'objectif">
                <select className="neon-input" value={form.metric} onChange={(e) => set('metric', e.target.value as TrophyInput['metric'])}>
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Nombre requis">
            <input className="neon-input" type="number" min={1} value={form.goal} onChange={(e) => set('goal', Number(e.target.value))} />
          </Field>
          {!builtin && (
            <Field label="Catégorie">
              <select className="neon-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {(Object.keys(CATEGORY_LABELS) as Category[])
                  .filter((c) => c !== 'evenement')
                  .map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field label="Icône">
            <span className="adm-icon-select">
              <Icon size={20} aria-hidden />
              <select className="neon-input" value={form.icon} onChange={(e) => set('icon', e.target.value)}>
                {ICON_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </span>
          </Field>
          <Field label="Image (remplace l'icône)">
            <ImagePicker value={form.image_url} onChange={(url) => set('image_url', url)} folder="trophies" onError={(m) => flash('error', m)} />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            className="neon-input"
            rows={2}
            maxLength={200}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder={form.metric === 'wins' ? `Gagner ${form.goal} parties${form.game ? ` de ${GAME_LABELS[form.game as GameTypeId]}` : ''}.` : ''}
          />
        </Field>
        <label className="adm-check">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Visible dans le catalogue
        </label>
        <Flash msg={msg} />
        <div className="plf-actions">
          <button type="submit" className="neon-btn" data-variant="solid" disabled={busy}>
            {form.id ? 'Enregistrer' : 'Créer'}
          </button>
          {form.id && (
            <button type="button" className="neon-btn" data-variant="ghost" onClick={() => setForm(EMPTY)}>
              Annuler
            </button>
          )}
        </div>
      </form>

      <section className="acc-card acc-card-wide">
        <h2 className="acc-section-title">Trophées existants {list && <span className="soc-count">{list.length}</span>}</h2>
        {!list ? (
          <p className="neon-hint">Chargement…</p>
        ) : (
          <div className="acc-table-scroll">
            <table className="acc-table adm-table">
              <thead>
                <tr>
                  <th scope="col">Trophée</th>
                  <th scope="col">Jeu</th>
                  <th scope="col">Rareté</th>
                  <th scope="col" className="acc-col-opt">Objectif</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const I = achievementIcon(a.icon);
                  return (
                    <tr key={a.id} data-inactive={!a.active || undefined}>
                      <td>
                        <span className="adm-trophy-name">
                          {a.image_url ? <img src={a.image_url} alt="" /> : <I size={16} aria-hidden />}
                          <span>
                            <strong>{a.title}</strong>
                            <small>{a.description}</small>
                          </span>
                        </span>
                      </td>
                      <td>{a.game ? (GAME_LABELS[a.game as GameTypeId] ?? a.game) : CATEGORY_LABELS[a.category] ?? 'Global'}</td>
                      <td>
                        <RarityTag tier={a.tier} />
                      </td>
                      <td className="acc-col-opt">
                        {a.goal} · {METRIC_TEXT[a.metric]}
                        {!a.active && ' · masqué'}
                      </td>
                      <td>
                        <span className="adm-actions">
                          <button type="button" className="adm-icon-btn" onClick={() => edit(a)} aria-label={`Modifier ${a.title}`} title="Modifier">
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="adm-icon-btn" onClick={() => setAwarding(a)} aria-label={`Décerner ${a.title}`} title="Décerner à un joueur">
                            <Gift size={14} />
                          </button>
                          <ConfirmAction
                            label={<Trash2 size={14} aria-label={a.metric === 'builtin' ? 'Masquer' : 'Supprimer'} />}
                            confirm={a.metric === 'builtin' ? 'Masquer ?' : 'Supprimer ?'}
                            onConfirm={async () => {
                              try {
                                await deleteTrophy(a.id);
                                flash('ok', a.metric === 'builtin' ? 'Trophée masqué.' : 'Trophée supprimé.');
                                setNonce((n) => n + 1);
                              } catch (err) {
                                flash('error', err instanceof Error ? err.message : 'Suppression impossible.');
                              }
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {awarding && (
        <AwardForm
          trophy={awarding}
          onDone={(text, tone) => {
            flash(tone, text);
            if (tone === 'ok') setAwarding(null);
          }}
          onClose={() => setAwarding(null)}
        />
      )}
    </div>
  );
}

function AwardForm({ trophy, onDone, onClose }: { trophy: Achievement; onDone: (text: string, tone: 'ok' | 'error') => void; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const p = await getProfileByUsername(username.trim());
      if (!p) throw new Error('Joueur introuvable.');
      await awardTrophy(trophy.id, p.id);
      onDone(`« ${trophy.title} » décerné à ${p.username}.`, 'ok');
    } catch (err) {
      onDone(err instanceof Error ? err.message : 'Attribution impossible.', 'error');
    }
  };
  return (
    <form className="acc-card acc-card-wide adm-form" onSubmit={submit}>
      <h2 className="acc-section-title">
        <Gift size={17} aria-hidden /> Décerner « {trophy.title} »
      </h2>
      <Field label="Pseudo du joueur">
        <input className="neon-input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
      </Field>
      <div className="plf-actions">
        <button type="submit" className="neon-btn" data-variant="solid" disabled={!username.trim()}>
          Décerner
        </button>
        <button type="button" className="neon-btn" data-variant="ghost" onClick={onClose}>
          Annuler
        </button>
      </div>
    </form>
  );
}
