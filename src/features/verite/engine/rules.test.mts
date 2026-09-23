import {
  MAX_PARTICIPANTS,
  applyAction,
  createInitialState,
  eligiblePlayers,
  maskState,
  revealDuration,
  standings,
  typeDelay,
} from './rules.ts';
import { BASE_QUESTIONS } from './questions.ts';
import { veriteOutcome, veriteStats } from '../../account/gameOutcomes.ts';
import type { VeriteAction, VeriteState } from './types.ts';

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    failures++;
    console.log('  FAIL ' + label, extra === undefined ? '' : JSON.stringify(extra));
  } else {
    console.log('  ok   ' + label);
  }
}

function run(state: VeriteState, action: VeriteAction): VeriteState {
  const r = applyAction(state, action);
  if (r.error) console.log('    (error: ' + r.error + ')');
  return r.state;
}

function errorOf(state: VeriteState, action: VeriteAction): string | undefined {
  return applyAction(state, action).error;
}

/** L'hôte `host` + `players - 1` autres, `host` désigné chef si `hostIsChef`. */
function lobby(players: number, seed = 42, hostIsChef = true): VeriteState {
  let s = createInitialState('TEST', 'host', seed);
  s = run(s, { type: 'JOIN', playerId: 'host', name: 'Hôte' });
  for (let i = 1; i < players; i++) s = run(s, { type: 'JOIN', playerId: 'p' + i, name: 'J' + i });
  if (hostIsChef) s = run(s, { type: 'SET_CHEF', playerId: 'host', chefId: 'host' });
  return s;
}

/** Avance la manche jusqu'à la saisie de la réponse. */
function toAnswering(s: VeriteState): VeriteState {
  const r = s.round!;
  s = run(s, { type: 'ADVANCE', seq: r.seq, draw: r.draw, to: 'reveal' });
  return run(s, { type: 'ADVANCE', seq: r.seq, draw: r.draw, to: 'answering' });
}

/** Joue une manche complète : réponse, verdict. */
function playRound(s: VeriteState, valid: boolean): VeriteState {
  s = toAnswering(s);
  s = run(s, { type: 'ANSWER', playerId: s.round!.targetId, text: 'Ma réponse' });
  return run(s, { type: 'VERDICT', playerId: s.chefId!, valid });
}

console.log('Lancement');
{
  const s = lobby(2);
  check('refusé avec un seul joueur hors chef', Boolean(errorOf(s, { type: 'START', playerId: 'host' })));
  const noChef = lobby(3, 1, false);
  check('refusé sans chef', Boolean(errorOf(noChef, { type: 'START', playerId: 'host' })));
  const ok = lobby(3);
  check('refusé à un non-hôte', Boolean(errorOf(ok, { type: 'START', playerId: 'p1' })));
  const started = run(ok, { type: 'START', playerId: 'host' });
  check('la partie démarre', started.phase === 'playing');
  check('la bouteille tourne tout de suite', started.round?.stage === 'spinning' && started.round.seq === 1);
  check('le chef n’est jamais désigné', started.round?.targetId !== 'host');
  check('le cercle exclut le chef', !started.round!.ring.includes('host') && started.round!.ring.length === 2);
}

