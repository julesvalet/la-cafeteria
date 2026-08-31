import {
  UNO_PENALTY,
  applyAction,
  canPlay,
  createInitialState,
  topCard,
} from './rules.ts';
import { createDeck } from './deck.ts';
import type { UnoAction, UnoCard, UnoColor, UnoState } from './types.ts';

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    failures++;
    console.log('  FAIL ' + label, extra === undefined ? '' : JSON.stringify(extra));
  } else {
    console.log('  ok   ' + label);
  }
}

function run(state: UnoState, action: UnoAction): UnoState {
  const r = applyAction(state, action);
  if (r.error) console.log('    (error: ' + r.error + ')');
  return r.state;
}

function seat(state: UnoState, i: number) {
  return state.players[i].id;
}

function setup(players: number, stacking = false): UnoState {
  let s = createInitialState('TEST', 'host', players);
  s = run(s, { type: 'SET_OPTIONS', maxPlayers: players, stackingEnabled: stacking });
  for (let i = 0; i < players; i++) s = run(s, { type: 'JOIN', playerId: 'p' + i, name: 'J' + i });
  return run(s, { type: 'START' });
}

/** Forces a hand, so tests never depend on the shuffle. */
function setHand(state: UnoState, index: number, hand: UnoCard[]): UnoState {
  return {
    ...state,
    players: state.players.map((p, i) => (i === index ? { ...p, hand, handCount: hand.length } : p)),
  };
}

/** Forces the face-up card and the colour that must be matched. */
function setTop(state: UnoState, card: UnoCard, color?: UnoColor): UnoState {
  return { ...state, discard: [...state.discard, card], activeColor: color ?? card.color ?? 'red' };
}

const num = (id: string, color: UnoColor, n: number): UnoCard => ({ id, kind: 'number', color, number: n });

console.log('\n== deck composition ==');
{
  const deck = createDeck();
  check('108 cards', deck.length === 108, deck.length);
  const reds = deck.filter((c) => c.color === 'red');
  check('25 cards per colour', reds.length === 25, reds.length);
  check('one zero per colour', reds.filter((c) => c.kind === 'number' && c.number === 0).length === 1);
  check('two of each 1-9', reds.filter((c) => c.kind === 'number' && c.number === 5).length === 2);
  check('4 wilds', deck.filter((c) => c.kind === 'wild').length === 4);
  check('4 wild draw fours', deck.filter((c) => c.kind === 'wild4').length === 4);
}

console.log('\n== dealing ==');
{
  const s = setup(3);
  check('7 cards each', s.players.every((p) => p.hand.length === 7), s.players.map((p) => p.hand.length));
  check('a card is face up', s.discard.length === 1);
  check('opens on a number card', topCard(s)!.kind === 'number', topCard(s));
  check('mystery cards in a 3-player game', s.mysteryEnabled);
  const duel = setup(2);
  check('no mystery cards in a duel', !duel.mysteryEnabled);
}

console.log('\n== matching rules ==');
{
  let s = setup(2);
  s = setTop(s, num('top', 'red', 5));
  check('same colour plays', canPlay(s, num('a', 'red', 9)));
  check('same number plays', canPlay(s, num('b', 'blue', 5)));
  check('neither does not', !canPlay(s, num('c', 'blue', 9)));
  check('a wild always plays', canPlay(s, { id: 'w', kind: 'wild', color: null }));
  check('a +4 always plays', canPlay(s, { id: 'w4', kind: 'wild4', color: null }));
  check('action cards match by kind', canPlay(s, { id: 'sk', kind: 'skip', color: 'red' }));
  s = setTop(s, { id: 'top2', kind: 'skip', color: 'green' }, 'green');
  check('skip on skip across colours', canPlay(s, { id: 'sk2', kind: 'skip', color: 'blue' }));
  check('number on skip needs the colour', !canPlay(s, num('d', 'blue', 3)));
}

console.log('\n== playing a card passes the turn ==');
{
  let s = setup(2);
  s = setTop(s, num('top', 'red', 5));
  s = setHand(s, 0, [num('mine', 'red', 3), num('spare', 'blue', 8)]);
  s = run(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'mine' });
  check('card left the hand', s.players[0].hand.length === 1, s.players[0].hand);
  check('card is on the pile', topCard(s)!.id === 'mine');
  check('active colour follows the card', s.activeColor === 'red');
  check('turn passed', s.turn === 1, s.turn);
}

console.log('\n== an illegal card is refused ==');
{
  let s = setup(2);
  s = setTop(s, num('top', 'red', 5));
  s = setHand(s, 0, [num('bad', 'blue', 9)]);
  const r = applyAction(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'bad' });
  check('rejected', Boolean(r.error), r.error);
  check('hand untouched', r.state.players[0].hand.length === 1);
}

