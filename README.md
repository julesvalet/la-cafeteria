# La Cafétéria ☕

Le hub de mini-applications et de jeux entre potes. Un seul endroit, plusieurs façons de traîner ensemble.

## Features

- **Scopa** — le jeu de cartes italien classique, jouable en ligne à 2, 3 ou 4 joueurs. Crée une room, partage le code (ou le lien) à tes potes, et jouez ensemble en temps réel — sans backend, tout passe en pair-à-pair (WebRTC via [PeerJS](https://peerjs.com/)).
- D'autres features arriveront plus tard (visibles sur la page d'accueil, marquées "Bientôt disponible").

## Stack technique

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [React Router](https://reactrouter.com/) pour la navigation
- [PeerJS](https://peerjs.com/) (WebRTC) pour le multijoueur temps réel de Scopa — aucun serveur de jeu à héberger
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

## Ajouter une nouvelle feature

Chaque mini-app vit dans son propre dossier sous `src/features/<nom>/`. Pour l'afficher sur la page d'accueil, ajoute une entrée dans le tableau `FEATURES` de [src/pages/Home.tsx](src/pages/Home.tsx) — avec `comingSoon: true` tant qu'elle n'est pas prête, puis retire ce flag et ajoute `to: '/ta-route'` une fois branchée dans [src/App.tsx](src/App.tsx).

## Déploiement

Le site se déploie automatiquement sur GitHub Pages à chaque push sur `main` (voir [.github/workflows/deploy.yml](.github/workflows/deploy.yml)). Le repo doit avoir Pages activé avec la source "GitHub Actions" (Settings → Pages).
