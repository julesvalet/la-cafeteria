import { useEffect, useRef, useState } from 'react';
import { accountsEnabled } from '../../lib/supabase';
import { useAuth } from './useAuth';
import { recordGame, sessionKeyFor, type GameOutcome } from './recordGame';

export type RecordState =
  /** Partie en cours, ou rien à enregistrer. */
  | { kind: 'idle' }
  /** Personne n'est connecté : la partie ne compte pour aucun classement. */
  | { kind: 'anonymous' }
  | { kind: 'saving' }
  | { kind: 'saved'; points: number; streak: number; streakBonus: boolean; already: boolean }
  | { kind: 'error'; message: string };

/**
 * Enregistre une partie terminée, une fois et une seule.
 *
 * L'appelant passe `null` tant que la partie n'est pas finie, puis l'issue.
 * Le hook se charge du reste — y compris de ne rien faire si le joueur n'a pas
 * de compte, auquel cas la partie se déroule exactement comme avant.
 *
 * Trois protections se superposent contre le double enregistrement, parce
 * qu'elles ne couvrent pas les mêmes cas : la référence locale absorbe les
 * re-rendus et le double montage de StrictMode ; la clé de session absorbe un
 * rechargement de page en fin de partie ; et la contrainte d'unicité en base
 * absorbe deux onglets ouverts sur la même room.
 */
export function useRecordGame(outcome: GameOutcome | null): RecordState {
  const { status } = useAuth();
  const [state, setState] = useState<RecordState>({ kind: 'idle' });

  // Clés déjà tentées dans cette page. Un Set plutôt qu'un booléen : une
  // revanche produit une nouvelle clé et doit pouvoir s'enregistrer.
  const attempted = useRef<Set<string>>(new Set());

  const key = outcome ? sessionKeyFor(outcome) : null;

  useEffect(() => {
    // Plus rien à enregistrer : on efface le bilan précédent. Sans ça, un
    // écran de fin réutilisé d'une manche à l'autre — celui de Flip 7 — garderait
    // affichés les points d'une partie déjà terminée et déjà comptée.
    if (!key || !outcome) {
      setState({ kind: 'idle' });
      return;
    }

    // Instance sans comptes : ne rien afficher du tout. Proposer « connecte-toi »
    // renverrait vers un formulaire inerte.
    if (!accountsEnabled) {
      setState({ kind: 'idle' });
      return;
    }

    if (status === 'signed-out') {
      setState({ kind: 'anonymous' });
      return;
    }
    // La session est peut-être encore en cours de reprise : on attend plutôt
    // que de conclure à tort que le joueur est anonyme.
    if (status === 'loading') return;

    if (attempted.current.has(key)) return;
    attempted.current.add(key);

    let cancelled = false;
    setState({ kind: 'saving' });

    recordGame(outcome)
      .then((res) => {
        if (cancelled) return;
        setState({
          kind: 'saved',
          points: res.points,
          streak: res.streak,
          streakBonus: res.streak_bonus,
          already: res.already,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Un enregistrement raté ne doit jamais retirer au joueur la fin de sa
        // partie : on réarme la clé pour qu'un remontage puisse réessayer, et
        // l'UI se contente d'une mention discrète.
        attempted.current.delete(key);
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Enregistrement impossible.',
        });
      });

    return () => {
      cancelled = true;
    };
    // `outcome` est un objet recréé à chaque rendu : la clé, elle, est stable
    // tant que la partie ne change pas, et c'est elle qui doit piloter l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, status]);

  return state;
}
