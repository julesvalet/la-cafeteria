import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  LogOut,
  Pencil,
  RefreshCw,
  Shield,
  ShieldOff,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../account/useAuth';
import { AccBanner } from '../../account/components/AccBanner';
import { SocialPage } from '../components/SocialPage';
import { GroupChat } from '../components/GroupChat';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { ConfirmButton } from '../components/ConfirmButton';
import { UserAvatar } from '../components/UserAvatar';
import { useGroupChat } from '../useGroupChat';
import { useSocial } from '../useSocial';
import * as api from '../api';
import type { Group, GroupMember } from '../types';

export function GroupDetailPage() {
  const { groupId = '' } = useParams();
  return (
    <SocialPage wide>
      {/* Clé sur l'identifiant : passer d'un groupe à l'autre repart d'un état propre. */}
      <GroupDetail key={groupId} groupId={groupId} />
    </SocialPage>
  );
}

function GroupDetail({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const chat = useGroupChat(groupId);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selfId = user?.id ?? '';
  const me = chat.members.find((m) => m.user_id === selfId);
  const isAdmin = me?.role === 'admin';
  const isCreator = chat.group?.created_by === selfId;

  if (chat.status === 'loading') {
    return (
      <p className="neon-hint" role="status">
        Ouverture du groupe…
      </p>
    );
  }

  if (chat.status === 'forbidden') {
    return (
      <AccBanner tone="info">
        Ce groupe n'existe pas, ou tu n'en fais pas partie. <Link to="/groupes">Retour à mes groupes</Link>
      </AccBanner>
    );
  }

  if (chat.status === 'gone') {
    return (
      <AccBanner tone="info">
        {chat.goneReason ?? "Tu n'as plus accès à ce groupe."} <Link to="/groupes">Retour à mes groupes</Link>
      </AccBanner>
    );
  }

  if (chat.status === 'error' || !chat.group) {
    return <AccBanner tone="error">{chat.error ?? 'Chargement impossible.'}</AccBanner>;
  }

  const group = chat.group;

  async function act(action: () => Promise<unknown>, then?: () => void) {
    setActionError(null);
    try {
      await action();
      then?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action impossible.');
    }
  }

  return (
    <div className="soc-group">
      <header className="acc-card acc-card-wide soc-group-head">
        <Link to="/groupes" className="soc-back">
          <ArrowLeft size={16} aria-hidden /> Mes groupes
        </Link>
        <div className="soc-group-title">
          <h1 className="acc-title">{group.name}</h1>
          {group.description && <p className="acc-subtitle">{group.description}</p>}
          <p className="soc-meta">
            {chat.members.length} membre{chat.members.length > 1 ? 's' : ''} ·{' '}
            {group.is_private ? 'privé, sur invitation' : 'ouvert avec le code'}
          </p>
        </div>
        <div className="soc-group-actions">
          {isAdmin && (
            <button type="button" className="soc-pill" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden /> Modifier
            </button>
          )}
          {isCreator ? (
            <ConfirmButton
              icon={<Trash2 size={14} aria-hidden />}
              confirmLabel="Supprimer pour de bon ?"
              onConfirm={() => void act(() => api.deleteGroup(group.id), () => navigate('/groupes'))}
            >
              Supprimer
            </ConfirmButton>
          ) : (
            <ConfirmButton
              icon={<LogOut size={14} aria-hidden />}
              confirmLabel="Quitter ?"
              onConfirm={() => void act(() => api.leaveGroup(group.id), () => navigate('/groupes'))}
            >
              Quitter
            </ConfirmButton>
          )}
        </div>
        {actionError && <AccBanner tone="error">{actionError}</AccBanner>}
      </header>

      <div className="soc-group-body">
        <section className="acc-card acc-card-wide soc-chat-card" aria-label="Discussion">
          <GroupChat
            messages={chat.messages}
            members={chat.members}
            selfId={selfId}
            isAdmin={isAdmin}
            hasMore={chat.hasMore}
            loadingMore={chat.loadingMore}
            typingNames={chat.typingNames}
            onLoadMore={chat.loadMore}
            onSend={chat.send}
            onDelete={chat.remove}
            onTyping={chat.notifyTyping}
          />
        </section>

        <aside className="soc-group-side">
          {(isAdmin || !group.is_private) && <InviteCode group={group} canRegenerate={isAdmin} onChanged={chat.refreshMeta} />}
          {isAdmin && <InviteForm groupId={group.id} members={chat.members} />}
          <MemberList
            group={group}
            members={chat.members}
            selfId={selfId}
            isAdmin={isAdmin}
            isCreator={isCreator}
            onAction={(action) => act(action, () => void chat.refreshMeta())}
          />
        </aside>
      </div>

      <CreateGroupModal
        open={editing}
        onClose={() => setEditing(false)}
        initial={group}
        onSubmit={async (v) => {
          await api.updateGroup(group.id, { name: v.name, description: v.description, isPrivate: v.isPrivate });
          await chat.refreshMeta();
          setEditing(false);
        }}
      />
    </div>
  );
}

function InviteCode({ group, canRegenerate, onChanged }: { group: Group; canRegenerate: boolean; onChanged: () => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <section className="acc-card acc-card-wide soc-side-card">
      <h3 className="soc-side-title">Code d'invitation</h3>
      <div className="soc-code-row">
        <code className="soc-code">{group.invite_code}</code>
        <button
          type="button"
          className="soc-icon-btn"
          aria-label={copied ? 'Code copié' : 'Copier le code'}
          onClick={() => {
            void navigator.clipboard?.writeText(group.invite_code).then(() => setCopied(true));
          }}
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        </button>
        {canRegenerate && (
          <button
            type="button"
            className="soc-icon-btn"
            aria-label="Générer un nouveau code"
            title="Nouveau code (l'ancien cesse de marcher)"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              api
                .regenerateInviteCode(group.id)
                .then(onChanged)
                .catch(() => {})
                .finally(() => setBusy(false));
            }}
          >
            <RefreshCw size={16} className={busy ? 'neon-spin' : undefined} aria-hidden />
          </button>
        )}
      </div>
      <p className="neon-hint">
        {group.is_private
          ? 'Groupe privé : le code seul ne suffit pas, il faut une invitation.'
          : 'À partager : ce code suffit pour entrer.'}
      </p>
    </section>
  );
}

