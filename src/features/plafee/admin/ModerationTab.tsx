import { useEffect, useState } from 'react';
import { EyeOff, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAdminPlayers, getFlaggedQuestions, moderateQuestion, unbanPlayer, type AdminPlayer, type FlaggedQuestion } from './adminApi';
import { ConfirmAction, Flash } from './ui';
import { fmtDate, useFlash } from './helpers';

/** Les joueurs bannis, et les questions de la Roulette signalées. */
export function ModerationTab() {
  const [banned, setBanned] = useState<AdminPlayer[] | null>(null);
  const [questions, setQuestions] = useState<FlaggedQuestion[] | null>(null);
  const [msg, flash] = useFlash();
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAdminPlayers('', 200, 0)
      .then((r) => !cancelled && setBanned(r.filter((p) => p.banned)))
      .catch((e: unknown) => flash('error', e instanceof Error ? e.message : 'Chargement impossible.'));
    getFlaggedQuestions()
      .then((q) => !cancelled && setQuestions(q ?? []))
      .catch(() => !cancelled && setQuestions([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const act = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      flash('ok', ok);
      setNonce((n) => n + 1);
    } catch (e) {
      flash('error', e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  return (
    <div className="adm-stack">
      <Flash msg={msg} />
      <section className="acc-card acc-card-wide">
        <h2 className="acc-section-title">Joueurs bannis {banned && <span className="soc-count">{banned.length}</span>}</h2>
        <p className="neon-hint">
          Pour bannir, avertir ou remettre à zéro un joueur : <Link to="/admin?onglet=joueurs">onglet Joueurs</Link>.
        </p>
        {!banned ? (
          <p className="neon-hint">Chargement…</p>
        ) : banned.length === 0 ? (
          <p className="soc-empty">Aucun joueur banni.</p>
        ) : (
          <ul className="adm-list">
            {banned.map((p) => (
              <li key={p.user_id}>
                <strong>{p.username}</strong>
                <span className="neon-hint"> {p.ban_reason ? `— ${p.ban_reason}` : ''}</span>
                <ConfirmAction
                  variant="ghost"
                  label={
                    <>
                      <ShieldCheck size={14} aria-hidden /> Débannir
                    </>
                  }
                  confirm="Confirmer"
                  onConfirm={() => act(() => unbanPlayer(p.user_id), `${p.username} débanni.`)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="acc-card acc-card-wide">
        <h2 className="acc-section-title">Questions de la Roulette signalées {questions && <span className="soc-count">{questions.length}</span>}</h2>
        <p className="neon-hint">Une question publique sort du pool au 3ᵉ signalement. Tu peux la rétablir, la masquer ou la supprimer.</p>
        {!questions ? (
          <p className="neon-hint">Chargement…</p>
        ) : questions.length === 0 ? (
          <p className="soc-empty">Aucune question signalée.</p>
        ) : (
          <ul className="adm-list adm-questions">
            {questions.map((q) => (
              <li key={q.id} data-hidden={q.hidden || undefined}>
                <span className="adm-q">
                  <strong>« {q.content} »</strong>
                  <small>
                    {q.theme.toUpperCase()} · par {q.author ?? '?'} · {q.report_count} signalement{q.report_count > 1 ? 's' : ''} · tirée {q.used_count} fois · {fmtDate(q.created_at)}
                    {q.hidden && ' · masquée'}
                  </small>
                </span>
                <span className="adm-actions">
                  {q.hidden ? (
                    <button type="button" className="neon-btn adm-btn" data-variant="ghost" onClick={() => void act(() => moderateQuestion(q.id, 'restore'), 'Question rétablie.')}>
                      <RotateCcw size={14} aria-hidden /> Rétablir
                    </button>
                  ) : (
                    <button type="button" className="neon-btn adm-btn" data-variant="ghost" onClick={() => void act(() => moderateQuestion(q.id, 'hide'), 'Question masquée.')}>
                      <EyeOff size={14} aria-hidden /> Masquer
                    </button>
                  )}
                  <ConfirmAction label={<Trash2 size={14} aria-label="Supprimer" />} confirm="Supprimer ?" onConfirm={() => act(() => moderateQuestion(q.id, 'delete'), 'Question supprimée.')} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
