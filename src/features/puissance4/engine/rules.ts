import { MODES } from './modes';
import { POWERS, initialPowers } from './powers';
import type {
  ColumnEffect,
  Disc,
  P4Action,
  P4Mode,
  P4Player,
  P4State,
  P4Winner,
  PowerId,
} from './types';

const WIN_LENGTH = 4;

export function createInitialState(roomCode: string, hostId: string, mode: P4Mode = 'duel'): P4State {
  const config = MODES[mode];
  return {
    roomCode,
    hostId,
    mode,
    cols: config.cols,
    rows: config.rows,
    players: [],
    cells: [],
    turn: 0,
    phase: 'lobby',
    effects: [],
    pendingDouble: false,
    discSeq: 0,
    winner: null,
    lastEvent: { seq: 0, kind: 'none' },
    log: ['Room créée. En attente de joueurs...'],
  };
}

export const cellIndex = (cols: number, row: number, col: number) => row * cols + col;

export function discAt(state: P4State, row: number, col: number): Disc | null {
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return null;
  return state.cells[cellIndex(state.cols, row, col)] ?? null;
}

export function isBlocked(state: P4State, col: number): boolean {
  return state.effects.some((e) => e.col === col && e.kind === 'blocked');
}

export function isInverted(state: P4State, col: number): boolean {
  return state.effects.some((e) => e.col === col && e.kind === 'inverted');
}

/**
 * Where a disc dropped into this column comes to rest. Under inverted gravity
 * the stack hangs from the ceiling, so the first free cell scanning *down* from
 * the top is the landing spot.
 */
export function landingRow(state: P4State, col: number): number | null {
  if (isInverted(state, col)) {
    for (let row = state.rows - 1; row >= 0; row--) {
      if (!discAt(state, row, col)) return row;
    }
    return null;
  }
  for (let row = 0; row < state.rows; row++) {
    if (!discAt(state, row, col)) return row;
  }
  return null;
}

export function columnIsFull(state: P4State, col: number): boolean {
  return landingRow(state, col) === null;
}

export function canDrop(state: P4State, col: number): boolean {
  return !isBlocked(state, col) && !columnIsFull(state, col);
}

/**
 * Repacks a column against its gravity, preserving the discs' relative order.
 * When gravity flips, the whole stack slides to the other end without ever
 * reordering: the disc that was on top stays on top.
 */
function settleColumn(cells: (Disc | null)[], cols: number, rows: number, col: number, inverted: boolean) {
  const stack: Disc[] = [];
  for (let row = 0; row < rows; row++) {
    const disc = cells[cellIndex(cols, row, col)];
    if (disc) stack.push(disc);
  }
  for (let row = 0; row < rows; row++) cells[cellIndex(cols, row, col)] = null;

  const offset = inverted ? rows - stack.length : 0;
  stack.forEach((disc, i) => {
    cells[cellIndex(cols, offset + i, col)] = disc;
  });
}

function teamOf(state: P4State, playerIndex: number): number {
  return state.players[playerIndex]?.team ?? playerIndex;
}

const DIRECTIONS: [number, number][] = [
  [0, 1], // →
  [1, 0], // ↑
  [1, 1], // ↗
  [1, -1], // ↖
];

function findWinningLines(state: P4State): P4Winner[] {
  const lines: P4Winner[] = [];
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const start = discAt(state, row, col);
      if (!start) continue;
      const team = teamOf(state, start.owner);

      for (const [dr, dc] of DIRECTIONS) {
        const cells: number[] = [cellIndex(state.cols, row, col)];
        for (let step = 1; step < WIN_LENGTH; step++) {
          const next = discAt(state, row + dr * step, col + dc * step);
          if (!next || teamOf(state, next.owner) !== team) break;
          cells.push(cellIndex(state.cols, row + dr * step, col + dc * step));
        }
        if (cells.length === WIN_LENGTH) lines.push({ team, cells });
      }
    }
  }
  return lines;
}

/**
 * Gravity can complete two alignments at once (a destroy that drops a column
 * into place, for instance). The player who caused it takes precedence —
 * anything else would hand someone a win they did not earn.
 */
