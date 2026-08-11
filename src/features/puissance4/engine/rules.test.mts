import {
  applyAction,
  cellIndex,
  createInitialState,
  discAt,
  isBlocked,
  isInverted,
  landingRow,
} from './rules.ts';
import type { P4Action, P4Mode, P4State } from './types.ts';

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

/** Column contents, bottom to top, as owner indices. */
function col(state: P4State, c: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let row = 0; row < state.rows; row++) out.push(discAt(state, row, c)?.owner ?? null);
  return out;
}

console.log('\n== basic drop + gravity ==');
{
  let s = setup('duel', 2);
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
  let s = setup('duel', 2);
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
  let s = setup('duel', 2);
  for (let c = 0; c < 3; c++) {
    s = run(s, { type: 'DROP', playerId: seat(s, 0), col: c });
    s = run(s, { type: 'DROP', playerId: seat(s, 1), col: c + 4 });
  }
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 3 });
  check('p0 wins horizontally', s.phase === 'won' && s.winner?.team === 0, s.phase);
}

console.log('\n== 2v2 shares an alignment across teammates ==');
{
  let s = setup('teams', 4);
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

console.log('\n== pierce inserts underneath and shifts up ==');
{
  let s = setup('duel', 2);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 0 });
  check('before: [0,1]', JSON.stringify(col(s, 0).slice(0, 2)) === '[0,1]', col(s, 0));
  const uses = s.players[0].powers.pierce;
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0, pierce: true });
  check('after: [0,0,1]', JSON.stringify(col(s, 0).slice(0, 3)) === '[0,0,1]', col(s, 0));
  check('pierce use consumed', s.players[0].powers.pierce === uses - 1);
}

console.log('\n== destroy removes an enemy disc and collapses the column ==');
{
  let s = setup('duel', 2);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 4 }); // floor: p0
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 4 }); // row1: p1
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 4 }); // row2: p0
  // p1 destroys p0's floor disc; the column should collapse to [1,0]
  const targetCell = cellIndex(s.cols, 0, 4);
  s = run(s, { type: 'USE_POWER', playerId: seat(s, 1), power: 'destroy', cell: targetCell });
  check('column collapsed to [1,0]', JSON.stringify(col(s, 4).slice(0, 3)) === '[1,0,null]', col(s, 4));

  // Cannot destroy your own disc.
  let s2 = setup('duel', 2);
  s2 = run(s2, { type: 'DROP', playerId: seat(s2, 0), col: 1 });
  s2 = run(s2, { type: 'DROP', playerId: seat(s2, 1), col: 2 });
  const r = applyAction(s2, {
    type: 'USE_POWER',
    playerId: seat(s2, 0),
    power: 'destroy',
    cell: cellIndex(s2.cols, 0, 1),
  });
  check('own disc rejected', Boolean(r.error), r.error);
}

console.log('\n== gravity inversion ==');
{
  let s = setup('duel', 2);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 6 });
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 6 });
  check('stack on the floor', JSON.stringify(col(s, 6).slice(0, 2)) === '[0,1]', col(s, 6));
  s = run(s, { type: 'USE_POWER', playerId: seat(s, 0), power: 'invert', col: 6 });
  check('column marked inverted', isInverted(s, 6));
  check('stack hangs from the ceiling, order kept', col(s, 6)[4] === 0 && col(s, 6)[5] === 1, col(s, 6));
  check('new disc lands under the stack', landingRow(s, 6) === 3, landingRow(s, 6));
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 6 });
  check('landed under the stack at row 3', discAt(s, 3, 6)?.owner === 1, col(s, 6));
  check('still inverted when play returns to the caster', isInverted(s, 6), s.effects);
  // The caster gets one turn to exploit it, then gravity snaps back.
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  check('inversion expired', !isInverted(s, 6), s.effects);
  check('column back on the floor, order kept', JSON.stringify(col(s, 6).slice(0, 3)) === '[1,0,1]', col(s, 6));
}

console.log('\n== column block ==');
{
  let s = setup('duel', 2);
  s = run(s, { type: 'USE_POWER', playerId: seat(s, 0), power: 'block', col: 2 });
  check('column blocked', isBlocked(s, 2));
  check('turn passed to p1', s.turn === 1);
  const r = applyAction(s, { type: 'DROP', playerId: seat(s, 1), col: 2 });
  check('opponent locked out', Boolean(r.error), r.error);
  s = run(s, { type: 'DROP', playerId: seat(s, 1), col: 3 });
  check('block cleared when it comes back around', !isBlocked(s, 2), s.effects);
}

console.log('\n== double turn ==');
{
  let s = setup('trio', 3);
  s = run(s, { type: 'USE_POWER', playerId: seat(s, 0), power: 'double' });
  check('activation is free, still p0 to move', s.turn === 0, s.turn);
  check('double is banked', s.pendingDouble);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  check('first drop does not pass the turn', s.turn === 0, s.turn);
  check('double consumed', !s.pendingDouble);
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 1 });
  check('second drop passes the turn', s.turn === 1, s.turn);
}

console.log('\n== turn order skips a player who left ==');
{
  let s = setup('quatuor', 4);
  check('4 seats on a 10x8 board', s.players.length === 4 && s.cols === 10 && s.rows === 8);
  s = run(s, { type: 'LEAVE', playerId: seat(s, 1) });
  s = run(s, { type: 'DROP', playerId: seat(s, 0), col: 0 });
  check('skipped the disconnected seat', s.turn === 2, s.turn);
}

console.log('\n== a full board is a draw ==');
{
  let s = setup('duel', 2);
  // Fill without ever letting anyone align 4, using a known-safe column pattern.
  const order = [0, 1, 0, 1, 1, 0, 1, 0];
  let guard = 0;
  outer: while (s.phase === 'playing' && guard++ < 200) {
    for (let c = 0; c < s.cols; c++) {
      const pattern = order[(c * 2) % order.length];
      for (let k = 0; k < 2 && s.phase === 'playing'; k++) {
        const who = (s.turn + (pattern === 0 ? 0 : 0)) % 2;
        const r = applyAction(s, { type: 'DROP', playerId: seat(s, who), col: c });
        if (r.error) continue outer;
        s = r.state;
      }
    }
  }
  check('game terminated', s.phase !== 'playing', s.phase);
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
