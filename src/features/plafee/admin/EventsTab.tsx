import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Square, Trash2, Users } from 'lucide-react';
import { GAME_LABELS, type GameTypeId } from '../../account/types';
import { listEvents, OBJECTIVE_LABELS, TIER_LABELS, TIERS, type ObjectiveType, type PlafeeEvent, type Tier } from '../api';
import { RarityTag } from '../components/bits';
import { objectiveText } from '../format';
import { deleteEvent, endEvent, getEventParticipants, upsertEvent, type EventInput, type EventParticipant } from './adminApi';
import { ConfirmAction, Field, Flash, ImagePicker } from './ui';
import { fmtDate, fmtDateTime, GAME_OPTIONS, toLocalInput, useFlash } from './helpers';

const blank = (): EventInput => ({
  id: null,
  name: '',
  description: '',
  game: 'flip7',
  objective_type: 'victories',
  objective_value: 10,
  trophy_rarity: 'or',
  start: toLocalInput(new Date()),
  end: toLocalInput(new Date(Date.now() + 7 * 86_400_000)),
  reward_fees: 150,
  image_url: null,
  trophy_description: '',
});

const STATUS: Record<PlafeeEvent['status'], string> = { live: 'Actif', upcoming: 'À venir', ended: 'Terminé' };

