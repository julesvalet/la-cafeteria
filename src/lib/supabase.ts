import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * Le client Supabase du site — chargé à la demande.
 *
 * Deux contraintes se rejoignent ici.
 *
 * D'abord, les comptes sont une couche *additive* : La Cafétéria a toujours
 * tourné en P2P sans serveur, et elle doit continuer si la configuration
 * manque (fork du dépôt, `.env` absent, panne de la base). Une variable
 * d'environnement oubliée doit coûter le bouton « Se connecter », pas la
 * partie de Scopa en cours.
 *
 * Ensuite, la taille : `@supabase/supabase-js` pèse une centaine de kilo-octets
 * compressés. Importé au premier niveau, il s'ajoutait au chemin critique de
 * toutes les pages — y compris pour un visiteur venu jouer une partie sans
 * jamais ouvrir de compte. D'où l'import dynamique : `accountsEnabled` ne lit
 * que la configuration, et la bibliothèque n'arrive qu'au moment où une
 * session doit réellement être ouverte.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Vrai quand le site est configuré pour proposer des comptes.
 *
 * Synchrone et sans dépendance : c'est ce qui permet à l'en-tête de décider
 * s'il affiche un bouton de connexion sans rien télécharger.
 */
export const accountsEnabled = Boolean(url && key);

/** Le client, une fois construit. Mémorisé : un seul par onglet. */
let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Le client Supabase, en le chargeant au besoin.
 *
 * Rejette si le site n'est pas configuré — l'UI n'y mène pas quand
 * `accountsEnabled` est faux, donc y arriver signale un bug d'aiguillage
 * plutôt qu'une situation à gérer.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!accountsEnabled) {
    return Promise.reject(
      new Error(
        'Les comptes ne sont pas configurés sur cette instance (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).',
      ),
    );
  }

  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Le lien de confirmation d'e-mail revient avec la session dans l'URL ;
        // sans ça, cliquer le lien reconnecte l'onglet mais pas l'application.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    }),
  );

  return clientPromise;
}

/**
 * Où renvoyer le joueur depuis un e-mail de confirmation.
 *
 * `BASE_URL` vaut "/la-cafeteria/" en production et "/" en développement :
 * reconstruire l'URL absolue à partir de l'origine courante évite de coder en
 * dur un domaine qui diffère entre la préversion locale et GitHub Pages.
 */
export function authRedirectUrl(path = ''): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).toString();
}