console.log('Déroulé d’une manche');
{
  let s = run(lobby(3), { type: 'START', playerId: 'host' });
  const target = s.round!.targetId;
  const other = target === 'p1' ? 'p2' : 'p1';
  check(
    'pas de réponse pendant que la bouteille tourne',
    Boolean(errorOf(s, { type: 'ANSWER', playerId: target, text: 'x' })),
  );
  const stale = run(s, { type: 'ADVANCE', seq: 99, draw: 0, to: 'reveal' });
  check('une minuterie périmée ne fait rien', stale.round?.stage === 'spinning');
  const skip = run(s, { type: 'ADVANCE', seq: 1, draw: 0, to: 'answering' });
  check('on ne saute pas le retournement', skip.round?.stage === 'spinning');
  s = toAnswering(s);
  check('saisie ouverte après la révélation', s.round?.stage === 'answering');
  check('un autre joueur ne répond pas', Boolean(errorOf(s, { type: 'ANSWER', playerId: other, text: 'x' })));
  check('une réponse vide est refusée', Boolean(errorOf(s, { type: 'ANSWER', playerId: target, text: '   ' })));
  s = run(s, { type: 'ANSWER', playerId: target, text: '  J’adore   les pizzas  ' });
  check('réponse nettoyée', s.round?.answer === 'J’adore les pizzas');
  check('en attente du chef', s.round?.stage === 'judging');
  check('un joueur ne valide pas', Boolean(errorOf(s, { type: 'VERDICT', playerId: other, valid: true })));
  s = run(s, { type: 'VERDICT', playerId: 'host', valid: true });
  check('+1 pour une réponse valide', s.players.find((p) => p.id === target)?.score === 1);
  check('manche archivée', s.history.length === 1 && s.history[0].verdict === true);
  check('seul le chef relance', Boolean(errorOf(s, { type: 'SPIN', playerId: target })));
  s = run(s, { type: 'SPIN', playerId: 'host' });
  check('manche 2', s.round?.seq === 2 && s.round.stage === 'spinning');
  check('la bouteille tourne toujours dans le même sens', s.round!.angle > 0);
}

console.log('Répartition des tours');
{
  let s = run(lobby(5, 7), { type: 'START', playerId: 'host' });
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    seen.push(s.round!.targetId);
    s = playRound(s, i % 2 === 0);
    s = run(s, { type: 'SPIN', playerId: 'host' });
  }
  const counts = new Map<string, number>();
  for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
  check('chacun des 4 joueurs répond 2 fois sur 8 manches', [...counts.values()].every((n) => n === 2) && counts.size === 4, [...counts]);
  check('jamais deux fois de suite', seen.every((id, i) => i === 0 || id !== seen[i - 1]), seen);
}

console.log('Angle de la bouteille');
{
  let s = run(lobby(4, 3), { type: 'START', playerId: 'host' });
  for (let i = 0; i < 6; i++) {
    const r = s.round!;
    const step = 360 / r.ring.length;
    const pointed = (((r.angle % 360) + 360) % 360) / step;
    const nearest = Math.round(pointed) % r.ring.length;
    check(`manche ${r.seq} : la bouteille pointe sur le joueur désigné`, r.ring[nearest] === r.targetId, {
      angle: r.angle,
      ring: r.ring,
      target: r.targetId,
    });
    const prev = r.angle;
    s = playRound(s, true);
    s = run(s, { type: 'SPIN', playerId: 'host' });
    check(`manche ${r.seq + 1} : au moins 3 tours complets`, s.round!.angle - prev >= 3 * 360);
  }
}

console.log('Thèmes');
{
  const clean = run(lobby(3, 11), { type: 'START', playerId: 'host' });
  check('CLEAN ne sort que du clean', clean.round?.question.theme === 'clean');

  let hard = run(lobby(3, 11), { type: 'SET_OPTIONS', playerId: 'host', theme: 'hard', rounds: 10 });
  hard = run(hard, { type: 'START', playerId: 'host' });
  check('HARD sort du hard', hard.round?.question.theme === 'hard');

  let n = run(lobby(3, 5), { type: 'SET_OPTIONS', playerId: 'host', theme: 'normal', rounds: 0 });
  n = run(n, { type: 'START', playerId: 'host' });
  for (let i = 0; i < 11; i++) {
    n = playRound(n, true);
    n = run(n, { type: 'SPIN', playerId: 'host' });
  }
  n = playRound(n, true);
  const spicy = n.history.filter((h) => h.theme === 'normal').length;
  check('NORMAL : exactement 3 questions qui piquent sur 12 manches', spicy === 3, n.history.map((h) => h.theme));
  const blocks = [0, 1, 2].map((b) => n.history.slice(b * 4, b * 4 + 4).filter((h) => h.theme === 'normal').length);
  check('une par tranche de 4', blocks.every((c) => c === 1), blocks);
}

