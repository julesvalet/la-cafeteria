# La Cafétéria ☕

Le hub de mini-applications et de jeux entre potes. Un seul endroit, plusieurs façons de traîner ensemble.

## Features

- **Scopa** — le jeu de cartes italien classique, jouable en ligne à 2, 3 ou 4 joueurs. Crée une room, partage le code (ou le lien) à tes potes, et jouez ensemble en temps réel — sans backend, tout passe en pair-à-pair (WebRTC via [PeerJS](https://peerjs.com/)).
- **Puissance 4** — le classique, mais avec des pouvoirs. De 2 à 4 joueurs : duel, chacun pour soi à 3 ou 4, ou 2 v 2 en équipes (l'alignement gagnant peut mélanger les jetons des deux coéquipiers). Personne ne *choisit* ses pouvoirs : chaque joueur reçoit une réserve de jetons pour la partie, dont une minorité tirée au sort est chargée d'un pouvoir — Traversée, Destruction, Inversion de gravité, Double-tour ou Blocage de colonne. Tu joues ta colonne normalement ; si ce jeton-là était chargé, l'effet part à l'impact. Même système de rooms que la Scopa.
- D'autres features arriveront plus tard (Buckshot Roulette, Le Salon, Le Flipper, La Boîte à Idées). Leurs planètes sont déjà visibles sur la page d'accueil, grisées et non cliquables.

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

Le moteur de règles du Puissance 4 (gravité, pouvoirs, détection d'alignement) est du code pur, sans React ni réseau — il se teste beaucoup mieux là qu'à la souris :

```bash
npm run test:p4
```

Aucun framework de test : Node exécute le TypeScript directement, [scripts/register-ts.mjs](scripts/register-ts.mjs) se contentant de reproduire la résolution d'imports que Vite applique déjà.

## Ajouter une nouvelle feature

Chaque mini-app vit dans son propre dossier sous `src/features/<nom>/`. Pour lui donner sa planète, ajoute une entrée au tableau `PLANETS` de [src/components/planets/planets.data.ts](src/components/planets/planets.data.ts) : un nom, une description, une icône, une palette, et une position pour chacune des deux compositions (`landscape` et `portrait`).

Laisse `to` vide tant que la feature n'est pas prête — c'est la seule chose qui la marque « bientôt disponible » : le grisé, le flou, le halo éteint et le clic inerte en découlent tous. Une fois la route branchée dans [src/App.tsx](src/App.tsx), renseigne `to: '/ta-route'` et la planète s'allume.

Les positions sont en coordonnées écran (`x` en demi-largeurs, `y` en demi-hauteurs, `0` au centre) et `size` est le rayon apparent en fraction de la demi-hauteur — donc ce que tu écris est ce que tu vois, quelle que soit la profondeur. Vérifie juste qu'aucune planète (ni son label, qui pend en dessous) n'en chevauche une autre dans les deux compositions.

## Déploiement

Le site se déploie automatiquement sur GitHub Pages à chaque push sur `main` (voir [.github/workflows/deploy.yml](.github/workflows/deploy.yml)). Le repo doit avoir Pages activé avec la source "GitHub Actions" (Settings → Pages).