console.log('\n== skip and reverse ==');
{
  let s = setup(3);
  s = setTop(s, num('top', 'red', 5));
  s = setHand(s, 0, [{ id: 'sk', kind: 'skip', color: 'red' }, num('x', 'red', 1)]);
  s = run(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'sk' });
  check('skip jumps a seat', s.turn === 2, s.turn);

  let t = setup(3);
  t = setTop(t, num('top', 'red', 5));
  t = setHand(t, 0, [{ id: 'rv', kind: 'reverse', color: 'red' }, num('x', 'red', 1)]);
  t = run(t, { type: 'PLAY_CARD', playerId: seat(t, 0), cardId: 'rv' });
  check('reverse flips direction', t.direction === -1, t.direction);
  check('and hands play the other way', t.turn === 2, t.turn);
}

console.log('\n== +2 without stacking ==');
{
  let s = setup(2, false);
  s = setTop(s, num('top', 'red', 5));
  s = setHand(s, 0, [{ id: 'd2', kind: 'draw2', color: 'red' }, num('x', 'red', 1)]);
  const before = s.players[1].hand.length;
  s = run(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'd2' });
  check('victim drew 2', s.players[1].hand.length === before + 2, s.players[1].hand.length);
  check('nothing left pending', s.pendingDraw === 0);
  check('victim also lost the turn', s.turn === 0, s.turn);
}

console.log('\n== +2 with stacking ==');
{
  let s = setup(2, true);
  s = setTop(s, num('top', 'red', 5));
  s = setHand(s, 0, [{ id: 'd2a', kind: 'draw2', color: 'red' }, num('x', 'red', 1)]);
  s = setHand(s, 1, [{ id: 'd2b', kind: 'draw2', color: 'blue' }, num('y', 'blue', 2)]);
  s = run(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'd2a' });
  check('stack is 2', s.pendingDraw === 2, s.pendingDraw);
  check('turn passed without drawing', s.turn === 1 && s.players[1].hand.length === 2, s.players[1].hand.length);

  check('an ordinary card cannot answer a stack', !canPlay(s, num('y', 'blue', 2)));
  check('another +2 can', canPlay(s, { id: 'd2b', kind: 'draw2', color: 'blue' }));

  s = run(s, { type: 'PLAY_CARD', playerId: seat(s, 1), cardId: 'd2b' });
  check('stack grew to 4', s.pendingDraw === 4, s.pendingDraw);

  const before = s.players[0].hand.length;
  s = run(s, { type: 'DRAW_CARD', playerId: seat(s, 0) });
  check('payer took all 4', s.players[0].hand.length === before + 4, s.players[0].hand.length);
  check('stack cleared', s.pendingDraw === 0);
  check('turn moved on', s.turn === 1, s.turn);
}

console.log('\n== a wild needs a colour ==');
{
  let s = setup(2);
  s = setTop(s, num('top', 'red', 5));
  s = setHand(s, 0, [{ id: 'w', kind: 'wild', color: null }, num('x', 'red', 1)]);
  const noColor = applyAction(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'w' });
  check('refused without a colour', Boolean(noColor.error), noColor.error);
  s = run(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'w', chosenColor: 'green' });
  check('active colour is the chosen one', s.activeColor === 'green', s.activeColor);
}

console.log('\n== UNO declaration and its penalty ==');
{
  // Declaring, then going down to one card: no penalty.
  let s = setup(2);
  s = setTop(s, num('top', 'red', 5));
  s = setHand(s, 0, [num('a', 'red', 1), num('b', 'red', 2)]);
  const tooEarly = applyAction(s, { type: 'DECLARE_UNO', playerId: seat(s, 0) });
  check('cannot declare on two cards', Boolean(tooEarly.error), tooEarly.error);

  s = setHand(s, 0, [num('a', 'red', 1)]);
  s = run(s, { type: 'DECLARE_UNO', playerId: seat(s, 0) });
  check('declaration recorded', s.players[0].hasDeclaredUno);

  // Dropping to one card is not itself punished — that is the window in which
  // an opponent may call Contre UNO.
  let t = setup(2);
  t = setTop(t, num('top', 'red', 5));
  t = setHand(t, 0, [num('a', 'red', 1), num('b', 'red', 2)]);
  t = run(t, { type: 'PLAY_CARD', playerId: seat(t, 0), cardId: 'a' });
  check('reaching one card is not penalised on its own', t.players[0].hand.length === 1, t.players[0].hand.length);
  check('and leaves the player catchable', !t.players[0].hasDeclaredUno);

  // Going out without ever declaring is what costs two cards.
  let u = setup(2);
  u = setTop(u, num('top', 'red', 5));
  u = setHand(u, 0, [num('last', 'red', 7)]);
  u = run(u, { type: 'PLAY_CARD', playerId: seat(u, 0), cardId: 'last' });
  check(`going out silently costs +${UNO_PENALTY}`, u.players[0].hand.length === UNO_PENALTY, u.players[0].hand.length);
  check('and the game is not won', u.phase === 'playing', u.phase);
}

