import {
  applyAction,
  cellIndex,
  createInitialState,
  discAt,
  isBlocked,
  isInverted,
  landingRow,
} from './rules.ts';
import { MAX_PER_POWER, rollCharges } from './powers.ts';
import type { P4Action, P4Mode, P4State, PowerId } from './types.ts';

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    failures++;
    console.log('  FAIL ' + label, extra === undefined ? '' : JSON.stringify(extra));
  } else {
    console.log('  ok   ' + label);
  }
}

function run(state: P4State, action: P4Action): P4State {
  const r = applyAction(state, action);
  if (r.error) console.log('    (error: ' + r.error + ')');
  return r.state;
}

function seat(state: P4State, i: number) {
  return state.players[i].id;
}

function setup(mode: P4Mode, n: number): P4State {
  let s = createInitialState('TEST', 'host', mode);
  const r = applyAction(s, { type: 'SET_MODE', mode });
  s = r.state;
  for (let i = 0; i < n; i++) s = run(s, { type: 'JOIN', playerId: 'p' + i, name: 'J' + i });
  s = run(s, { type: 'START' });
  return s;
}

/** Forces a seat's very next disc, so tests never depend on the random roll. */
function charge(state: P4State, seatIndex: number, power: PowerId | null): P4State {
  return {
    ...state,
    players: state.players.map((p, i) =>
      i === seatIndex ? { ...p, charges: [power, ...p.charges.slice(1)] } : p,
    ),
  };
}

/**
 * Strips every power out of every run. Tests that are not about powers need
 * this: otherwise a randomly charged disc fires mid-scenario and quietly
 * changes whose turn it is.
 */
function plain(state: P4State): P4State {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, charges: p.charges.map(() => null) })),
  };
}

/** Column contents, bottom to top, as owner indices. */
function col(state: P4State, c: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let row = 0; row < state.rows; row++) out.push(discAt(state, row, c)?.owner ?? null);
  return out;
}

console.log('\n== basic drop + gravity ==');
{
  let s = plain(setup('duel', 2));
  check('board sized 7x6', s.cols === 7 && s.rows === 6 && s.cells.length === 42);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 3 });
  check('landed on the floor', discAt(s, 0, 3)?.owner === 0);
  check('turn passed', s.turn === 1);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 3 });
  check('stacked on top', discAt(s, 1, 3)?.owner === 1);
  check('landing row now 2', landingRow(s, 3) === 2);
}

console.log('\n== vertical win ==');
{
  let s = plain(setup('duel', 2));
  for (let i = 0; i < 3; i++) {
    s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 2 });
    s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 5 });
  }
  check('still playing', s.phase === 'playing', s.phase);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 2 });
  check('p0 wins vertically', s.phase === 'won' && s.winner?.team === 0, { phase: s.phase, w: s.winner });
  check('winning line has 4 cells', s.winner?.cells.length === 4);
}

console.log('\n== horizontal win ==');
{
  let s = plain(setup('duel', 2));
  for (let c = 0; c < 3; c++) {
    s = run(s, { type: 'DROP', playerId: seat(s, 0), col: c });
    s = run(s, { type: 'DROP', playerId: seat(s, 1), col: c + 4 });
  }
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 3 });
  check('p0 wins horizontally', s.phase === 'won' && s.winner?.team === 0, s.phase);
}

console.log('\n== 2v2 shares an alignment across teammates ==');
{
  let s = plain(setup('teams', 4));
  check('seats 0 and 2 share a team', s.players[0].team === s.players[2].team);
  check('seats 1 and 3 share a team', s.players[1].team === s.players[3].team);
  // Seats 0 and 2 alternate filling cols 0..3 on the floor; seats 1/3 park elsewhere.
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 7 });
  s = run(s, { type: 'DROP', playerId: seat(s, 2), col: 1 });
  s = run(s, { type: 'DROP', playerId: seat(s, 3), col: 7 });
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 2 });
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 6 });
  check('no win yet', s.phase === 'playing', s.phase);
  s = run(s, { type: 'DROP', playerId: seat(s, 2), col: 3 });
  check('team wins on a mixed line', s.phase === 'won', s.phase);
  const owners = s.winner!.cells.map((c) => s.cells[c]!.owner).sort();
  check('line really mixes both teammates', owners.includes(0) && owners.includes(2), owners);
}

