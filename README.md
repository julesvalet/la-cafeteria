# La Cafétéria ☕

Le hub de mini-applications et de jeux entre potes. Un seul endroit, plusieurs façons de traîner ensemble.

## Features

- **Flip 7** — un plateau casino, de 2 à 5 amis en ligne, 1 à 3 bots (trois difficultés), ou un entraînement solo illimité. Une roulette révèle chaque carte ; arrête pour sécuriser tes points, ou tente les sept numéros différents. Règles officielles (94 cartes, objectif 200 points) et variante Cafétéria (62 cartes et effets personnalisés) disponibles au salon. Chat intégré, sons et musique activables, statistiques locales, thèmes clair/sombre et mode d’animation léger.

- **Scopa** — le jeu de cartes italien classique, jouable en ligne à 2, 3 ou 4 joueurs. Crée une room, partage le code (ou le lien) à tes potes, et jouez ensemble en temps réel — sans backend, tout passe en pair-à-pair (WebRTC via [PeerJS](https://peerjs.com/)).
- **Puissance 4** — le classique, mais avec des pouvoirs. De 2 à 4 joueurs : duel, chacun pour soi à 3 ou 4, ou 2 v 2 en équipes (l'alignement gagnant peut mélanger les jetons des deux coéquipiers). Personne ne *choisit* ses pouvoirs : chaque joueur reçoit une réserve de jetons pour la partie, dont une minorité tirée au sort est chargée d'un pouvoir — Traversée, Destruction, Inversion de gravité, Double-tour ou Blocage de colonne. Tu joues ta colonne normalement ; si ce jeton-là était chargé, l'effet part à l'impact. Même système de rooms que la Scopa.
- **Puissance 4 Original** — la même chose, sans aucun pouvoir : le Puissance 4 classique sur une grille 7 × 6, dans les quatre mêmes formats. Sa planète est la petite lune en orbite de Puissance 4.
- **UNO** — le jeu de cartes, de 2 à 4 joueurs, avec deux ajouts : deux **cartes mystère** mélangées à la pioche, qui déclenchent un effet-surprise dès qu'on les tire (aucune en duel — sans public, la surprise ne vaut rien), et une option de **surenchère des +** que l'hôte active avant la partie, où un +2 peut être relancé jusqu'à ce que quelqu'un encaisse la pile. Les boutons **UNO** et **Contre UNO** sont à double tranchant : oublier d'annoncer coûte deux cartes, dénoncer à tort aussi.
- La page d'accueil ne montre que des jeux jouables. Une feature en chantier n'a pas de planète tant qu'elle n'a pas de route : `to` vide la grise et la rend inerte, mais mieux vaut ne l'ajouter au roster qu'une fois jouable.

## La page d'accueil

L'accueil est un petit système solaire en 3D : une planète par feature, qui tourne lentement sur elle-même. Cliquer sur une planète disponible déclenche un zoom cinématique façon Google Earth, puis un flash qui enchaîne sur la page du jeu.

Quelques principes, si tu touches à [src/components/planets/](src/components/planets/) :

- **Tout est procédural.** Les surfaces sont générées dans un shader (bruit fBm), il n'y a aucune texture à télécharger. L'identité d'une planète, c'est sa palette et son seed dans [planets.data.ts](src/components/planets/planets.data.ts).
- **Les planètes sont placées en coordonnées écran**, pas en coordonnées monde, puis converties selon leur profondeur. Sinon une planète lointaine se retrouve cachée derrière une proche. Deux compositions : `landscape` et `portrait`.
- **Trois replis** sont en place : grille de cards classique si le navigateur n'a pas WebGL (ou si le contexte est perdu), rotations et zoom désactivés si `prefers-reduced-motion`, et qualité réduite (moins d'étoiles, moins d'octaves de bruit, DPR plafonné) sur petit écran ou machine modeste.
- Three.js n'est chargé que sur l'accueil (`React.lazy`), pour qu'un lien direct vers une room reste léger.

## Stack technique

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [React Router](https://reactrouter.com/) pour la navigation
- [Three.js](https://threejs.org/) + [React Three Fiber](https://r3f.docs.pmnd.rs/) pour le système de planètes de l'accueil
- [PeerJS](https://peerjs.com/) (WebRTC) pour le multijoueur temps réel — aucun serveur de jeu à héberger. Dans chaque jeu, l'hôte fait autorité : il applique toutes les actions via un moteur de règles pur, puis diffuse l'état.
- [Supabase](https://supabase.com/) (Postgres + Auth) pour les comptes, les statistiques et les classements — voir « Comptes et statistiques » plus bas
- Déploiement statique automatique sur GitHub Pages via GitHub Actions

## Développement local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Tests

```bash
npm run test:flip7
```

Le moteur Flip 7 possède des tests déterministes : composition des paquets, doublons, ordre des bonus, cartes spéciales et cascades de Flip Three, distribution initiale, déconnexions, autorisation des actions, fin de manche, égalités et parties complètes simulées avec conservation des cartes. Node 24 est utilisé en CI.

Les détails des règles et de l’implémentation sont dans [src/features/flip7/README.md](src/features/flip7/README.md).

Le moteur de règles du Puissance 4 (gravité, pouvoirs, détection d'alignement) est du code pur, sans React ni réseau — il se teste beaucoup mieux là qu'à la souris :

```bash
npm run test:p4
```

Aucun framework de test : Node exécute le TypeScript directement, [scripts/register-ts.mjs](scripts/register-ts.mjs) se contentant de reproduire la résolution d'imports que Vite applique déjà.

## Comptes et statistiques

Les comptes sont une couche **additive** posée sur un site qui reste statique et
P2P : sans configuration Supabase, tout le site fonctionne exactement comme
avant, simplement sans bouton « Se connecter ».

### Configuration

Deux variables, dans [.env](.env) (versionné) :

| Variable | Rôle |
| --- | --- |
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique du client |

Ces valeurs ne sont pas des secrets : le site étant un build statique, tout ce
que le navigateur doit connaître finit dans le bundle publié, et la clé
*publishable* est faite pour ça. Ce qui protège les données, c'est la Row Level
Security en base — jamais la confidentialité de cette clé. **Ne jamais placer
ici la clé `service_role`**, qui, elle, contourne la RLS.

### Schéma

[supabase/migrations/0001_accounts_and_stats.sql](supabase/migrations/0001_accounts_and_stats.sql)
décrit l'état complet du schéma et peut être rejoué sans risque sur une base
déjà à jour.

- `profiles` — pseudo, bio, préférences. Créé par un trigger sur `auth.users`,
  donc un compte ne peut pas exister sans profil.
- `game_sessions` / `game_results` — une partie, et une ligne par joueur.
- `game_types` — le barème de points, ajustable par un simple `UPDATE`.
- `profile_stats` — vue agrégée (parties, victoires, points, jeu favori).

### Comment une partie est comptée

Il n'y a pas de serveur pour arbitrer : chaque joueur connecté enregistre sa
propre ligne via `record_game_result()`, seule voie d'écriture autorisée. Les
points sont calculés en base, jamais fournis par le client.

Pour que quatre joueurs se retrouvent rattachés à la *même* partie, chaque jeu
produit une **signature** de son état final — faite de champs que tous les pairs
voient à l'identique, et qui change à la revanche. Voir
[src/features/account/gameOutcomes.ts](src/features/account/gameOutcomes.ts).

Conséquence assumée : en P2P, un client modifié peut déclarer une victoire qui
n'a pas eu lieu. Le garde-fou en base plafonne le nombre de vainqueurs par
partie, ce qui attrape les incohérences accidentelles — pas un tricheur
déterminé. C'est le bon niveau d'effort pour un site entre amis.

Le mode solo et les parties contre des bots de Flip 7 ne sont pas enregistrés :
ils se gagnent à volonté, et les compter mettrait en tête du classement le plus
patient plutôt que le meilleur joueur.

### Classements

`get_leaderboard(période, jeu, limite)` agrège à la lecture, avec remise à zéro
à 00:00 UTC (jour, semaine ISO commençant le lundi, mois). Aucune tâche
planifiée à surveiller : le classement ne peut pas être en retard sur les
parties.


## Ajouter une nouvelle feature

Chaque mini-app vit dans son propre dossier sous `src/features/<nom>/`. Pour lui donner sa planète, ajoute une entrée au tableau `PLANETS` de [src/components/planets/planets.data.ts](src/components/planets/planets.data.ts) : un nom, une description, une icône, une palette, et une position pour chacune des deux compositions (`landscape` et `portrait`).

Laisse `to` vide tant que la feature n'est pas prête — c'est la seule chose qui la marque « bientôt disponible » : le grisé, le flou, le halo éteint et le clic inerte en découlent tous. Une fois la route branchée dans [src/App.tsx](src/App.tsx), renseigne `to: '/ta-route'` et la planète s'allume.

Les positions sont en coordonnées écran (`x` en demi-largeurs, `y` en demi-hauteurs, `0` au centre) et `size` est le rayon apparent en fraction de la demi-hauteur — donc ce que tu écris est ce que tu vois, quelle que soit la profondeur. Vérifie juste qu'aucune planète (ni son label, qui pend en dessous) n'en chevauche une autre dans les deux compositions.

## Déploiement

Le site se déploie automatiquement sur GitHub Pages à chaque push sur `main` (voir [.github/workflows/deploy.yml](.github/workflows/deploy.yml)). Le repo doit avoir Pages activé avec la source "GitHub Actions" (Settings → Pages).

Le build copie également l’entrée compilée vers `404.html`, pour que les liens directs de jeux et de rooms soient résolus par React Router sur GitHub Pages.
