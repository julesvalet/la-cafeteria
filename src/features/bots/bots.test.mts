/*
 * Les bots jouent des parties entières entre eux, dans chaque jeu : aucune ne
 * doit se bloquer ni tenter un coup illégal, et un bot difficile doit battre
 * un bot facile nettement plus souvent qu'il ne perd.
 */
import type { BotLevel, BotSeat } from './bots.ts';
import * as scopa from '../scopa/engine/rules.ts';
import { scopaDecide } from '../scopa/engine/ai.ts';
import * as uno from '../uno/engine/rules.ts';
import { unoDecide } from '../uno/engine/ai.ts';
import * as p4 from '../puissance4/engine/rules.ts';
import { p4Decide } from '../puissance4/engine/ai.ts';
import { MODES, ORIGINAL_MODES } from '../puissance4/engine/modes.ts';
import type { P4Mode } from '../puissance4/engine/types.ts';

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (!cond) failures++;
  console.log(`${cond ? '  ok  ' : '  FAIL'} ${label}${!cond && extra !== undefined ? ' ' + JSON.stringify(extra) : ''}`);
}

const seats = (levels: BotLevel[]): BotSeat[] => levels.map((level, i) => ({ id: `bot-${i + 1}`, name: `B${i + 1}`, level }));
const MAX_STEPS = 5000;

// --- Scopa -------------------------------------------------------------------------

function playScopa(levels: BotLevel[]) {
  const bots = seats(levels);
  let s = scopa.createInitialState('SIM', bots[0].id);
  for (const b of bots) s = scopa.applyAction(s, { type: 'JOIN', playerId: b.id, name: b.name }).state;
  s = scopa.applyAction(s, { type: 'START' }).state;
  let errors = 0;
  for (let step = 0; step < MAX_STEPS && s.phase !== 'match-end'; step++) {
    if (s.phase === 'hand-end') {
      s = scopa.applyAction(s, { type: 'NEXT_HAND' }).state;
      continue;
    }
    const move = scopaDecide(s, bots);
    if (!move) return { stuck: true, errors, winner: -1 };
    const r = scopa.applyAction(s, move.action);
    if (r.error) errors++;
    s = r.state;
  }
  const best = Math.max(...s.matchScores);
  return { stuck: s.phase !== 'match-end', errors, winner: s.matchScores.filter((x) => x === best).length > 1 ? -1 : s.matchScores.indexOf(best) };
}

// --- UNO ---------------------------------------------------------------------------

function playUno(levels: BotLevel[], stacking: boolean) {
  const bots = seats(levels);
  let s = uno.createInitialState('SIM', bots[0].id, bots.length);
  s = uno.applyAction(s, { type: 'SET_OPTIONS', maxPlayers: bots.length, stackingEnabled: stacking }).state;
  for (const b of bots) s = uno.applyAction(s, { type: 'JOIN', playerId: b.id, name: b.name }).state;
  s = uno.applyAction(s, { type: 'START' }).state;
  let errors = 0;
  for (let step = 0; step < MAX_STEPS && s.phase === 'playing'; step++) {
    const move = unoDecide(s, bots);
    if (!move) return { stuck: true, errors, winner: -1 };
    const r = uno.applyAction(s, move.action);
    if (r.error) errors++;
    s = r.state;
  }
  return { stuck: s.phase !== 'won', errors, winner: s.winner ?? -1 };
}

// --- Puissance 4 -------------------------------------------------------------------

function playP4(levels: BotLevel[], mode: P4Mode, original: boolean) {
  const modes = original ? ORIGINAL_MODES : MODES;
  const bots = seats(levels);
  let s = p4.createInitialState('SIM', bots[0].id, mode, modes);
  for (const b of bots) s = p4.applyAction(s, { type: 'JOIN', playerId: b.id, name: b.name }, modes, !original).state;
  s = p4.applyAction(s, { type: 'START' }, modes, !original).state;
  let errors = 0;
  for (let step = 0; step < MAX_STEPS && s.phase === 'playing'; step++) {
    const move = p4Decide(s, bots);
    if (!move) return { stuck: true, errors, winner: -1 };
    const r = p4.applyAction(s, move.action, modes, !original);
    if (r.error) errors++;
    s = r.state;
  }
  return { stuck: s.phase === 'playing', errors, winner: s.winner?.team ?? -1 };
}

// --- Parties ------------------------------------------------------------------------

type Result = { stuck: boolean; errors: number; winner: number };
function series(label: string, n: number, play: (i: number) => Result, strongSeat?: (i: number) => number) {
  let stuck = 0;
  let errors = 0;
  let strongWins = 0;
  let strongLosses = 0;
  for (let i = 0; i < n; i++) {
    const r = play(i);
    if (r.stuck) stuck++;
    errors += r.errors;
    if (strongSeat && r.winner >= 0) {
      if (r.winner === strongSeat(i)) strongWins++;
      else strongLosses++;
    }
  }
  check(`${label} : ${n} parties terminées`, stuck === 0, { stuck });
  check(`${label} : aucun coup illégal`, errors === 0, { errors });
  if (strongSeat) {
    console.log(`       difficile contre facile : ${strongWins} victoires, ${strongLosses} défaites`);
    check(`${label} : le difficile bat le facile`, strongWins > strongLosses * 1.5, { strongWins, strongLosses });
  }
}

console.log('Scopa');
for (const n of [2, 3, 4]) series(`Scopa à ${n}`, 15, () => playScopa(Array<BotLevel>(n).fill('normal')));
series('Scopa, niveaux mêlés', 10, () => playScopa(['easy', 'normal', 'hard']));
// Le difficile change de siège une partie sur deux : le premier à jouer n'est pas avantagé.
series('Scopa duel', 60, (i) => playScopa(i % 2 ? ['easy', 'hard'] : ['hard', 'easy']), (i) => (i % 2 ? 1 : 0));

console.log('UNO');
for (const n of [2, 3, 4]) for (const stacking of [false, true]) series(`UNO à ${n}${stacking ? ', surenchère' : ''}`, 15, () => playUno(Array<BotLevel>(n).fill('normal'), stacking));
series('UNO duel', 80, (i) => playUno(i % 2 ? ['easy', 'hard'] : ['hard', 'easy'], false), (i) => (i % 2 ? 1 : 0));

console.log('Puissance 4');
for (const original of [false, true]) {
  const v = original ? 'Classic' : 'Forge';
  series(`${v} duel`, 10, () => playP4(['normal', 'normal'], 'duel', original));
  series(`${v} trio`, 6, () => playP4(['normal', 'hard', 'easy'], 'trio', original));
  series(`${v} quatuor`, 4, () => playP4(['normal', 'normal', 'hard', 'easy'], 'quatuor', original));
  series(`${v} équipes`, 4, () => playP4(['hard', 'easy', 'normal', 'normal'], 'teams', original));
  series(`${v} duel`, 30, (i) => playP4(i % 2 ? ['easy', 'hard'] : ['hard', 'easy'], 'duel', original), (i) => (i % 2 ? 1 : 0));
}

console.log(failures ? `\n${failures} ÉCHEC(S)` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
