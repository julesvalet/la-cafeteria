# La Cafétéria ☕

Le hub de mini-applications et de jeux entre potes. Un seul endroit, plusieurs façons de traîner ensemble.

## Features

- **Flip 7** — un plateau casino, de 2 à 5 amis en ligne, 1 à 3 bots (trois difficultés), ou un entraînement solo illimité. Une roulette révèle chaque carte ; arrête pour sécuriser tes points, ou tente les sept numéros différents. Règles officielles (94 cartes, objectif 200 points) et variante Cafétéria (62 cartes et effets personnalisés) disponibles au salon. Chat intégré, sons et musique activables, statistiques locales, thèmes clair/sombre et mode d’animation léger.

- **Scopa** — le jeu de cartes italien classique, jouable en ligne à 2, 3 ou 4 joueurs. Crée une room, partage le code (ou le lien) à tes potes, et jouez ensemble en temps réel — sans backend, tout passe en pair-à-pair (WebRTC via [PeerJS](https://peerjs.com/)).
- **Puissance 4** — le classique, mais avec des pouvoirs. De 2 à 4 joueurs : duel, chacun pour soi à 3 ou 4, ou 2 v 2 en équipes (l'alignement gagnant peut mélanger les jetons des deux coéquipiers). Personne ne *choisit* ses pouvoirs : chaque joueur reçoit une réserve de jetons pour la partie, dont une minorité tirée au sort est chargée d'un pouvoir — Traversée, Destruction, Inversion de gravité, Double-tour ou Blocage de colonne. Tu joues ta colonne normalement ; si ce jeton-là était chargé, l'effet part à l'impact. Même système de rooms que la Scopa.
- **Puissance 4 Original** — la même chose, sans aucun pouvoir : le Puissance 4 classique sur une grille 7 × 6, dans les quatre mêmes formats.
- **UNO** — le jeu de cartes, de 2 à 4 joueurs, avec deux ajouts : deux **cartes mystère** mélangées à la pioche, qui déclenchent un effet-surprise dès qu'on les tire (aucune en duel — sans public, la surprise ne vaut rien), et une option de **surenchère des +** que l'hôte active avant la partie, où un +2 peut être relancé jusqu'à ce que quelqu'un encaisse la pile. Les boutons **UNO** et **Contre UNO** sont à double tranchant : oublier d'annoncer coûte deux cartes, dénoncer à tort aussi.

## La page d'accueil

D'après la maquette Illustrator (`interface la cafétéria.ai`) : bienvenue et logo
à gauche, les jeux au centre — le **jeu tendance** (le plus joué des 7 derniers
jours, `trending_game()`) en tête, en vert —, le joueur, son niveau et ses amis
à droite, avec l'ajout d'un ami par pseudo. Pour un joueur connecté, le tableau
de bord (tables des amis, classement de la semaine, dernières parties, groupes)
suit juste en dessous. Code : [src/pages/Home.tsx](src/pages/Home.tsx) et
[src/pages/home/](src/pages/home/).

À la première visite, l'écran « LA CAFETERIA — chargement… » laisse place à
l'interface par un zoom flouté. Le niveau affiché est tiré des points
(`level.ts`), rien n'est stocké.

**Fonds du site** (engrenage de l'en-tête) : or luxe, marron casino ou Terre.
Le choix est gardé dans `localStorage.userTheme` et appliqué avant le premier
rendu. `data-backdrop` choisit le décor ; `data-theme` reste `light` / `dark`,
ce dont dépendent tous les jeux. L'image de la Terre a été extraite du fichier
Illustrator (`public/assets/backdrops/`).

## Stack technique

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [React Router](https://reactrouter.com/) pour la navigation
- [Three.js](https://threejs.org/) + [React Three Fiber](https://r3f.docs.pmnd.rs/) pour la roulette de Flip 7
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
parties. `get_leaderboard_rank()` donne la place d'un joueur sur le même
classement, même hors du top 100.

## Amis, groupes et temps réel

Schéma : [supabase/migrations/0002_social.sql](supabase/migrations/0002_social.sql),
à appliquer après 0001 (SQL Editor de Supabase, ou `supabase db push`). Rejouable
sans risque, comme 0001.

Même règle que pour les parties : **lecture par la RLS, écriture uniquement par
des fonctions RPC** (`send_friend_request`, `create_group`, `send_group_message`,
`invite_to_game`…). Aucune table sociale n'a de policy d'écriture : les règles
(seul un admin invite, seul le créateur supprime, on n'écrit pas à quelqu'un
qui nous a bloqué) vivent dans ces fonctions.

| Page | Route |
| --- | --- |
| Tableau de bord | `/tableau-de-bord` |
| Amis (ajout, demandes, défis, blocage) | `/amis` |
| Groupes, et un groupe avec sa discussion | `/groupes`, `/groupes/:id` |
| Classements (publics) | `/classements?periode=weekly&jeu=uno` |
| Fiche publique d'un joueur | `/joueur/:pseudo` |

Le temps réel passe par **Supabase Realtime**, pas par un serveur Socket.io :

- `notifications` (publiée) sert de bus d'événements : demande d'ami, invitation
  de groupe ou de partie, groupe supprimé… Le destinataire la reçoit en direct
  (toast + cloche) ou la retrouve à sa prochaine visite. Les signaux
  `silent` ne font que rafraîchir une liste.
- `group_messages` (publiée) : les messages arrivent en direct, filtrés par la
  RLS — un membre retiré cesse aussitôt de les recevoir.
- Canaux privés `online` (présence) et `group:<id>` (« X écrit… »), autorisés
  par les policies posées sur `realtime.messages`. Si ces canaux échouent, le
  site retombe sur « vu il y a… » et la discussion marche sans indicateur.

Inviter un ami à une partie ne change rien au P2P : l'invitation transporte
seulement le code de room jusqu'à sa cloche.

## Panneau d'amis, sessions, observation, photo de profil

Schéma : [supabase/migrations/0003_sessions_avatars.sql](supabase/migrations/0003_sessions_avatars.sql),
à appliquer après 0002. Rejouable sans risque.

**Pseudo retenu.** La session Supabase persistait déjà ; ce qui redemandait
le pseudo, c'étaient les salons et les liens de room. Connecté, on joue sous le
pseudo du compte et un lien de room s'ouvre sans formulaire. Sans compte, le
dernier pseudo tapé est gardé (`localStorage.userPseudo`), effacé à la
déconnexion. Le jeton, lui, n'est pas recopié : Supabase le gère et le rafraîchit.

**Panneau d'amis** (bouton « Amis » de l'en-tête) : amis triés en ligne /
absent / hors ligne, recherche au-delà de six amis, statut personnel (en
ligne, absent, hors ligne = invisible ; absent automatique après 5 min
d'onglet caché). « Inviter » invite à la table en cours, ou ouvre « Crée ta
session » ; « Rejoindre » s'allume quand l'ami est à une table publique.
Colonne à droite sur ordinateur (la page se décale), tiroir par le bas au
téléphone. Pas de raccourci Tab : il servirait déjà à naviguer au clavier.

**Sessions publiques / privées.** Choisies à la création (salons de chaque jeu,
ou « Crée ta session »). Une table *publique* est annoncée à ses **amis** via
`publish_room()` (battement toutes les 30 s, oubliée après 90 s sans battement) ;
une table *privée* n'est jamais écrite en base. `/sessions` liste les tables
d'amis, et celles où un ami est assis.

**Observation.** Arriver à une table lancée (ou pleine) fait entrer en
observateur : même état masqué qu'un joueur, donc aucune main visible ; aucun
clic ne passe (`inert`, et l'hôte ignore toute action d'un observateur). Les
joueurs voient la liste des observateurs. « Rejoindre la manche suivante »
réserve la prochaine place : quand un joueur est parti, son siège revient au
premier observateur en attente au début de la manche ou de la revanche
suivante. Code commun : [src/features/rooms/spectators.ts](src/features/rooms/spectators.ts).

**Trophées.** Schéma [0004_achievements.sql](supabase/migrations/0004_achievements.sql) :
20 trophées (victoires, par jeu, sociabilité, défis), calculés en base après
chaque partie (`record_game_result`) et à l'ouverture de l'accueil ou du profil
(`refresh_my_achievements`, pour les groupes et le podium de la semaine passée).
Un déblocage émet une notification `achievement` : pop-up doré, petite fanfare.
Les compteurs propres à un jeu (scopas, cartes spéciales UNO, arrêts à la
première carte au Flip 7) viennent du client, bornés : un client modifié peut
les gonfler, comme il peut déjà déclarer une victoire en P2P.

**Photo de profil.** Recadrée en cercle et réencodée en 512 × 512 dans le
navigateur (métadonnées GPS perdues au passage), puis déposée dans le bucket
public `avatars` sous `users/<id>/`. Une contrainte en base interdit à
`profiles.avatar` de pointer ailleurs que dans le dossier du joueur.


## Ajouter une nouvelle feature

Chaque mini-app vit dans son propre dossier sous `src/features/<nom>/`. Pour
qu'elle apparaisse sur l'accueil, ajoute-la au tableau `GAMES` de
[src/features/games.ts](src/features/games.ts), et à `game_types` en base si
ses parties doivent compter.

## Déploiement

Le site se déploie automatiquement sur GitHub Pages à chaque push sur `main` (voir [.github/workflows/deploy.yml](.github/workflows/deploy.yml)). Le repo doit avoir Pages activé avec la source "GitHub Actions" (Settings → Pages).

Le build copie également l’entrée compilée vers `404.html`, pour que les liens directs de jeux et de rooms soient résolus par React Router sur GitHub Pages.