/** Inviter par pseudo, avec les amis qui ne sont pas encore membres en suggestion. */
function InviteForm({ groupId, members }: { groupId: string; members: GroupMember[] }) {
  const { friends } = useSocial();
  const listId = useId();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const candidates = friends.filter((f) => !members.some((m) => m.user_id === f.user_id));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.inviteToGroup(groupId, username.trim());
      setMessage({ tone: 'success', text: `Invitation envoyée à ${res.username}.` });
      setUsername('');
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Invitation impossible.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="acc-card acc-card-wide soc-side-card" onSubmit={submit}>
      <h3 className="soc-side-title">Inviter</h3>
      <div className="soc-inline-form">
        <label htmlFor={`${listId}-in`} className="soc-sr-only">
          Pseudo à inviter
        </label>
        <input
          id={`${listId}-in`}
          className="neon-input"
          list={listId}
          value={username}
          maxLength={20}
          autoComplete="off"
          placeholder="Pseudo"
          onChange={(e) => setUsername(e.target.value)}
        />
        <datalist id={listId}>
          {candidates.map((f) => (
            <option key={f.user_id} value={f.username} />
          ))}
        </datalist>
        <button type="submit" className="soc-icon-btn soc-icon-btn-solid" aria-label="Inviter" disabled={busy || !username.trim()}>
          <UserPlus size={16} aria-hidden />
        </button>
      </div>
      {message && <AccBanner tone={message.tone}>{message.text}</AccBanner>}
    </form>
  );
}

function MemberList({
  group,
  members,
  selfId,
  isAdmin,
  isCreator,
  onAction,
}: {
  group: Group;
  members: GroupMember[];
  selfId: string;
  isAdmin: boolean;
  isCreator: boolean;
  onAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const { online, presenceLive } = useSocial();

  return (
    <section className="acc-card acc-card-wide soc-side-card">
      <h3 className="soc-side-title">Membres</h3>
      <ul className="soc-list soc-member-list">
        {members.map((m) => {
          const self = m.user_id === selfId;
          const creator = m.user_id === group.created_by;
          // Mêmes règles que la base : un admin retire les membres, seul le
          // créateur retire un admin. Le bouton n'apparaît que s'il peut aboutir.
          const canRemove = !self && !creator && isAdmin && (m.role === 'member' || isCreator);
          return (
            <li key={m.user_id} className="soc-row soc-row-compact">
              <UserAvatar username={m.username} src={m.avatar} size={30} online={presenceLive ? online.has(m.user_id) : undefined} />
              <div className="soc-row-main">
                {self ? (
                  <span className="soc-name">{m.username} (toi)</span>
                ) : (
                  <Link to={`/joueur/${m.username}`} className="soc-name">
                    {m.username}
                  </Link>
                )}
                <span className="soc-meta">
                  {creator ? (
                    <>
                      <Crown size={12} aria-hidden /> créateur
                    </>
                  ) : m.role === 'admin' ? (
                    <>
                      <Shield size={12} aria-hidden /> admin
                    </>
                  ) : (
                    'membre'
                  )}
                </span>
              </div>
              {(canRemove || (isCreator && !self)) && (
                <div className="soc-row-actions">
                  {isCreator && !self && (
                    <button
                      type="button"
                      className="soc-icon-btn"
                      aria-label={m.role === 'admin' ? `Retirer le rôle d'admin à ${m.username}` : `Nommer ${m.username} admin`}
                      title={m.role === 'admin' ? "Retirer le rôle d'admin" : 'Nommer admin'}
                      onClick={() => void onAction(() => api.setGroupAdmin(group.id, m.user_id, m.role !== 'admin'))}
                    >
                      {m.role === 'admin' ? <ShieldOff size={15} aria-hidden /> : <Shield size={15} aria-hidden />}
                    </button>
                  )}
                  {canRemove && (
                    <ConfirmButton
                      icon={<UserMinus size={14} aria-hidden />}
                      confirmLabel="Retirer ?"
                      onConfirm={() => void onAction(() => api.removeGroupMember(group.id, m.user_id))}
                    >
                      <span className="soc-sr-only">Retirer {m.username}</span>
                    </ConfirmButton>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
