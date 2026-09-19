import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Check, Clock, Search, UserMinus, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../account/useAuth';
import { NeonButton } from '../../account/components/NeonButton';
import { AccBanner } from '../../account/components/AccBanner';
import { useFriends } from '../useFriends';
import { searchUsers } from '../api';
import { timeAgo } from '../format';
import { UserAvatar } from './UserAvatar';
import { ChallengeButton } from './ChallengeButton';
import { ConfirmButton } from './ConfirmButton';
import type { Friendship } from '../types';

/** Amis en ligne d'abord, puis par ordre de dernier passage. */
function byPresence(online: ReadonlySet<string>) {
  return (a: Friendship, b: Friendship) => {
    const ao = online.has(a.user_id) ? 1 : 0;
    const bo = online.has(b.user_id) ? 1 : 0;
    if (ao !== bo) return bo - ao;
    return (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? '');
  };
}

export function FriendsPanel() {
  const { friends, incoming, outgoing, online, presenceLive, acceptRequest, declineRequest, removeFriend, blockUser } =
    useFriends();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...friends].sort(byPresence(online));
  const onlineCount = friends.filter((f) => online.has(f.user_id)).length;

  return (
    <div className="soc-stack">
      <AddFriendForm />

      {error && <AccBanner tone="error">{error}</AccBanner>}

      {incoming.length > 0 && (
        <section className="acc-card acc-card-wide">
          <h2 className="acc-section-title">
            <UserPlus size={18} aria-hidden /> Demandes reçues
            <span className="soc-count">{incoming.length}</span>
          </h2>
          <ul className="soc-list">
            {incoming.map((f) => (
              <li key={f.friendship_id} className="soc-row">
                <UserAvatar username={f.username} src={f.avatar} />
                <div className="soc-row-main">
                  <Link to={`/joueur/${f.username}`} className="soc-name">
                    {f.username}
                  </Link>
                  <span className="soc-meta">{timeAgo(f.created_at)}</span>
                </div>
                <div className="soc-row-actions">
                  <button
                    type="button"
                    className="soc-pill"
                    data-tone="accept"
                    disabled={busyId === f.friendship_id}
                    onClick={() => void run(f.friendship_id, () => acceptRequest(f.friendship_id))}
                  >
                    <Check size={14} aria-hidden /> Accepter
                  </button>
                  <button
                    type="button"
                    className="soc-pill"
                    disabled={busyId === f.friendship_id}
                    onClick={() => void run(f.friendship_id, () => declineRequest(f.friendship_id))}
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
          Mes amis
          <span className="soc-count">{friends.length}</span>
          {presenceLive && onlineCount > 0 && <span className="soc-meta soc-online-count">{onlineCount} en ligne</span>}
        </h2>

        {friends.length === 0 ? (
          <p className="soc-empty">
            Pas encore d'amis ici. Cherche le pseudo de quelqu'un avec qui tu joues pour l'ajouter.
          </p>
        ) : (
          <ul className="soc-list">
            {sorted.map((f) => {
              const isOnline = online.has(f.user_id);
              return (
                <li key={f.friendship_id} className="soc-row">
                  <UserAvatar username={f.username} src={f.avatar} online={presenceLive ? isOnline : undefined} />
                  <div className="soc-row-main">
                    <Link to={`/joueur/${f.username}`} className="soc-name">
                      {f.username}
                    </Link>
                    <span className="soc-meta">
                      {presenceLive && isOnline
                        ? 'En ligne'
                        : f.last_seen_at
                          ? `Vu ${timeAgo(f.last_seen_at)}`
                          : 'Jamais vu en ligne'}
                    </span>
                  </div>
                  <div className="soc-row-actions">
                    <ChallengeButton friendId={f.user_id} friendName={f.username} />
                    <ConfirmButton
                      icon={<UserMinus size={14} aria-hidden />}
                      confirmLabel="Confirmer ?"
                      disabled={busyId === f.user_id}
                      onConfirm={() => void run(f.user_id, () => removeFriend(f.user_id))}
                    >
                      Retirer
                    </ConfirmButton>
                    <ConfirmButton
                      icon={<Ban size={14} aria-hidden />}
                      confirmLabel="Bloquer ?"
                      disabled={busyId === f.user_id}
                      onConfirm={() => void run(f.user_id, () => blockUser(f.user_id))}
                    >
                      Bloquer
                    </ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="acc-card acc-card-wide">
          <h2 className="acc-section-title">
            <Clock size={18} aria-hidden /> Demandes envoyées
            <span className="soc-count">{outgoing.length}</span>
          </h2>
          <ul className="soc-list">
            {outgoing.map((f) => (
              <li key={f.friendship_id} className="soc-row">
                <UserAvatar username={f.username} src={f.avatar} />
                <div className="soc-row-main">
                  <Link to={`/joueur/${f.username}`} className="soc-name">
                    {f.username}
                  </Link>
                  <span className="soc-meta">En attente · envoyée {timeAgo(f.created_at)}</span>
                </div>
                <div className="soc-row-actions">
                  <button
                    type="button"
                    className="soc-pill"
                    disabled={busyId === f.user_id}
                    onClick={() => void run(f.user_id, () => removeFriend(f.user_id))}
                  >
                    <X size={14} aria-hidden /> Annuler
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Ajout par pseudo, avec suggestions dès deux caractères. */
function AddFriendForm() {
  const { user } = useAuth();
  const { addFriend } = useFriends();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; username: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  // Petite temporisation : une requête par pause de frappe, pas par touche.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchUsers(q, user?.id)
        .then((rows) => {
          if (!cancelled) setSuggestions(rows);
        })
        .catch(() => {});
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, user?.id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const username = query.trim();
    if (!username) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await addFriend(username);
      setMessage({
        tone: 'success',
        text:
          res.status === 'accepted'
            ? `${res.username} t'avait déjà demandé : vous êtes maintenant amis.`
            : `Demande envoyée à ${res.username}.`,
      });
      setQuery('');
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Envoi impossible.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="acc-card acc-card-wide soc-add" onSubmit={onSubmit}>
      <h2 className="acc-section-title">
        <Search size={18} aria-hidden /> Ajouter un ami
      </h2>
      <div className="soc-inline-form">
        <div className="neon-field">
          <label className="neon-field-label" htmlFor={`${listId}-input`}>
            Pseudo
          </label>
          <input
            id={`${listId}-input`}
            className="neon-input"
            list={listId}
            autoComplete="off"
            value={query}
            maxLength={20}
            placeholder="Le pseudo de ton ami"
            onChange={(e) => setQuery(e.target.value)}
          />
          {/* Un datalist plutôt qu'une liste déroulante maison : le navigateur
              gère clavier, lecteur d'écran et tactile. */}
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s.id} value={s.username} />
            ))}
          </datalist>
        </div>
        <NeonButton type="submit" variant="solid" loading={busy} disabled={!query.trim()} icon={<UserPlus size={16} aria-hidden />}>
          Envoyer
        </NeonButton>
      </div>
      {message && <AccBanner tone={message.tone}>{message.text}</AccBanner>}
    </form>
  );
}