console.log('\n== a run is mostly plain discs ==');
{
  // 200 rolls, so a bad distribution shows up rather than hiding behind luck.
  let charged = 0;
  let total = 0;
  let worstOfOne = 0;
  for (let i = 0; i < 200; i++) {
    const run = rollCharges(16);
    total += run.length;
    charged += run.filter(Boolean).length;
    const counts: Record<string, number> = {};
    for (const p of run) if (p) counts[p] = (counts[p] ?? 0) + 1;
    worstOfOne = Math.max(worstOfOne, ...Object.values(counts), 0);
  }
  const share = charged / total;
  check(`charged discs stay a minority (${(share * 100).toFixed(0)}%)`, share > 0.15 && share < 0.4, share);
  check('no run stacks more than 2 of one power', worstOfOne <= MAX_PER_POWER, worstOfOne);
  check('a fixed run length is dealt', rollCharges(12).length === 12);
}

console.log('\n== every player starts with the mode’s run ==');
{
  const s = setup('duel', 2);
  check('16 discs each in duel', s.players.every((p) => p.charges.length === 16), s.players.map((p) => p.charges.length));
  const q = setup('quatuor', 4);
  check('12 discs each in quatuor', q.players.every((p) => p.charges.length === 12));
  check('nobody has powers to pick from', !('powers' in (s.players[0] as object)));
}

console.log('\n== playing a disc consumes it from the run ==');
{
  let s = setup('duel', 2);
  s = charge(s, 0, null);
  const before = s.players[0].charges.length;
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  check('run is one shorter', s.players[0].charges.length === before - 1, s.players[0].charges.length);
  check('opponent untouched', s.players[1].charges.length === before);
}

console.log('\n== pierce fires on its own, from the drop ==');
{
  let s = setup('duel', 2);
  s = charge(s, 0, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  s = charge(s, 1, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 0 });
  check('before: [0,1]', JSON.stringify(col(s, 0).slice(0, 2)) === '[0,1]', col(s, 0));

  s = charge(s, 0, 'pierce');
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  check('slid under the stack: [0,0,1]', JSON.stringify(col(s, 0).slice(0, 3)) === '[0,0,1]', col(s, 0));
  check('no target was asked for', s.pendingPower === null, s.pendingPower);
  check('turn passed straight on', s.turn === 1, s.turn);
}

console.log('\n== destroy waits for a target, then collapses the column ==');
{
  let s = setup('duel', 2);
  s = charge(s, 0, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 4 }); // floor: p0
  s = charge(s, 1, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 4 }); // row1: p1
  s = charge(s, 0, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 4 }); // row2: p0

  s = charge(s, 1, 'destroy');
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 0 });
  check('power is pending, not yet applied', s.pendingPower?.power === 'destroy', s.pendingPower);
  check('turn has not passed', s.turn === 1, s.turn);

  const blocked = applyAction(s, { type: 'DROP', playerId: seat(s, 1), col: 2 });
  check('cannot drop again mid-power', Boolean(blocked.error), blocked.error);

  s = run(s, { type: 'RESOLVE_POWER', playerId: seat(s, 1), cell: cellIndex(s.cols, 0, 4) });
  check('column collapsed to [1,0]', JSON.stringify(col(s, 4).slice(0, 3)) === '[1,0,null]', col(s, 4));
  check('pending cleared', s.pendingPower === null);
  check('turn passed after resolving', s.turn === 0, s.turn);
}

console.log('\n== destroy cannot hit your own side ==');
{
  let s = setup('duel', 2);
  s = charge(s, 0, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 1 });
  s = charge(s, 1, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 2 });
  s = charge(s, 0, 'destroy');
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 5 });
  const own = applyAction(s, { type: 'RESOLVE_POWER', playerId: seat(s, 0), cell: cellIndex(s.cols, 0, 1) });
  check('own disc rejected', Boolean(own.error), own.error);
  const enemy = applyAction(s, { type: 'RESOLVE_POWER', playerId: seat(s, 0), cell: cellIndex(s.cols, 0, 2) });
  check('enemy disc accepted', !enemy.error, enemy.error);
}

console.log('\n== a power with no target simply fizzles ==');
{
  let s = setup('duel', 2);
  s = charge(s, 0, 'destroy'); // empty board: nothing to destroy
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 3 });
  check('nothing left pending', s.pendingPower === null, s.pendingPower);
  check('turn passed anyway', s.turn === 1, s.turn);
  check('the loss is logged', s.log.some((l) => l.includes('se perd')), s.log.slice(-2));
}