function resolveBoard(state: P4State, actingTeam: number | null): P4State {
  const lines = findWinningLines(state);
  if (lines.length > 0) {
    const mine = actingTeam === null ? undefined : lines.find((l) => l.team === actingTeam);
    const winner = mine ?? lines[0];
    const name = teamLabel(state, winner.team);
    return {
      ...state,
      phase: 'won',
      winner,
      log: [...state.log, `${name} aligne 4 jetons et remporte la partie !`],
    };
  }
  if (state.cells.every((c) => c !== null)) {
    return { ...state, phase: 'draw', log: [...state.log, 'Plateau plein : match nul.'] };
  }
  return state;
}

export function teamLabel(state: P4State, team: number): string {
  const config = MODES[state.mode];
  if (config.teamNames) return config.teamNames[team] ?? `Équipe ${team + 1}`;
  const player = state.players.find((p) => p.team === team);
  return player?.name ?? `Joueur ${team + 1}`;
}

export function teamMembers(state: P4State, team: number): P4Player[] {
  return state.players.filter((p) => p.team === team);
}

function nextTurn(state: P4State): number {
  const n = state.players.length;
  if (n === 0) return 0;
  for (let step = 1; step <= n; step++) {
    const candidate = (state.turn + step) % n;
    if (state.players[candidate].connected) return candidate;
  }
  return (state.turn + 1) % n;
}

/**
 * Ticks column effects down by one and lets expired inversions drop their
 * column back onto the floor — which can itself complete an alignment.
 */
function advanceTurn(state: P4State): P4State {
  const cells = [...state.cells];
  const kept: ColumnEffect[] = [];
  const restored: number[] = [];

  for (const effect of state.effects) {
    const turnsLeft = effect.turnsLeft - 1;
    if (turnsLeft > 0) {
      kept.push({ ...effect, turnsLeft });
    } else if (effect.kind === 'inverted') {
      restored.push(effect.col);
    }
  }

  for (const col of restored) settleColumn(cells, state.cols, state.rows, col, false);

  const next: P4State = {
    ...state,
    cells,
    effects: kept,
    turn: nextTurn(state),
    log:
      restored.length > 0
        ? [...state.log, `La gravité revient à la normale (colonne ${restored.map((c) => c + 1).join(', ')}).`]
        : state.log,
  };

  return restored.length > 0 ? resolveBoard(next, null) : next;
}

/** Ends the acting player's turn, unless a double turn is banked. */
function endTurn(state: P4State): P4State {
  if (state.pendingDouble) return { ...state, pendingDouble: false };
  return advanceTurn(state);
}

function bumpEvent(state: P4State, event: Omit<P4State['lastEvent'], 'seq'>): P4State {
  return { ...state, lastEvent: { ...event, seq: state.lastEvent.seq + 1 } };
}

export function withTeams(state: P4State): P4State {
  const config = MODES[state.mode];
  return {
    ...state,
    players: state.players.map((p, i) => ({ ...p, team: config.teams[i] ?? i })),
  };
}

export function addPlayer(state: P4State, id: string, name: string): P4State {
  if (state.players.some((p) => p.id === id)) return state;
  if (state.phase !== 'lobby') return state;
  if (state.players.length >= MODES[state.mode].players) return state;

  const player: P4Player = {
    id,
    name: name.trim() || 'Joueur',
    team: state.players.length,
    connected: true,
    powers: initialPowers(),
  };
  return withTeams({
    ...state,
    players: [...state.players, player],
    log: [...state.log, `${player.name} a rejoint la partie.`],
  });
}

export function setMode(state: P4State, mode: P4Mode): { state: P4State; error?: string } {
  if (state.phase !== 'lobby') return { state, error: 'La partie a déjà commencé.' };
  const config = MODES[mode];
  if (state.players.length > config.players) {
    return { state, error: `Ce mode n'accepte que ${config.players} joueurs. Il y en a déjà ${state.players.length}.` };
  }
  return {
    state: withTeams({ ...state, mode, cols: config.cols, rows: config.rows }),
  };
}

