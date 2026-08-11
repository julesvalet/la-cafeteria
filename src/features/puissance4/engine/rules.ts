import { MODES } from './modes';
import { POWERS, rollCharges } from './powers';
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
    pendingPower: null,
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
  // Runs are finite, so a game can also simply run out of discs.
  if (state.players.length > 0 && state.players.every((p) => p.charges.length === 0)) {
    return {
      ...state,
      phase: 'draw',
      log: [...state.log, 'Plus personne n’a de jetons : match nul.'],
    };
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

/** A seat can still act if it is connected and has discs left to play. */
function canAct(state: P4State, index: number): boolean {
  const player = state.players[index];
  return Boolean(player?.connected) && player.charges.length > 0;
}

function nextTurn(state: P4State): number {
  const n = state.players.length;
  if (n === 0) return 0;
  for (let step = 1; step <= n; step++) {
    const candidate = (state.turn + step) % n;
    if (canAct(state, candidate)) return candidate;
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

/**
 * Hands the turn on. Unlike the old power system there is nothing to "bank"
 * here: a double turn simply skips this call once, so the player drops again.
 */
function endTurn(state: P4State): P4State {
  // Re-resolved after the hand-off: passing the turn can exhaust the last run,
  // and an expiring inversion can drop a column into a winning line.
  return resolveBoard(advanceTurn({ ...state, pendingDouble: false }), null);
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
    // Filled in when the game starts; an empty run in the lobby is correct.
    charges: [],
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
      // Each player gets their own independent roll.
      players: state.players.map((p) => ({ ...p, charges: rollCharges(config.discs) })),
      turn: 0,
      phase: 'playing',
      effects: [],
      pendingDouble: false,
      pendingPower: null,
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

/** Whether a power that needs aiming has anything legal to aim at. */
export function hasTargetFor(state: P4State, power: PowerId, playerIndex: number): boolean {
  if (power === 'destroy') {
    return state.cells.some((disc) => disc && teamOf(state, disc.owner) !== teamOf(state, playerIndex));
  }
  if (power === 'invert') {
    for (let col = 0; col < state.cols; col++) if (!isInverted(state, col)) return true;
    return false;
  }
  if (power === 'block') {
    for (let col = 0; col < state.cols; col++) if (!isBlocked(state, col)) return true;
    return false;
  }
  return true;
}

/**
 * Plays the player's next disc. Nobody picks a power here: the disc at the head
 * of the run either carries one or does not, and this is where that is found
 * out. `pierce` changes where the disc lands, `double` holds the turn, and the
 * three aimed powers park in `pendingPower` until the player designates a
 * target.
 */
export function dropDisc(state: P4State, playerId: string, col: number): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };
  if (state.turn !== playerIndex) return { state, error: "Ce n'est pas ton tour." };
  if (state.pendingPower) return { state, error: "Termine d'abord ton pouvoir en cours." };
  if (col < 0 || col >= state.cols) return { state, error: 'Colonne invalide.' };
  if (isBlocked(state, col)) return { state, error: 'Cette colonne est bloquée.' };
  if (columnIsFull(state, col)) return { state, error: 'Cette colonne est pleine.' };

  const player = state.players[playerIndex];
  if (player.charges.length === 0) return { state, error: "Tu n'as plus de jetons." };

  const charged = player.charges[0];
  const pierce = charged === 'pierce';
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

  // The disc leaves the run whatever happens next.
  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, charges: p.charges.slice(1) } : p,
  );

  const log = [
    ...state.log,
    pierce
      ? `${player.name} traverse la colonne ${col + 1} !`
      : `${player.name} joue en colonne ${col + 1}.`,
  ];

  let next: P4State = {
    ...state,
    cells,
    players,
    discSeq: state.discSeq + 1,
    // Cleared here and re-armed below only if *this* disc is a double.
    pendingDouble: false,
    log,
  };

  // `pierce` and `double` are their own announcement; the aimed powers keep the
  // plain landing here and get their effect once a target is picked.
  const announced = charged === 'pierce' || charged === 'double';
  next = bumpEvent(next, {
    kind: announced ? 'power' : 'drop',
    power: announced ? charged : undefined,
    by: playerIndex,
    col,
    cell: cellIndex(state.cols, landedRow, col),
    inverted,
  });

  next = resolveBoard(next, teamOf(state, playerIndex));
  if (next.phase !== 'playing') return { state: next };

  if (charged === 'double') {
    next = { ...next, pendingDouble: true, log: [...next.log, `${player.name} enchaîne : double-tour !`] };
    return { state: next };
  }

  const def = charged ? POWERS[charged] : null;
  if (def && def.target !== 'none') {
    if (!hasTargetFor(next, charged as PowerId, playerIndex)) {
      return {
        state: endTurn({
          ...next,
          log: [...next.log, `${def.name} n'avait aucune cible : le pouvoir se perd.`],
        }),
      };
    }
    return {
      state: {
        ...next,
        pendingPower: { power: charged as PowerId, by: playerIndex },
        log: [...next.log, `${player.name} déclenche ${def.name} !`],
      },
    };
  }

  return { state: endTurn(next) };
}

/**
 * Aims the power of the disc that just landed. Only ever reachable while
 * `pendingPower` is set, so there is no power to name and nothing to spend —
 * the disc already paid for it.
 */
export function resolvePower(
  state: P4State,
  playerId: string,
  target: { col?: number; cell?: number },
): ActionResult {
  const pending = state.pendingPower;
  if (!pending) return { state, error: "Aucun pouvoir n'attend de cible." };

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Joueur inconnu.' };
  if (state.phase !== 'playing') return { state, error: "La partie n'est pas en cours." };
  if (pending.by !== playerIndex) return { state, error: "Ce pouvoir n'est pas le tien." };

  const power = pending.power;
  const player = state.players[playerIndex];
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
  } else {
    return { state, error: `${POWERS[power].name} ne se vise pas.` };
  }

  let next: P4State = {
    ...state,
    cells,
    effects,
    pendingPower: null,
    log: [...state.log, logLine],
  };

  next = bumpEvent(next, { kind: 'power', power, by: playerIndex, col: eventCol, cell: eventCell });

  next = resolveBoard(next, teamOf(state, playerIndex));
  if (next.phase !== 'playing') return { state: next };

  // A drop clears `pendingDouble` before re-arming it, so a double turn and an
  // aimed power can never be outstanding together: the turn always passes here.
  return { state: endTurn(next) };
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
      return dropDisc(state, action.playerId, action.col);
    case 'RESOLVE_POWER':
      return resolvePower(state, action.playerId, { col: action.col, cell: action.cell });
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
      const leaverIndex = state.players.findIndex((p) => p.id === action.playerId);
      // Never leave the table waiting on someone who is gone — including on a
      // power they walked out mid-aim, which would deadlock every other seat.
      const abandoned = state.pendingPower?.by === leaverIndex;
      const next = { ...state, players, pendingPower: abandoned ? null : state.pendingPower };
      if (state.phase === 'playing' && (leaverIndex === state.turn || abandoned)) {
        return { state: endTurn(next) };
      }
      return { state: next };
    }
    default:
      return { state };
  }
}