console.log('\n== Contre UNO cuts both ways ==');
{
  // Catching someone red-handed.
  let s = setup(3);
  s = setHand(s, 1, [num('lonely', 'red', 4)]);
  const before = s.players[1].hand.length;
  s = run(s, { type: 'CONTRE_UNO', playerId: seat(s, 0) });
  check('the caught player draws', s.players[1].hand.length === before + UNO_PENALTY, s.players[1].hand.length);
  check('the caller is untouched', s.players[0].hand.length === 7, s.players[0].hand.length);

  // Calling into thin air.
  let t = setup(3);
  const callerBefore = t.players[0].hand.length;
  t = run(t, { type: 'CONTRE_UNO', playerId: seat(t, 0) });
  check('a wrong call punishes the caller', t.players[0].hand.length === callerBefore + UNO_PENALTY);

  // Calling on someone who *did* declare.
  let u = setup(3);
  u = setHand(u, 1, [num('lonely', 'red', 4)]);
  u = run(u, { type: 'DECLARE_UNO', playerId: seat(u, 1) });
  const declared = u.players[1].hand.length;
  const caller = u.players[0].hand.length;
  u = run(u, { type: 'CONTRE_UNO', playerId: seat(u, 0) });
  check('a declared player is safe', u.players[1].hand.length === declared, u.players[1].hand.length);
  check('and the caller pays', u.players[0].hand.length === caller + UNO_PENALTY);
}

console.log('\n== winning ==');
{
  let s = setup(2);
  s = setTop(s, num('top', 'red', 5));
  s = setHand(s, 0, [num('last', 'red', 7)]);
  s = run(s, { type: 'DECLARE_UNO', playerId: seat(s, 0) });
  s = run(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'last' });
  check('game is won', s.phase === 'won', s.phase);
  check('winner is seat 0', s.winner === 0, s.winner);
}

console.log('\n== drawing ==');
{
  let s = setup(2);
  s = setTop(s, num('top', 'red', 5));
  // A hand with nothing playable, so the draw must pass the turn on.
  s = setHand(s, 0, [num('a', 'blue', 9)]);
  const deckBefore = s.deck.length;
  s = run(s, { type: 'DRAW_CARD', playerId: seat(s, 0) });
  check('a card left the deck', s.deck.length < deckBefore, { before: deckBefore, after: s.deck.length });
  const drewTwice = applyAction(s, { type: 'DRAW_CARD', playerId: seat(s, 0) });
  // Either the turn already passed (nothing playable) or a second draw is refused.
  check('cannot draw twice in a turn', s.turn === 1 || Boolean(drewTwice.error), drewTwice.error);
}

console.log('\n== turn order skips a player who left ==');
{
  let s = setup(3);
  s = setTop(s, num('top', 'red', 5));
  s = run(s, { type: 'LEAVE', playerId: seat(s, 1) });
  s = setHand(s, 0, [num('a', 'red', 1), num('b', 'red', 2)]);
  s = run(s, { type: 'PLAY_CARD', playerId: seat(s, 0), cardId: 'a' });
  check('skipped the disconnected seat', s.turn === 2, s.turn);
}

console.log('\n== the deck recycles the discard pile ==');
{
  let s = setup(2);
  s = setTop(s, num('top', 'red', 5));
  // Strip the deck to nothing and stuff the discard pile.
  s = {
    ...s,
    deck: [],
    discard: [...s.discard, ...Array.from({ length: 12 }, (_, i) => num('d' + i, 'blue', i % 10))],
  };
  s = setHand(s, 0, [num('a', 'green', 9)]);
  const handBefore = s.players[0].hand.length;
  s = run(s, { type: 'DRAW_CARD', playerId: seat(s, 0) });
  check('a card was still drawn', s.players[0].hand.length > handBefore, s.players[0].hand.length);
  check('the face-up card is still there', s.discard.length >= 1, s.discard.length);
}

if (failures > 0) throw new Error(`${failures} FAILURE(S)`);
console.log('\nALL PASS\n');