export function startGame(state: P4State): { state: P4State; error?: string } {
  const config = MODES[state.mode];
  if (state.phase !== 'lobby') return { state, error: 'La partie a déjà commencé.' };
  if (state.players.length !== config.players) {
    return { state, error: `Ce mode demande exactement ${config.players} joueurs.` };
  }

  return {
    state: withTeams({
      ...state,
      cols: config.cols,
      rows: config.rows,
      cells: Array<Disc | null>(config.cols * config.rows).fill(null),
      players: state.players.map((p) => ({ ...p, powers: initialPowers() })),
      turn: 0,
      phase: 'playing',
      effects: [],
      pendingDouble: false,
      discSeq: 0,
      winner: null,
      lastEvent: { seq: state.lastEvent.seq + 1, kind: 'none' },
      log: [...state.log, `Partie lancée en ${config.label}.`],
    }),
  };
}

export interface ActionResult {
  state: P4State;
  error?: string;
}

export function dropDisc(state: P4State, playerId: string, col: number, pierce = false): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };
  if (state.turn !== playerIndex) return { state, error: "Ce n'est pas ton tour." };
  if (col < 0 || col >= state.cols) return { state, error: 'Colonne invalide.' };
  if (isBlocked(state, col)) return { state, error: 'Cette colonne est bloquée.' };
  if (columnIsFull(state, col)) return { state, error: 'Cette colonne est pleine.' };

  const player = state.players[playerIndex];
  if (pierce && player.powers.pierce <= 0) {
    return { state, error: "Tu n'as plus de Traversée." };
  }

  const inverted = isInverted(state, col);
  const cells = [...state.cells];
  const disc: Disc = { id: `d${state.discSeq}`, owner: playerIndex };
  let landedRow: number;

  if (pierce) {
    // Slides underneath the whole stack — which, under inverted gravity, means
    // the top of the column, since that is where that column's floor is.
    const stack: Disc[] = [];
    for (let row = 0; row < state.rows; row++) {
      const existing = cells[cellIndex(state.cols, row, col)];
      if (existing) stack.push(existing);
    }
    const ordered = inverted ? [...stack, disc] : [disc, ...stack];
    for (let row = 0; row < state.rows; row++) cells[cellIndex(state.cols, row, col)] = null;
    const offset = inverted ? state.rows - ordered.length : 0;
    ordered.forEach((d, i) => {
      cells[cellIndex(state.cols, offset + i, col)] = d;
    });
    landedRow = inverted ? state.rows - 1 : 0;
  } else {
    landedRow = landingRow(state, col)!;
    cells[cellIndex(state.cols, landedRow, col)] = disc;
  }

  const players = state.players.map((p, i) =>
    i === playerIndex && pierce ? { ...p, powers: { ...p.powers, pierce: p.powers.pierce - 1 } } : p,
  );

  let next: P4State = {
    ...state,
    cells,
    players,
    discSeq: state.discSeq + 1,
    log: [
      ...state.log,
      pierce
        ? `${player.name} traverse la colonne ${col + 1}.`
        : `${player.name} joue en colonne ${col + 1}.`,
    ],
  };

  next = bumpEvent(next, {
    kind: pierce ? 'power' : 'drop',
    power: pierce ? 'pierce' : undefined,
    by: playerIndex,
    col,
    cell: cellIndex(state.cols, landedRow, col),
    inverted,
  });

  next = resolveBoard(next, teamOf(state, playerIndex));
  if (next.phase !== 'playing') return { state: next };

  return { state: endTurn(next) };
}

