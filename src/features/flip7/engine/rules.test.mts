/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDeck } from './deck.ts';
import { applyAction, botAction, createGame, duplicateRisk, hasChance, leave, numbers, points, publicState, targetSeats, tick } from './rules.ts';
import { parseEnvelope } from '../net/protocol.ts';
import type { Card, GameState, PlayerAction, Ruleset } from './types.ts';

let serial = 0;
const card = (kind: Card['kind'], value = 0): Card => ({ id: `fixture-${++serial}`, kind, value });
const num = (n: number) => card('number', n);
function randomSeed(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function setup(ruleset: Ruleset = 'official', count = 2): GameState {
  let s = createGame('TEST77', 'host', 'Jules', { mode: count === 1 ? 'solo' : 'online', maxPlayers: count, ruleset, difficulty: 'hard' }, randomSeed(42));
  for (let i = 1; i < count; i++) s = act(s, { type: 'JOIN', name: `J${i}` }, `p${i}`);
  s = act(s, { type: 'START' });
  s.queue = []; s.deck = []; s.discard = [];
  return s;
}
function act(s: GameState, a: PlayerAction, actor = s.players[s.pending?.by ?? s.turn]?.id ?? 'host') {
  const r = applyAction(s, actor, a, randomSeed(17)); assert.equal(r.error, undefined, r.error); return r.state;
}
function rig(s: GameState, cards: Card[]) { s.deck = [...cards].reverse(); return s; }

test('94 official cards, correct multiplicities and 62 custom cards', () => {
  const d = createDeck(); assert.equal(d.length, 94); assert.equal(new Set(d.map(c => c.id)).size, 94);
  for (let i = 0; i <= 12; i++) assert.equal(d.filter(c => c.kind === 'number' && c.value === i).length, Math.max(1, i));
  for (const kind of ['freeze', 'flip3', 'chance']) assert.equal(d.filter(c => c.kind === kind).length, 3);
  assert.equal(d.filter(c => c.kind === 'bonus').length, 5); assert.equal(d.filter(c => c.kind === 'double').length, 1);
  assert.equal(createDeck('cafeteria').length, 62);
});
test('duplicate checked against the existing line, with immutable input', () => {
  let s = rig(setup(), [num(8), num(4), num(8)]); const before = structuredClone(s);
  s = act(s, { type: 'HIT' }); assert.equal(points(s.players[0], 'official'), 8); assert.equal(s.turn, 1);
  assert.deepEqual(before.players[0].cards, []);
  s = act(s, { type: 'HIT' }); s = act(s, { type: 'HIT' });
  assert.equal(s.players[0].status, 'busted'); assert.equal(points(s.players[0], 'official'), 0); assert.equal(s.turn, 1);
});
test('multiplication applies only to number cards, then bonus and Flip 7', () => {
  const s = setup(); const p = s.players[0]; p.cards = [num(10), num(3), card('bonus', 8), card('double', 2)];
  assert.equal(points(p, 'official'), 34);
  p.cards.push(num(0), num(1), num(2), num(4), num(5)); assert.equal(points(p, 'official'), 73);
});
test('seven unique numbers end the round and bank all active players exactly once', () => {
  let s = setup(); s.players[0].cards = [0, 1, 2, 3, 4, 5].map(num); s.players[1].cards = [num(12)]; rig(s, [num(6)]);
  s = act(s, { type: 'HIT' }); assert.equal(s.phase, 'roundOver'); assert.equal(s.players[0].total, 36); assert.equal(s.players[1].total, 12);
  assert.equal(s.lastEvent.kind, 'flip7'); assert.equal(applyAction(s, 'host', { type: 'STAY' }).state.players[0].total, 36);
});
test('Second Chance discards only itself and the duplicate; next draw is next turn', () => {
  let s = setup(); s.players[0].cards = [num(9), card('chance')]; rig(s, [num(9)]);
  s = act(s, { type: 'HIT' }); assert.equal(s.lastEvent.kind, 'saved'); assert.equal(s.players[0].status, 'active');
  assert.equal(points(s.players[0], 'official'), 9); assert.equal(hasChance(s.players[0]), false); assert.equal(s.turn, 1);
});
test('an extra Second Chance transfers, or is discarded if everybody is protected', () => {
  let s = setup(); s.players[0].cards = [card('chance')]; rig(s, [card('chance')]);
  s = act(s, { type: 'HIT' }); assert.equal(hasChance(s.players[1]), true); assert.equal(s.pending, null);
  s.turn = 0; rig(s, [card('chance')]); s = act(s, { type: 'HIT' }); assert.equal(s.discard.filter(c => c.kind === 'chance').length, 1);
});
test('Freeze target validation, banking, and round completion', () => {
  let s = setup(); s.players[0].cards = [num(10)]; s.players[1].cards = [num(4)]; rig(s, [card('freeze')]);
  s = act(s, { type: 'HIT' }); assert.equal(s.pending?.by, 0);
  assert.ok(applyAction(s, 'p1', { type: 'TARGET', targetId: 'host' }).error);
  s = act(s, { type: 'TARGET', targetId: 'p1' }, 'host'); assert.equal(s.players[1].status, 'frozen'); assert.equal(s.turn, 0);
  s = act(s, { type: 'STAY' }); assert.equal(s.phase, 'roundOver'); assert.deepEqual(s.players.map(p => p.total), [10, 4]);
});
test('Flip Three pauses decisions, counts modifiers, defers action cards until all three', () => {
  let s = setup(); rig(s, [card('flip3'), card('freeze'), num(7), card('bonus', 4)]);
  s = act(s, { type: 'HIT' }); s = act(s, { type: 'TARGET', targetId: 'p1' }, 'host');
  assert.ok(applyAction(s, 'p1', { type: 'STAY' }).error);
  s = tick(s); assert.equal(s.pending, null); assert.equal(s.queue[0].kind, 'draw');
  s = tick(s); s = tick(s); assert.equal(points(s.players[1], 'official'), 11);
  s = tick(s); assert.equal(s.pending?.card.kind, 'freeze'); assert.equal(s.pending?.by, 1);
});
test('bust cancels the rest of Flip Three and deferred effects', () => {
  let s = setup(); s.players[1].cards = [num(7)]; rig(s, [card('flip3'), card('freeze'), num(7), num(12)]);
  s = act(s, { type: 'HIT' }); s = act(s, { type: 'TARGET', targetId: 'p1' }, 'host');
  s = tick(s); s = tick(s);
  assert.equal(s.players[1].status, 'busted'); assert.equal(s.queue.length, 0); assert.equal(s.pending, null); assert.equal(s.deck.length, 1);
});
test('Second Chance protects immediately within a forced three-card draw', () => {
  let s = setup(); s.players[1].cards = [num(7)]; rig(s, [card('flip3'), card('chance'), num(7), num(12)]);
  s = act(s, { type: 'HIT' }); s = act(s, { type: 'TARGET', targetId: 'p1' }, 'host');
  s = tick(s); s = tick(s); s = tick(s);
  assert.equal(s.players[1].status, 'active'); assert.equal(points(s.players[1], 'official'), 19); assert.equal(s.queue.length, 0);
});
test('initial dealing is sequential and resolves special cards before continuing', () => {
  let s = createGame('TEST77', 'host', 'Jules', { mode: 'online', ruleset: 'official', maxPlayers: 2, difficulty: 'easy' });
  s = act(s, { type: 'JOIN', name: 'Ami' }, 'p1'); rig(s, [card('freeze'), num(12)]);
  s = act(s, { type: 'START' }); s = tick(s); assert.equal(s.pending?.by, 0);
  assert.equal(tick(s), s); s = act(s, { type: 'TARGET', targetId: 'host' }, 'host'); s = tick(s);
  assert.equal(s.players[0].status, 'frozen'); assert.equal(points(s.players[1], 'official'), 12); assert.equal(s.turn, 1);
});
test('deck exhaustion reshuffles discards without disturbing hands', () => {
  let s = setup(); s.players[0].cards = [num(2)]; s.discard = [num(12)];
  s = act(s, { type: 'HIT' }); assert.deepEqual(numbers(s.players[0]), [2, 12]); assert.equal(s.discard.length, 0);
});
test('ties above 200 continue; a unique leader wins after scoring the whole round', () => {
  let s = setup(); s.players.forEach(p => { p.total = 198; p.cards = [num(4)]; });
  s = act(s, { type: 'STAY' }); s = act(s, { type: 'STAY' }); assert.equal(s.phase, 'roundOver');
  s = act(s, { type: 'NEXT_ROUND' }, 'host'); s.queue = []; s.players[0].cards = [num(5)]; s.players[1].cards = [num(2)];
  s = act(s, { type: 'STAY' }); s = act(s, { type: 'STAY' }); assert.equal(s.phase, 'finished'); assert.equal(s.winnerId, 'host');
  s = act(s, { type: 'REMATCH' }, 'host'); assert.equal(s.round, 1); assert.equal(s.players[0].total, 0); assert.equal(s.deck.length, 94);
});
test('round transition preserves the deck and discards the previous hands', () => {
  let s = setup(); s.players[0].cards = [num(1)]; s.players[1].cards = [num(3)]; rig(s, [num(9), num(12)]);
  s = act(s, { type: 'STAY' }); s = act(s, { type: 'STAY' }); const oldDeck = [...s.deck];
  s = act(s, { type: 'NEXT_ROUND' }, 'host'); assert.deepEqual(s.deck, oldDeck); assert.equal(s.discard.length, 2); assert.equal(s.dealer, 1);
});
test('solo continues beyond 200 and never awards a game winner', () => {
  let s = setup('official', 1); s.players[0].total = 199; s.players[0].cards = [num(12)];
  s = act(s, { type: 'STAY' }); assert.equal(s.phase, 'roundOver'); assert.equal(s.winnerId, null);
});
test('custom rules: continuous turns, immediate multipliers, minus three, one restart', () => {
  let s = setup('cafeteria'); rig(s, [num(5), card('bonus', 2), card('double', 2), card('flip3'), card('chance'), num(5), num(4), num(4)]);
  for (let i = 0; i < 4; i++) s = act(s, { type: 'HIT' }); assert.equal(s.turn, 0); assert.equal(points(s.players[0], 'cafeteria'), 11);
  s = act(s, { type: 'HIT' }); s = act(s, { type: 'HIT' }); assert.equal(s.players[0].status, 'active'); assert.equal(s.players[0].cards.length, 0); assert.equal(s.players[0].chanceUsed, true);
  s = act(s, { type: 'HIT' }); s = act(s, { type: 'HIT' }); assert.equal(s.players[0].status, 'busted'); assert.equal(s.turn, 1);
});
test('custom Freeze preserves points and skips the next opportunity without deadlocking', () => {
  let s = setup('cafeteria'); rig(s, [num(5), card('freeze'), num(3)]);
  s = act(s, { type: 'HIT' }); s = act(s, { type: 'HIT' }); assert.equal(s.turn, 1); assert.equal(s.players[0].skip, true);
  s = act(s, { type: 'HIT' }); s = act(s, { type: 'STAY' }); assert.equal(s.turn, 0); assert.equal(s.players[0].skip, false); assert.equal(points(s.players[0], 'cafeteria'), 5);
});
test('host permissions, capacity, leave during targeting, and identity validation', () => {
  let s = setup('official', 3); assert.ok(applyAction(s, 'p1', { type: 'START' }).error);
  assert.ok(applyAction(s, 'stranger', { type: 'HIT' }).error);
  assert.ok(applyAction(s, 'p1', { type: 'HIT' }).error);
  rig(s, [card('freeze')]); s = act(s, { type: 'HIT' }); s = leave(s, 'host'); assert.equal(s.pending, null);
  assert.equal(s.players[s.turn].connected, true);
  s = leave(s, 'p1'); s = leave(s, 'p2'); assert.equal(s.phase, 'roundOver');
  const lobby = createGame('TEST77', 'host', 'Jules', { mode: 'online', ruleset: 'official', maxPlayers: 2, difficulty: 'easy' });
  const full = act(lobby, { type: 'JOIN', name: 'Ami' }, 'p1'); assert.ok(applyAction(full, 'p2', { type: 'JOIN', name: 'Extra' }).error);
});
test('wire parser ignores forged actor data and refuses malformed commands', () => {
  for (const bad of [null, 'HIT', {}, { type: 'ACTION', action: null }, { type: 'ACTION', requestId: 'x', revision: 1, action: { type: 'TICK' } }]) assert.equal(parseEnvelope(bad), null);
  const parsed = parseEnvelope({ type: 'ACTION', requestId: 'x', revision: 1, action: { type: 'HIT', playerId: 'host' } });
  assert.deepEqual(parsed?.action, { type: 'HIT' });
});
test('public state exposes no deck order or automatic draw instructions; chat is bounded', () => {
  let s = setup(); rig(s, [num(3), num(12)]); s.players[0].cards = [num(12)];
  assert.equal(duplicateRisk(s, 0), .5); const view = publicState(s);
  assert.equal('deck' in view, false); assert.equal('queue' in view, false); assert.equal(view.deckCount, 2);
  for (let i = 0; i < 110; i++) s = act(s, { type: 'CHAT', text: `<script>Message ${i}</script>` }, 'host');
  assert.equal(s.chat.length, 100); assert.equal(s.revision, view.revision);
  assert.ok(applyAction(s, 'host', { type: 'CHAT', text: 'x'.repeat(301) }).error);
});
test('seeded full games: card conservation, safe scores, legal turns and termination', () => {
  for (const ruleset of ['official', 'cafeteria'] as const) for (let seed = 1; seed <= 30; seed++) {
    const random = randomSeed(seed); const count = 2 + seed % 4;
    let s = createGame('TEST77', 'host', 'Jules', { mode: 'online', maxPlayers: count, ruleset, difficulty: 'hard' }, random);
    for (let i = 1; i < count; i++) s = applyAction(s, `p${i}`, { type: 'JOIN', name: `J${i}` }, random).state;
    s = applyAction(s, 'host', { type: 'START' }, random).state;
    let steps = 0;
    while (s.phase !== 'finished' && s.round <= 12 && steps++ < 3000) {
      const all = [...s.deck, ...s.discard, ...s.spent, ...s.players.flatMap(p => p.cards)];
      assert.equal(all.length, ruleset === 'official' ? 94 : 62, `card count seed ${seed} step ${steps}`);
      assert.equal(new Set(all.map(c => c.id)).size, all.length, `duplicate card id seed ${seed} step ${steps}`);
      assert.ok(s.players.every(p => Number.isFinite(p.total) && p.total >= 0));
      if (s.phase === 'roundOver') s = applyAction(s, 'host', { type: 'NEXT_ROUND' }, random).state;
      else if (s.pending) { assert.ok(targetSeats(s).length); s = applyAction(s, s.players[s.pending.by].id, botAction(s, s.pending.by, random), random).state; }
      else if (s.queue.length) s = tick(s, random);
      else { assert.equal(s.players[s.turn].status, 'active'); const r = applyAction(s, s.players[s.turn].id, botAction(s, s.turn, random), random); assert.equal(r.error, undefined); s = r.state; }
    }
    assert.ok(steps < 3000, `game stalled: ${ruleset} seed ${seed}`);
  }
});
