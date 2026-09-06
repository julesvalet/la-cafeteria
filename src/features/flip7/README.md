# Flip 7

Routes : `/flip7` (salon) et `/flip7/:code` (table). La planète Flip 7 utilise le zoom et les replis de l’accueil existant. Le jeu, le réseau PeerJS et la roulette Three.js sont chargés séparément à la demande.

## Règles

Le cahier des charges annonçait 94 cartes, mais sa liste totalisait 62 cartes et décrivait des effets différents du jeu illustré. Les deux options sont disponibles, explicitement nommées :

- **Flip 7** (réglage initial) : 94 cartes, un zéro, N copies de chaque nombre de 1 à 12, un exemplaire de chacun des cinq bonus et du ×2, trois Freeze, trois Flip Three et trois Second Chance. Distribution initiale, alternance des joueurs à chaque carte, cibles actives, bonus de sept numéros, manches jusqu’à 200 points et prolongation en cas d’égalité en tête. Source : [règles de l’éditeur, édition 3.1](https://cdn.shopify.com/s/files/1/0611/3958/3198/files/25_FLIP_7_TB_RULES_C_Rev_9_2_25_ND.pdf?v=1756935535), [FAQ officielle](https://theop.games/pages/flip-7-faqs).
- **Cafétéria** : les 62 cartes listées dans la demande. Le joueur continue jusqu’à son arrêt ou son doublon ; ×2 multiplie le score actuel, les + s’ajoutent immédiatement, Flip Three retire 3 points, Freeze conserve la pile mais passe la main et fait sauter la prochaine occasion de jouer. Second Chance permet de recommencer à zéro une seule fois par manche, automatiquement. Pas de fin de partie imposée.

L’entraînement solo laisse continuer les manches sans limite. Les bots utilisent un choix aléatoire, des seuils de score ou le risque réel de doublon selon leur difficulté. Le niveau difficile applique le seuil de 30 % demandé ; ce n’est pas une preuve d’optimalité mathématique.

## Synchronisation et animations

L’hôte est seul responsable du mélange, du tirage et des effets. Les clients envoient des commandes courtes, analysées avant traitement. L’identité provient de la connexion, les commandes de jeu incluent une révision et un identifiant pour refuser les actions périmées ou répétées. La pioche et les instructions de distribution ne sont jamais envoyées aux clients. Le chat est limité à 300 caractères par message et aux 100 derniers messages ; React les affiche comme du texte.

Chaque distribution ou tirage forcé passe par une étape séparée et un verrou de révélation de 2,6 secondes. Les effets Freeze et Flip Three reçus pendant un Flip Three sont différés jusqu’à ses trois tirages ; un doublon non protégé les annule. Les cartes d’action jouées restent hors de la pioche jusqu’à la manche suivante.

Une déconnexion libère une place au salon. En partie, le joueur quitte la manche et les choix en attente ne peuvent pas bloquer la table. La fermeture de l’hôte termine la session : pas de migration d’hôte, de sauvegarde de partie ou de reconnexion après rechargement. Les statistiques personnelles sont conservées dans localStorage, avec déduplication par manche. Le jeu reste utilisable si ce stockage est refusé.

PeerJS utilise son service public de signalisation, comme les autres jeux du dépôt. Aucun serveur de jeu n’est requis. Des réseaux restrictifs peuvent empêcher WebRTC ; aucun relais TURN privé n’est configuré.

## Graphisme et audio

Les cartes sont des SVG originaux générés par le composant `FlipCard` : les exemplaires d’une même face partagent le même dessin. La référence a guidé les couleurs et l’encadrement Art déco ; il n’y a pas de scans des cartes commerciales ni de lot de 94 PNG dupliqués. Le feutre, les jetons et les effets sont dessinés en CSS. Sons et accompagnement musical originaux sont synthétisés avec Web Audio et activés par une action explicite du joueur.

La roulette Three.js fonctionne sur grand écran ; le mode léger utilise CSS sur mobile, avec préférence de mouvement réduit, ou après perte du contexte WebGL. Un bouton permet de choisir manuellement le mode léger. Les animations utilisent transform/opacité, et le canvas n’existe que pendant une révélation. Le rendu à 60 FPS reste dépendant de l’appareil et du navigateur.

## Vérification

`npm run test:flip7`, `npm run build` et `npm run lint`. Le workflow GitHub Pages compile, exécute les tests Flip 7 et lint avant de déployer. Les tests du moteur couvrent également 60 parties déterministes de 2 à 5 joueurs, chacune sur plusieurs manches.
