import { useEffect, useState } from 'react';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from '../account/useAuth';

/*
 * Le pseudo de jeu, retenu d'une visite à l'autre.
 *
 * Deux sources, dans cet ordre :
 *   1. le compte : un joueur connecté joue sous son pseudo, sans le retaper ;
 *   2. pour un visiteur sans compte, le dernier pseudo tapé, gardé dans ce
 *      navigateur.
 *
 * Le jeton de session, lui, n'est pas recopié ici : Supabase le conserve et le
 * rafraîchit déjà. En tenir une seconde copie reviendrait à garder un jeton
 * expiré à côté du bon.
 */

const KEY = 'userPseudo';
/** L'ancien emplacement, propre à Flip 7 : relu une fois pour ne pas perdre le pseudo déjà tapé. */
const LEGACY_FLIP7_KEY = 'flip7-name';

export function readSavedPseudo(): string {
  try {
    return localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_FLIP7_KEY) ?? '';
  } catch {
    return '';
  }
}

export function savePseudo(name: string) {
  const v = name.trim().slice(0, 18);
  if (!v) return;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Navigation privée : le pseudo sera simplement redemandé.
  }
}

export function clearSavedPseudo() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_FLIP7_KEY);
  } catch {
    // Rien à effacer si le stockage est indisponible.
  }
}

/**
 * Le pseudo à proposer dans un salon : celui du compte, sinon le dernier tapé.
 * Reste modifiable, et suit le compte s'il se charge après le premier rendu.
 */
export function usePlayerName(): [string, (name: string) => void] {
  const { profile } = useAuth();
  const [name, setName] = useState(() => profile?.username ?? readSavedPseudo());
  const [touched, setTouched] = useState(false);

  // Le profil arrive souvent un instant après le premier rendu : il remplace
  // la suggestion, jamais ce que le joueur a déjà commencé à taper.
  useEffect(() => {
    if (profile?.username && !touched) setName(profile.username);
  }, [profile?.username, touched]);

  return [
    name,
    (next: string) => {
      setTouched(true);
      setName(next);
    },
  ];
}

/**
 * Qui entre dans une room ouverte par lien direct.
 *
 * Connecté : on entre sous le pseudo du compte, sans formulaire. Sinon on
 * propose le dernier pseudo tapé. `pending` couvre la reprise de session au
 * chargement, pour ne pas montrer un formulaire qui disparaîtrait aussitôt.
 */
export function useRoomIdentity(navName: string | undefined) {
  const { status, profile } = useAuth();
  const accountName = status === 'signed-in' ? profile?.username : undefined;
  const [typed, setTyped] = useState(() => navName ?? readSavedPseudo());
  const [confirmed, setConfirmed] = useState(Boolean(navName));

  const pending = !navName && accountsEnabled && (status === 'loading' || (status === 'signed-in' && !profile));
  const name = navName ?? accountName ?? typed;
  const joined = confirmed || Boolean(accountName);

  return {
    name,
    joined,
    pending: pending && !confirmed,
    typed,
    setTyped,
    confirm: () => {
      if (!typed.trim()) return;
      savePseudo(typed);
      setConfirmed(true);
    },
  };
}