console.log('Banque de questions');
{
  for (const t of ['clean', 'normal', 'hard'] as const) {
    check(`${t} : 15 questions, sans doublon`, BASE_QUESTIONS[t].length === 15 && new Set(BASE_QUESTIONS[t].map((q) => q.text)).size === 15);
  }
  const spicyCounts: number[] = [];
  for (let seed = 1; seed <= 20; seed++) {
    let n = run(lobby(3, seed), { type: 'SET_OPTIONS', playerId: 'host', theme: 'normal', rounds: 10 });
    n = run(n, { type: 'START', playerId: 'host' });
    for (let i = 0; i < 10; i++) {
      n = playRound(n, true);
      if (i < 9) n = run(n, { type: 'SPIN', playerId: 'host' });
    }
    spicyCounts.push(n.history.filter((h) => h.theme === 'normal').length);
  }
  check('NORMAL en 10 manches : toujours 2 ou 3 questions qui piquent', spicyCounts.every((c) => c === 2 || c === 3), spicyCounts);

  let long = run(lobby(3, 4), { type: 'SET_OPTIONS', playerId: 'host', theme: 'clean', rounds: 20 });
  long = run(long, { type: 'START', playerId: 'host' });
  const texts: string[] = [];
  for (let i = 0; i < 20; i++) {
    texts.push(long.round!.question.text);
    long = playRound(long, true);
    if (i < 19) long = run(long, { type: 'SPIN', playerId: 'host' });
  }
  check('20 manches sur 15 questions : les 15 sortent avant toute répétition', new Set(texts.slice(0, 15)).size === 15, texts);
  check('jamais deux fois la même question de suite', texts.every((t, i) => i === 0 || t !== texts[i - 1]));
}

console.log('Nombre de manches');
{
  let s = run(lobby(3), { type: 'SET_OPTIONS', playerId: 'host', theme: 'clean', rounds: 2 });
  s = run(s, { type: 'START', playerId: 'host' });
  s = playRound(s, true);
  s = run(s, { type: 'SPIN', playerId: 'host' });
  s = playRound(s, false);
  s = run(s, { type: 'SPIN', playerId: 'host' });
  check('fin après la dernière manche', s.phase === 'ended');
  const ranking = standings(s);
  check('classement sans le chef', ranking.length === 2 && !ranking.some((p) => p.id === 'host'));
  check('le classement suit le score', ranking[0].score >= ranking[1].score);
  s = run(s, { type: 'REMATCH', playerId: 'host' });
  check('revanche : retour au salon, scores à zéro', s.phase === 'lobby' && s.players.every((p) => p.score === 0));
  check('revanche : le chef reste', s.chefId === 'host');
}

console.log('Questions perso');
{
  let s = lobby(3);
  check(
    'trop courte',
    Boolean(errorOf(s, { type: 'ADD_CUSTOM', playerId: 'p1', text: 'Oui', theme: 'clean' })),
  );
  s = run(s, { type: 'ADD_CUSTOM', playerId: 'p1', text: 'Qui a mangé mon yaourt ?', theme: 'clean' });
  check('ajoutée', s.customs.length === 1 && s.customs[0].source === 'private');
  check(
    'pas de doublon',
    Boolean(errorOf(s, { type: 'ADD_CUSTOM', playerId: 'p2', text: 'qui a mangé mon yaourt ?', theme: 'clean' })),
  );
  const masked = maskState(s, 'p2');
  check('texte caché aux autres', masked.customs[0].text === '');
  check('visible par son auteur', maskState(s, 'p1').customs[0].text === 'Qui a mangé mon yaourt ?');
  check('un autre ne la retire pas', Boolean(errorOf(s, { type: 'REMOVE_CUSTOM', playerId: 'p2', questionId: s.customs[0].id })));

  s = run(s, { type: 'ADD_CUSTOM', playerId: 'p2', text: 'Ta pire coupe de cheveux ?', theme: 'clean', publicId: 'abc' });
  check('publique : identifiant de la base', s.customs[1].id === 'pub-abc' && s.customs[1].source === 'public');

  s = run(s, { type: 'SET_OPTIONS', playerId: 'host', theme: 'clean', rounds: 10 });
  s = run(s, { type: 'START', playerId: 'host' });
  const texts: string[] = [];
  for (let i = 0; i < 10; i++) {
    texts.push(s.round!.question.text);
    s = playRound(s, true);
    if (i < 9) s = run(s, { type: 'SPIN', playerId: 'host' });
  }
  check('les questions perso sortent dans la partie', texts.includes('Qui a mangé mon yaourt ?') && texts.includes('Ta pire coupe de cheveux ?'), texts);
  check('aucune question en double', new Set(texts).size === texts.length);
}

