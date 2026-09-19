import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, KeyRound, Lock, MailOpen, MessagesSquare, Plus, Users, X } from 'lucide-react';
import { NeonButton } from '../../account/components/NeonButton';
import { AccBanner } from '../../account/components/AccBanner';
import { useGroups } from '../useGroups';
import { timeAgo } from '../format';
import { CreateGroupModal } from './CreateGroupModal';

/** La liste des groupes du joueur, les invitations en attente, et les deux façons d'en rejoindre un. */
export function GroupPanel() {
  const { groups, invitations, loading, error, createGroup, joinGroup, respondInvitation } = useGroups();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      const id = await joinGroup(code);
      navigate(`/groupes/${id}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Impossible de rejoindre ce groupe.');
      setJoining(false);
    }
  }

  async function onRespond(invitationId: string, accept: boolean) {
    setBusyInvite(invitationId);
    setInviteError(null);
    try {
      const id = await respondInvitation(invitationId, accept);
      if (accept && id) navigate(`/groupes/${id}`);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusyInvite(null);
    }
  }

  return (
    <div className="soc-stack">
      <div className="soc-two-col">
        <section className="acc-card acc-card-wide">
          <h2 className="acc-section-title">
            <Plus size={18} aria-hidden /> Créer
          </h2>
          <p className="neon-hint soc-card-text">Un salon de discussion pour ta bande, avec un code à partager.</p>
          <NeonButton variant="solid" onClick={() => setCreating(true)} icon={<Plus size={16} aria-hidden />}>
            Nouveau groupe
          </NeonButton>
        </section>

        <form className="acc-card acc-card-wide" onSubmit={onJoin}>
          <h2 className="acc-section-title">
            <KeyRound size={18} aria-hidden /> Rejoindre
          </h2>
          <div className="soc-inline-form">
            <div className="neon-field">
              <label className="neon-field-label" htmlFor="soc-join-code">
                Code d'invitation
              </label>
              <input
                id="soc-join-code"
                className="neon-input soc-code-input"
                value={code}
                maxLength={12}
                autoComplete="off"
                placeholder="ABCD2345"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <NeonButton type="submit" loading={joining} disabled={code.replace(/[^A-Za-z0-9]/g, '').length !== 8}>
              Rejoindre
            </NeonButton>
          </div>
          {joinError && <AccBanner tone="error">{joinError}</AccBanner>}
        </form>
      </div>

      {invitations.length > 0 && (
        <section className="acc-card acc-card-wide">
          <h2 className="acc-section-title">
            <MailOpen size={18} aria-hidden /> Invitations
            <span className="soc-count">{invitations.length}</span>
          </h2>
          {inviteError && <AccBanner tone="error">{inviteError}</AccBanner>}
          <ul className="soc-list">
            {invitations.map((inv) => (
              <li key={inv.invitation_id} className="soc-row">
                <span className="soc-group-icon" aria-hidden>
                  <Users size={18} />
                </span>
                <div className="soc-row-main">
                  <span className="soc-name">{inv.group_name}</span>
                  <span className="soc-meta">
                    {inv.invited_by_username ? `Invité par ${inv.invited_by_username}` : 'Invitation'} ·{' '}
                    {timeAgo(inv.created_at)}
                  </span>
                </div>
                <div className="soc-row-actions">
                  <button
                    type="button"
                    className="soc-pill"
                    data-tone="accept"
                    disabled={busyInvite === inv.invitation_id}
                    onClick={() => void onRespond(inv.invitation_id, true)}
                  >
                    <Check size={14} aria-hidden /> Rejoindre
                  </button>
                  <button
                    type="button"
                    className="soc-pill"
                    disabled={busyInvite === inv.invitation_id}
                    onClick={() => void onRespond(inv.invitation_id, false)}
                  >
                    <X size={14} aria-hidden /> Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="acc-card acc-card-wide">
        <h2 className="acc-section-title">
          <MessagesSquare size={18} aria-hidden /> Mes groupes
          <span className="soc-count">{groups.length}</span>
        </h2>
        {error && <AccBanner tone="error">{error}</AccBanner>}
        {loading ? (
          <p className="neon-hint" role="status">
            Chargement…
          </p>
        ) : groups.length === 0 ? (
          <p className="soc-empty">Aucun groupe pour l'instant. Crée le tien ou entre un code reçu d'un ami.</p>
        ) : (
          <ul className="soc-list">
            {groups.map((g) => (
              <li key={g.id}>
                <Link to={`/groupes/${g.id}`} className="soc-row soc-row-link">
                  <span className="soc-group-icon" aria-hidden>
                    {g.is_private ? <Lock size={17} /> : <Users size={18} />}
                  </span>
                  <div className="soc-row-main">
                    <span className="soc-name">
                      {g.name}
                      {g.role === 'admin' && <span className="soc-tag">admin</span>}
                    </span>
                    <span className="soc-meta soc-ellipsis">
                      {g.last_message_deleted
                        ? 'Message supprimé'
                        : g.last_message_kind === 'text' && g.last_sender
                          ? `${g.last_sender} : ${g.last_message}`
                          : (g.last_message ?? '')}
                    </span>
                  </div>
                  <div className="soc-row-side">
                    <span className="soc-meta">{timeAgo(g.last_activity_at)}</span>
                    <span className="soc-meta">
                      {g.member_count} membre{g.member_count > 1 ? 's' : ''}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateGroupModal
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={async (v) => {
          const group = await createGroup(v.name, v.description, v.isPrivate);
          setCreating(false);
          navigate(`/groupes/${group.id}`);
        }}
      />
    </div>
  );
}