/** Named `activate` rather than `use` so it is not mistaken for a React hook. */
export function activatePower(
  state: P4State,
  playerId: string,
  power: PowerId,
  target: { col?: number; cell?: number },
): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };
  if (state.turn !== playerIndex) return { state, error: "Ce n'est pas ton tour." };
  if (power === 'pierce') return { state, error: 'La Traversée se joue en choisissant une colonne.' };

  const player = state.players[playerIndex];
  if (player.powers[power] <= 0) return { state, error: `Tu n'as plus de ${POWERS[power].name}.` };

  const cells = [...state.cells];
  let effects = state.effects;
  let logLine = '';
  let eventCol: number | undefined;
  let eventCell: number | undefined;

  if (power === 'destroy') {
    const cell = target.cell;
    if (cell === undefined || cell < 0 || cell >= cells.length) return { state, error: 'Cible invalide.' };
    const disc = cells[cell];
    if (!disc) return { state, error: 'Il n’y a pas de jeton ici.' };
    if (teamOf(state, disc.owner) === teamOf(state, playerIndex)) {
      return { state, error: 'Tu ne peux détruire qu’un jeton adverse.' };
    }
    const col = cell % state.cols;
    cells[cell] = null;
    settleColumn(cells, state.cols, state.rows, col, isInverted(state, col));
    eventCol = col;
    eventCell = cell;
    logLine = `${player.name} détruit un jeton en colonne ${col + 1}.`;
  } else if (power === 'invert') {
    const col = target.col;
    if (col === undefined || col < 0 || col >= state.cols) return { state, error: 'Colonne invalide.' };
    if (isInverted(state, col)) return { state, error: 'Cette colonne est déjà inversée.' };
    settleColumn(cells, state.cols, state.rows, col, true);
    // One lap *plus* the caster's own next turn. At exactly one lap the
    // inversion would collapse the instant play came back, so the player who
    // spent the power could never once play into the column they flipped.
    effects = [...effects, { col, kind: 'inverted', turnsLeft: state.players.length + 1, by: playerIndex }];
    eventCol = col;
    logLine = `${player.name} inverse la gravité de la colonne ${col + 1}.`;
  } else if (power === 'block') {
    const col = target.col;
    if (col === undefined || col < 0 || col >= state.cols) return { state, error: 'Colonne invalide.' };
    if (isBlocked(state, col)) return { state, error: 'Cette colonne est déjà bloquée.' };
    // Effects tick down on the turn-pass that immediately follows activation,
    // so a full table lap is `players.length`: everyone else gets locked out
    // exactly once, and it clears the moment play returns to the caster.
    effects = [...effects, { col, kind: 'blocked', turnsLeft: state.players.length, by: playerIndex }];
    eventCol = col;
    logLine = `${player.name} bloque la colonne ${col + 1}.`;
  } else if (power === 'double') {
    if (state.pendingDouble) return { state, error: 'Tu as déjà un double-tour en attente.' };
    logLine = `${player.name} enchaîne un double-tour !`;
  }

  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, powers: { ...p.powers, [power]: p.powers[power] - 1 } } : p,
  );

  let next: P4State = {
    ...state,
    cells,
    players,
    effects,
    pendingDouble: power === 'double' ? true : state.pendingDouble,
    log: [...state.log, logLine],
  };

  next = bumpEvent(next, { kind: 'power', power, by: playerIndex, col: eventCol, cell: eventCell });

  next = resolveBoard(next, teamOf(state, playerIndex));
  if (next.phase !== 'playing') return { state: next };

  return { state: POWERS[power].endsTurn ? endTurn(next) : next };
}

export function rematch(state: P4State): ActionResult {
  if (state.phase !== 'won' && state.phase !== 'draw') {
    return { state, error: "La partie n'est pas terminée." };
  }
  return startGame({ ...state, phase: 'lobby' });
}

export function applyAction(state: P4State, action: P4Action): ActionResult {
  switch (action.type) {
    case 'JOIN':
      return { state: addPlayer(state, action.playerId, action.name) };
    case 'SET_MODE':
      return setMode(state, action.mode);
    case 'START':
      return startGame(state);
    case 'DROP':
      return dropDisc(state, action.playerId, action.col, action.pierce);
    case 'USE_POWER':
      return activatePower(state, action.playerId, action.power, { col: action.col, cell: action.cell });
    case 'REMATCH':
      return rematch(state);
    case 'LEAVE': {
      if (state.phase === 'lobby') {
        return {
          state: withTeams({
            ...state,
            players: state.players.filter((p) => p.id !== action.playerId),
          }),
        };
      }
      const players = state.players.map((p) => (p.id === action.playerId ? { ...p, connected: false } : p));
      const next = { ...state, players };
      // Do not leave the table waiting on someone who is gone.
      const leaverIndex = state.players.findIndex((p) => p.id === action.playerId);
      if (state.phase === 'playing' && leaverIndex === state.turn) {
        return { state: advanceTurn(next) };
      }
      return { state: next };
    }
    default:
      return { state };
  }
}