console.log('Pool public');
{
  let s = run(lobby(3), { type: 'SET_OPTIONS', playerId: 'host', theme: 'hard', rounds: 0 });
  s = run(s, {
    type: 'START',
    playerId: 'host',
    publicPool: [{ id: 'pub-z', text: 'Question publique hard ?', theme: 'hard', source: 'public' }],
  });
  check('mélangé à la pioche, invisible des joueurs', s.publicPool.length === 1 && maskState(s, 'p1').publicPool.length === 0);
  const remote = maskState(s, 'p1');
  check('pioche et graine masquées', remote.decks.hard.length === 0 && remote.seed === 0);
  check('question cachée tant que la bouteille tourne', remote.round?.question.text === '');
}

console.log('Changer de question');
{
  let s = run(lobby(3), { type: 'START', playerId: 'host' });
  const first = s.round!.question.id;
  check('pas pendant la rotation', Boolean(errorOf(s, { type: 'REDRAW', playerId: 'host' })));
  s = toAnswering(s);
  s = run(s, { type: 'REDRAW', playerId: 'host' });
  check('nouvelle question, même joueur', s.round!.question.id !== first && s.round!.draw === 1);
  check('la carte se retourne à nouveau', s.round!.stage === 'reveal');
  const stale = run(s, { type: 'ADVANCE', seq: s.round!.seq, draw: 0, to: 'answering' });
  check('la minuterie de l’ancienne carte est ignorée', stale.round!.stage === 'reveal');
}

console.log('Départs et arrivées');
{
  let s = run(lobby(4), { type: 'START', playerId: 'host' });
  const target = s.round!.targetId;
  s = run(s, { type: 'LEAVE', playerId: target });
  check('le joueur désigné part : manche annulée', s.round?.stage === 'verdict' && s.round.voided);
  check('annulée sans point', s.history.at(-1)?.verdict === null);
  const name = s.players.find((p) => p.id === target)!.name;
  s = run(s, { type: 'JOIN', playerId: 'new-peer', name });
  const back = s.players.find((p) => p.id === 'new-peer');
  check('retour avec le même pseudo : même siège', Boolean(back?.connected) && s.players.length === 4);

  s = run(s, { type: 'JOIN', playerId: 'late', name: 'Tardif' });
  const late = s.players.find((p) => p.id === 'late')!;
  const minTurns = Math.min(...eligiblePlayers(s).filter((p) => p.id !== 'late').map((p) => p.turns));
  check('arrivée en cours de partie : dans la rotation', late.connected && late.turns === minTurns);

  s = run(s, { type: 'LEAVE', playerId: 'host' });
  check('chef parti : l’arbitrage revient à l’hôte… absent, donc personne', Boolean(errorOf(s, { type: 'SPIN', playerId: 'p1' })));
  s = run(s, { type: 'SET_CHEF', playerId: 'p1', chefId: 'p1' });
  check('un joueur reprend le rôle de chef vacant', s.chefId === 'p1');
}

console.log('Table complète');
{
  let s = lobby(MAX_PARTICIPANTS);
  check('7 personnes maximum', Boolean(errorOf(s, { type: 'JOIN', playerId: 'x', name: 'X' })));
  s = run(s, { type: 'LEAVE', playerId: 'p1' });
  check('au salon, un départ libère la place', s.players.length === MAX_PARTICIPANTS - 1);
}