console.log('\n== gravity inversion ==');
{
  let s = setup('duel', 2);
  s = charge(s, 0, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 6 });
  s = charge(s, 1, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 6 });
  check('stack on the floor', JSON.stringify(col(s, 6).slice(0, 2)) === '[0,1]', col(s, 6));

  s = charge(s, 0, 'invert');
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  s = run(s, { type: 'RESOLVE_POWER', playerId: seat(s, 0), col: 6 });
  check('column marked inverted', isInverted(s, 6));
  check('stack hangs from the ceiling, order kept', col(s, 6)[4] === 0 && col(s, 6)[5] === 1, col(s, 6));
  check('new disc lands under the stack', landingRow(s, 6) === 3, landingRow(s, 6));

  s = charge(s, 1, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 6 });
  check('landed under the stack at row 3', discAt(s, 3, 6)?.owner === 1, col(s, 6));
  check('still inverted when play returns to the caster', isInverted(s, 6), s.effects);

  s = charge(s, 0, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 1 });
  check('inversion expired', !isInverted(s, 6), s.effects);
  check('column back on the floor, order kept', JSON.stringify(col(s, 6).slice(0, 3)) === '[1,0,1]', col(s, 6));
}

console.log('\n== column block ==');
{
  let s = setup('duel', 2);
  s = charge(s, 0, 'block');
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 5 });
  check('waiting for a column', s.pendingPower?.power === 'block', s.pendingPower);
  s = run(s, { type: 'RESOLVE_POWER', playerId: seat(s, 0), col: 2 });
  check('column blocked', isBlocked(s, 2));
  check('turn passed to p1', s.turn === 1);

  const locked = applyAction(s, { type: 'DROP', playerId: seat(s, 1), col: 2 });
  check('opponent locked out', Boolean(locked.error), locked.error);

  s = charge(s, 1, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 3 });
  check('block cleared when it comes back around', !isBlocked(s, 2), s.effects);
}

console.log('\n== double turn rides its disc ==');
{
  let s = setup('trio', 3);
  s = charge(s, 0, 'double');
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  check('the disc was played', col(s, 0)[0] === 0, col(s, 0));
  check('turn stays with the caster', s.turn === 0, s.turn);
  check('a second drop is owed', s.pendingDouble);

  s = charge(s, 0, null);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 1 });
  check('second drop passes the turn', s.turn === 1, s.turn);
  check('nothing left owed', !s.pendingDouble);
}

console.log('\n== a run that empties ends the game ==');
{
  let s = setup('duel', 2);
  // Hand both players a single plain disc each and let them spend it.
  s = {
    ...s,
    players: s.players.map((p) => ({ ...p, charges: [null] })),
  };
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  check('still playing with one disc left on the table', s.phase === 'playing', s.phase);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 1 });
  check('out of discs is a draw', s.phase === 'draw', s.phase);
}

console.log('\n== turn order skips a player who left ==');
{
  let s = plain(setup('quatuor', 4));
  check('4 seats on a 10x8 board', s.players.length === 4 && s.cols === 10 && s.rows === 8);
  s = run(s, { type: 'LEAVE', playerId: seat(s, 1) });
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  check('skipped the disconnected seat', s.turn === 2, s.turn);
}

console.log('\n== a game always terminates ==');
{
  // Runs are finite and shorter than the grid, so a duel can no longer fill the
  // board — it ends on an alignment or on the last disc, never by grinding on.
  let s = plain(setup('duel', 2));
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 400) {
    let moved = false;
    for (let c = 0; c < s.cols && !moved; c++) {
      const r = applyAction(s, { type: 'DROP', playerId: seat(s, s.turn), col: c });
      if (!r.error) {
        s = r.state;
        moved = true;
      }
    }
    if (!moved) break;
  }
  check('game terminated', s.phase !== 'playing', { phase: s.phase, guard });
  check('and did so without spinning', guard < 400, guard);
}

console.log('\n== mode guards ==');
{
  let s = createInitialState('T', 'host', 'duel');
  s = run(s, { type: 'JOIN', playerId: 'a', name: 'A' });
  s = run(s, { type: 'JOIN', playerId: 'b', name: 'B' });
  const third = applyAction(s, { type: 'JOIN', playerId: 'c', name: 'C' });
  check('duel caps at 2 players', third.state.players.length === 2);
  const shrink = applyAction({ ...s, mode: 'quatuor' }, { type: 'SET_MODE', mode: 'duel' });
  check('mode switch allowed when it fits', !shrink.error, shrink.error);
  const early = applyAction(createInitialState('T', 'h', 'duel'), { type: 'START' });
  check('cannot start short-handed', Boolean(early.error), early.error);
}

// Throwing rather than `process.exit` keeps this file free of Node globals, so
// it typechecks under the same browser-flavoured config as the engine it tests.
if (failures > 0) throw new Error(`${failures} FAILURE(S)`);
console.log('\nALL PASS\n');
