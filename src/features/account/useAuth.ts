import { useContext } from 'react';
import { AuthContext, type AuthValue } from './authContext';

/**
 * L'état du compte courant.
 *
 * Jette hors du provider plutôt que de rendre un état vide : un composant qui
 * lirait `profile: null` sans être sous `AuthProvider` afficherait
 * silencieusement « déconnecté » pour un joueur bel et bien connecté.
 */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé sous <AuthProvider>.');
  return value;
}