export function EventsTab() {
  const [list, setList] = useState<PlafeeEvent[] | null>(null);
  const [form, setForm] = useState<EventInput>(blank);
  const [msg, flash] = useFlash();
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [participantsOf, setParticipantsOf] = useState<PlafeeEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    listEvents(true)
      .then((l) => !cancelled && setList(l))
      .catch((e: unknown) => flash('error', e instanceof Error ? e.message : 'Chargement impossible.'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 3) {
      flash('error', 'Le nom fait au moins 3 caractères.');
      return;
    }
    if (new Date(form.end) <= new Date(form.start)) {
      flash('error', 'La fin doit suivre le début.');
      return;
    }
    setBusy(true);
    try {
      await upsertEvent({
        ...form,
        name: form.name.trim(),
        objective_value: Math.max(1, Math.trunc(form.objective_value)),
        reward_fees: Math.max(0, Math.trunc(form.reward_fees)),
        start: new Date(form.start).toISOString(),
        end: new Date(form.end).toISOString(),
      });
      flash('ok', form.id ? 'Événement modifié.' : 'Événement créé, avec son trophée limité et son badge.');
      setForm(blank());
      setNonce((n) => n + 1);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const edit = (ev: PlafeeEvent) => {
    setForm({
      id: ev.id,
      name: ev.name,
      description: ev.description ?? '',
      game: ev.game,
      objective_type: ev.objective_type,
      objective_value: ev.objective_value,
      trophy_rarity: ev.trophy_rarity,
      start: toLocalInput(ev.start_date),
      end: toLocalInput(ev.end_date),
      reward_fees: ev.reward_fees,
      image_url: ev.image_url,
      trophy_description: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const autoTrophy = objectiveText({ objective_type: form.objective_type, objective_value: form.objective_value || 1, game: (form.game as GameTypeId) || null });

  return (
    <div className="adm-stack">
      <form className="acc-card acc-card-wide adm-form" onSubmit={submit}>
        <h2 className="acc-section-title">
          {form.id ? <Pencil size={17} aria-hidden /> : <Plus size={17} aria-hidden />} {form.id ? `Modifier « ${form.name} »` : 'Créer un événement'}
        </h2>
        <div className="adm-grid-2">
          <Field label="Nom">
            <input className="neon-input" value={form.name} maxLength={60} onChange={(e) => set('name', e.target.value)} placeholder="Festival Flip 7" />
          </Field>
          <Field label="Jeu associé">
            <select className="neon-input" value={form.game ?? ''} onChange={(e) => set('game', e.target.value || null)}>
              {GAME_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Début">
            <input className="neon-input" type="datetime-local" value={form.start} onChange={(e) => set('start', e.target.value)} />
          </Field>
          <Field label="Fin">
            <input className="neon-input" type="datetime-local" value={form.end} onChange={(e) => set('end', e.target.value)} />
          </Field>
          <Field label="Type d'objectif" hint={form.objective_type === 'global_target' ? 'Toute la communauté contribue ; chaque participant gagne le trophée quand l’objectif est atteint.' : undefined}>
            <select className="neon-input" value={form.objective_type} onChange={(e) => set('objective_type', e.target.value as ObjectiveType)}>
              {(Object.keys(OBJECTIVE_LABELS) as ObjectiveType[]).map((o) => (
                <option key={o} value={o}>
                  {OBJECTIVE_LABELS[o]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nombre requis">
            <input className="neon-input" type="number" min={1} value={form.objective_value} onChange={(e) => set('objective_value', Number(e.target.value))} />
          </Field>
          <Field label="Rareté du trophée">
            <select className="neon-input" value={form.trophy_rarity} onChange={(e) => set('trophy_rarity', e.target.value as Tier)}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Récompense FEES (facultatif)">
            <input className="neon-input" type="number" min={0} step={10} value={form.reward_fees} onChange={(e) => set('reward_fees', Number(e.target.value))} />
          </Field>
          <Field label="Image du trophée">
            <ImagePicker value={form.image_url} onChange={(url) => set('image_url', url)} folder="events" onError={(m) => flash('error', m)} />
          </Field>
        </div>
        <Field label="Description (annonce)">
          <textarea className="neon-input" rows={2} maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Gagnez 10 parties Flip 7 en 7 jours !" />
        </Field>
        <Field label="Description du trophée" hint={`Laisse vide pour : « ${autoTrophy}… »`}>
          <textarea className="neon-input" rows={2} maxLength={200} value={form.trophy_description} onChange={(e) => set('trophy_description', e.target.value)} />
        </Field>
        <Flash msg={msg} />
        <div className="plf-actions">
          <button type="submit" className="neon-btn" data-variant="solid" disabled={busy}>
            {form.id ? 'Enregistrer' : 'Créer l’événement'}
          </button>
          {form.id && (
            <button type="button" className="neon-btn" data-variant="ghost" onClick={() => setForm(blank())}>
              Annuler
            </button>
          )}
        </div>
      </form>

      {participantsOf && <Participants ev={participantsOf} onClose={() => setParticipantsOf(null)} />}

      <section className="acc-card acc-card-wide">
        <h2 className="acc-section-title">Événements actifs et passés</h2>
        {!list ? (
          <p className="neon-hint">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="soc-empty">Aucun événement pour l'instant.</p>
        ) : (
          <div className="acc-table-scroll">
            <table className="acc-table adm-table">
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Début</th>
                  <th scope="col">Fin</th>
                  <th scope="col">Joueurs</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <strong>{ev.name}</strong>
                      <small className="adm-sub">
                        {ev.game ? GAME_LABELS[ev.game] : 'Global'} · {objectiveText(ev)} · <RarityTag tier={ev.trophy_rarity} />
                      </small>
                    </td>
                    <td>{fmtDate(ev.start_date)}</td>
                    <td>{fmtDate(ev.end_date)}</td>
                    <td>
                      {ev.participants} <small className="adm-sub">{ev.completed} fini(s)</small>
                    </td>
                    <td>
                      <span className="adm-pill" data-tone={ev.status === 'live' ? 'ok' : ev.status === 'upcoming' ? 'info' : undefined}>
                        {STATUS[ev.status]}
                      </span>
                    </td>
                    <td>
                      <span className="adm-actions">
                        <button type="button" className="adm-icon-btn" onClick={() => edit(ev)} title="Modifier" aria-label={`Modifier ${ev.name}`}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="adm-icon-btn" onClick={() => setParticipantsOf(ev)} title="Participants" aria-label={`Participants de ${ev.name}`}>
                          <Users size={14} />
                        </button>
                        {ev.status !== 'ended' && (
                          <ConfirmAction
                            variant="ghost"
                            label={<Square size={14} aria-label="Terminer maintenant" />}
                            confirm="Terminer ?"
                            onConfirm={async () => {
                              await endEvent(ev.id);
                              flash('ok', 'Événement terminé.');
                              setNonce((n) => n + 1);
                            }}
                          />
                        )}
                        <ConfirmAction
                          label={<Trash2 size={14} aria-label="Supprimer" />}
                          confirm="Supprimer (et son trophée) ?"
                          onConfirm={async () => {
                            await deleteEvent(ev.id);
                            flash('ok', 'Événement supprimé.');
                            setNonce((n) => n + 1);
                          }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Participants({ ev, onClose }: { ev: PlafeeEvent; onClose: () => void }) {
  const [rows, setRows] = useState<EventParticipant[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getEventParticipants(ev.id)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [ev.id]);
  return (
    <section className="acc-card acc-card-wide">
      <div className="adm-row-between">
        <h2 className="acc-section-title">
          <Users size={17} aria-hidden /> Participants — {ev.name}
        </h2>
        <button type="button" className="neon-btn adm-btn" data-variant="ghost" onClick={onClose}>
          Fermer
        </button>
      </div>
      {!rows ? (
        <p className="neon-hint">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="soc-empty">Personne n'a encore joué pendant cet événement.</p>
      ) : (
        <div className="acc-table-scroll">
          <table className="acc-table adm-table">
            <thead>
              <tr>
                <th scope="col">Joueur</th>
                <th scope="col">Progression</th>
                <th scope="col">Complété</th>
                <th scope="col" className="acc-col-opt">Depuis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.username}</td>
                  <td>
                    {r.progress} / {ev.objective_value}
                  </td>
                  <td>{r.completed_at ? fmtDateTime(r.completed_at) : '—'}</td>
                  <td className="acc-col-opt">{fmtDate(r.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
