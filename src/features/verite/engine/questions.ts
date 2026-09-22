import type { VeriteQuestion, VeriteTheme } from './types';

/*
 * La banque de questions du jeu : 15 par thème.
 *
 * Elle vit dans le code plutôt qu'en base : une partie doit pouvoir se jouer
 * sans compte ni Supabase, comme tous les jeux du site. La base ne sert qu'aux
 * questions ajoutées par les joueurs (voir api.ts).
 *
 * Le tirage se fait dans rules.ts : une pioche mélangée par thème, sans
 * doublon jusqu'à épuisement — puis elle est rebattue.
 */

export const TRUTH_QUESTIONS: Record<VeriteTheme, string[]> = {
  // Innocentes et amusantes.
  clean: [
    'Quel est ton plat préféré ?',
    'Quel est ton film préféré ?',
    'Tu préfères chat ou chien ?',
    'Ton moment préféré de la journée ?',
    'Quel superpouvoir tu choisirais ?',
    'Meilleur souvenir avec tes potes ?',
    'Tu dormirais pendant combien de temps en vacances ?',
    'Quel est ton sport préféré ?',
    'Une habitude gênante que tu as ?',
    'Ton jeu vidéo préféré ?',
    'Plutôt montagne ou plage ?',
    'Quel artiste tu écoutes le plus ?',
    'Ta pire crainte ridicule ?',
    'Tu préfères hiver ou été ?',
    'Ton plus grand rêve ?',
  ],

  // Qui piquent : en partie NORMAL, une toutes les quatre manches.
  normal: [
    'Tu as déjà menti à tes potes ? Pourquoi ?',
    'Quelque chose que tu caches à tes parents ?',
    'T’as jamais flashé sur un pote ?',
    'Pire mensonge que tu as fait cette année ?',
    'Une personne avec qui t’aimerais pas être coincé seul ?',
    'T’as déjà trahi la confiance de quelqu’un ?',
    'Quel pote tu trouves chelou en secret ?',
    'T’as jalousé quelqu’un récemment ?',
    'Une chose que tu trouves chez toi qui te plaît pas ?',
    'T’as déjà pleuré en secret ?',
    'Un secret que tu garderais jamais ?',
    'Tu trouves quelqu’un dans le groupe un peu trop… ?',
    'Pire jour/situation embarrassante ?',
    'T’as déjà spyé quelqu’un sur ses réseaux ?',
    'Quelque chose d’hypocrite que tu as dit/fait ?',
  ],

  // Osées : fantasmes, trahisons, hypocrisie. 18+.
  hard: [
    'Tes plus gros fantasmes ?',
    'T’as déjà trompé quelqu’un ?',
    'Quelle est la personne la plus chelou avec qui t’aurais un truc ?',
    'T’as déjà menti pendant un rapport ?',
    'Ton kink le plus bizarre ?',
    'T’as déjà été jaloux d’un ami amoureux ?',
    'Quelque chose de très intime que personne sait ?',
    'T’as déjà pensé à quelqu’un du groupe en… ?',
    'Pire hypocrisie que tu as ?',
    'T’aimerais jamais que les gens sachent quoi sur toi ?',
    'La pire trahison que tu pourrais faire à tes potes ?',
    'T’as déjà regardé du contenu glauque ?',
    'Quelque chose d’illégal que t’as fait et regretté ?',
    'T’as déjà flirté avec quelqu’un en couple ?',
    'T’as des pensées obsédantes bizarres ?',
  ],
};

function bank(theme: VeriteTheme): VeriteQuestion[] {
  return TRUTH_QUESTIONS[theme].map((text, i) => ({ id: `${theme}-${i + 1}`, text, theme, source: 'base' as const }));
}

export const BASE_QUESTIONS: Record<VeriteTheme, VeriteQuestion[]> = {
  clean: bank('clean'),
  normal: bank('normal'),
  hard: bank('hard'),
};

/** Les libellés des thèmes, tels que les cartes et les onglets les affichent. */
export const THEME_INFO: Record<VeriteTheme, { label: string; tagline: string; badge: string }> = {
  clean: { label: 'CLEAN', tagline: 'Innocent et marrant, pour chauffer la salle.', badge: 'FUN' },
  normal: { label: 'NORMAL', tagline: 'Surtout du fun… et 2-3 questions qui piquent.', badge: 'ÇA PIQUE' },
  hard: { label: 'HARD', tagline: 'Fantasmes, trahisons, hypocrisie. Réservé aux adultes.', badge: '18+' },
};

/** Les exemples du carrousel d'accueil : une carte par thème. */
const pick = (theme: VeriteTheme, indexes: number[]) => indexes.map((i) => TRUTH_QUESTIONS[theme][i]);

export const SAMPLE_QUESTIONS: Record<VeriteTheme, string[]> = {
  clean: pick('clean', [0, 4, 10, 14]),
  normal: pick('normal', [0, 2, 6, 13]),
  hard: pick('hard', [0, 1, 6, 9]),
};
