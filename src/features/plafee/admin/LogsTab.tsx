import { useEffect, useState } from 'react';
import { getAdminLogs, type AdminLog } from './adminApi';
import { fmtDateTime } from './helpers';

const ACTIONS: Record<string, string> = {
  ban: 'Bannissement',
  unban: 'Levée de ban',
  warn: 'Avertissement',
  reset_stats: 'Remise à zéro',
  report_resolved: 'Signalement résolu',
  report_dismissed: 'Signalement classé',
  report_pending: 'Signalement rouvert',
  question_hide: 'Question masquée',
  question_restore: 'Question rétablie',
  question_delete: 'Question supprimée',
  upsert_trophy: 'Trophée créé ou modifié',
  delete_trophy: 'Trophée supprimé',
  award_trophy: 'Trophée décerné',
  upsert_badge: 'Badge créé ou modifié',
  delete_badge: 'Badge supprimé',
  award_badge: 'Badge attribué',
  revoke_badge: 'Badge retiré',
  create_event: 'Événement créé',
  update_event: 'Événement modifié',
  end_event: 'Événement terminé',
  delete_event: 'Événement supprimé',
  grant_fees: 'FEES donnés',
  revoke_fees: 'FEES retirés',
  fees_config: 'Réglage FEES',
  upsert_shop_item: 'Objet de boutique',
  god_edit: 'God mode',
};

/** Une valeur du journal, lisible : les adresses de photo ne disent rien. */
function logValue(what: unknown, v: unknown): string {
  if (v === null || v === undefined || v === '') return what === 'Photo' ? 'aucune' : '—';
  if (what === 'Photo') return 'photo';
  if (what === 'Bio') {
    const s = String(v);
    return `« ${s.length > 40 ? `${s.slice(0, 40)}…` : s} »`;
  }
  return typeof v === 'number' ? v.toLocaleString('fr-FR') : String(v);
}

/** « Jules a modifié Victoires Scopa pour Alice : 12 → 40 ». */
function describe(l: AdminLog): string {
  const d = l.details ?? {};
  if (l.action === 'god_edit') {
    return `${l.admin ?? 'Un admin'} a modifié ${String(d.what)} pour ${String(d.user)} : ${logValue(d.what, d.from)} → ${logValue(d.what, d.to)}`;
  }
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== '')
    .map(([k, v]) => `${k} : ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

/** Qui a fait quoi, et quand : chaque action d'admin laisse une trace. */
export function LogsTab() {
  const [rows, setRows] = useState<AdminLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAdminLogs(150)
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, []);
  return (
    <section className="acc-card acc-card-wide">
      <h2 className="acc-section-title">Journal des actions</h2>
      {error && <p className="neon-error">{error}</p>}
      {!rows ? (
        !error && <p className="neon-hint">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="soc-empty">Aucune action pour l'instant.</p>
      ) : (
        <div className="acc-table-scroll">
          <table className="acc-table adm-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Admin</th>
                <th scope="col">Action</th>
                <th scope="col">Détails</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDateTime(l.created_at)}</td>
                  <td>{l.admin ?? '—'}</td>
                  <td>{ACTIONS[l.action] ?? l.action}</td>
                  <td className={l.action === 'god_edit' ? 'adm-log-god' : 'adm-mono'}>{describe(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