console.log('Chef');
{
  let s = lobby(3, 9, false);
  check('un joueur prend le rôle vacant', run(s, { type: 'SET_CHEF', playerId: 'p2', chefId: 'p2' }).chefId === 'p2');
  s = run(s, { type: 'SET_CHEF', playerId: 'host', chefId: 'p1' });
  check('l’hôte désigne', s.chefId === 'p1');
  check('un joueur ne prend pas la place d’un chef présent', Boolean(errorOf(s, { type: 'SET_CHEF', playerId: 'p2', chefId: 'p2' })));
  s = run(s, { type: 'RANDOM_CHEF', playerId: 'host' });
  check('tirage au sort parmi les présents', s.players.some((p) => p.id === s.chefId));
}

console.log('Cadence');
{
  check('~100 ms par lettre pour une question courte', typeDelay('Ton plat préféré ?') === 100);
  const long = 'x'.repeat(150);
  check('frappe plafonnée à 4,5 s pour une longue question', [...long].length * typeDelay(long) <= 5300);
  check('pause avant de répondre comprise', revealDuration('abc') === 800 + 300 + 1500);
}

console.log('Esquive, fin de partie et compteurs');
{
  let s = run(lobby(3, 21), { type: 'SET_OPTIONS', playerId: 'host', theme: 'hard', rounds: 4 });
  s = run(s, { type: 'ADD_CUSTOM', playerId: 'p1', text: 'Ta pire honte au collège ?', theme: 'hard' });
  s = run(s, { type: 'START', playerId: 'host' });
  check('numéro de partie', s.gameNo === 1 && !s.completed);
  const first = s.round!.targetId;
  check('pas d’esquive avant la fin de la question', Boolean(errorOf(s, { type: 'SKIP', playerId: first })));
  s = toAnswering(s);
  check('un autre n’esquive pas pour lui', Boolean(errorOf(s, { type: 'SKIP', playerId: first === 'p1' ? 'p2' : 'p1' })));
  s = run(s, { type: 'SKIP', playerId: first });
  check('esquive : manche close, invalide, sans point', s.round?.stage === 'verdict' && s.round.skipped && s.history.at(-1)?.skipped === true);
  for (let i = 0; i < 3; i++) {
    s = run(s, { type: 'SPIN', playerId: 'host' });
    s = playRound(s, true);
  }
  s = run(s, { type: 'SPIN', playerId: 'host' });
  check('dernière manche jouée : partie complète', s.phase === 'ended' && s.completed);
  const chef = veriteOutcome(s, 'host', 'TEST');
  check('le chef ne gagne pas, sa partie complète compte', chef?.won === false && chef.details?.chef_complete === 1, chef);
  const stats = veriteStats(s, first);
  check('l’esquive casse la série', stats.answer_streak <= stats.answered && stats.answered === s.history.filter((h) => h.targetId === first && !h.skipped).length, stats);
  const author = s.history.some((h) => h.questionBy === 'p1' && h.targetId !== 'p1' && h.verdict) ? 1 : 0;
  check('question perso validée créditée à son auteur', veriteStats(s, 'p1').custom_validated === author);
  const o1 = veriteOutcome(s, 'p1', 'TEST');
  const o2 = veriteOutcome(s, 'p2', 'TEST');
  check('même signature chez tous les joueurs', o1?.signature === o2?.signature && o1?.signature === chef?.signature);
  check('au plus un vainqueur', [o1, o2].filter((o) => o?.won).length <= 1);

  let again = run(s, { type: 'REMATCH', playerId: 'host' });
  again = run(again, { type: 'START', playerId: 'host' });
  again = run(again, { type: 'END', playerId: 'host' });
  check('arrêtée avant la fin : pas complète', again.phase === 'ended' && !again.completed);
  check('revanche : nouvelle signature', veriteOutcome(again, 'host', 'TEST')?.signature !== chef?.signature || again.history.length === 0);
}

console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
if (failures) process.exit(1);
