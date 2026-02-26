import {
  applyTexasHoldemCommand,
  buildTableActionStateDTO,
  createTexasHoldemState,
  type ActionOptionDTO,
  type DomainEvent,
  type PokerAction,
  type TableActionStateDTO,
  type TableCommand,
  type TablePhase,
  type TexasHoldemState,
} from '@poker/poker-engine';

export interface UserActionIntent {
  action: PokerAction;
  amount?: number;
}

export type TableLogKind = 'COMMAND' | 'EVENT' | 'SYSTEM' | 'ERROR';

export interface TableLogEntry {
  id: number;
  timestamp: string;
  kind: TableLogKind;
  message: string;
}

export interface TableViewModel {
  state: TexasHoldemState;
  actionState: TableActionStateDTO;
  userSeatId: number;
  handNumber: number;
  logs: TableLogEntry[];
}

interface LocalTableControllerOptions {
  userSeatId?: number;
}

type Listener = (model: TableViewModel) => void;

const MAX_LOGS = 120;
const BETTING_PHASES: readonly TablePhase[] = ['BETTING_PRE_FLOP', 'BETTING_FLOP', 'BETTING_TURN', 'BETTING_RIVER'];

function isBettingPhase(phase: TablePhase): boolean {
  return BETTING_PHASES.includes(phase);
}

function truncate(value: string, max = 140): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}

function getActionOption(options: readonly ActionOptionDTO[], action: PokerAction): ActionOptionDTO | undefined {
  return options.find((option) => option.action === action);
}

function chooseTargetAmount(option: ActionOptionDTO, fraction: number): number {
  const min = option.minAmount ?? 0;
  const max = option.maxAmount ?? min;
  if (max <= min) {
    return min;
  }
  const span = max - min;
  return min + Math.floor(span * fraction);
}

function chance(probability: number): boolean {
  return Math.random() < probability;
}

function chooseBotCommand(actionState: TableActionStateDTO, seatId: number): TableCommand | null {
  const seat = actionState.seats.find((candidate) => candidate.seatId === seatId);
  if (!seat) {
    return null;
  }

  const fold = getActionOption(seat.actions, 'FOLD');
  const check = getActionOption(seat.actions, 'CHECK');
  const call = getActionOption(seat.actions, 'CALL');
  const bet = getActionOption(seat.actions, 'BET');
  const raise = getActionOption(seat.actions, 'RAISE');
  const allIn = getActionOption(seat.actions, 'ALL_IN');

  if (check?.allowed) {
    if (bet?.allowed && chance(0.22)) {
      return {
        type: 'PLAYER_ACTION',
        seatId,
        action: 'BET',
        amount: chooseTargetAmount(bet, 0.2 + Math.random() * 0.3),
      };
    }
    return { type: 'PLAYER_ACTION', seatId, action: 'CHECK' };
  }

  if (call?.allowed) {
    const pressure = seat.toCall / Math.max(1, seat.stack);

    if (raise?.allowed && pressure < 0.25 && chance(0.18)) {
      return {
        type: 'PLAYER_ACTION',
        seatId,
        action: 'RAISE',
        amount: chooseTargetAmount(raise, 0.22 + Math.random() * 0.4),
      };
    }

    if (pressure <= 0.4 || chance(0.72)) {
      return { type: 'PLAYER_ACTION', seatId, action: 'CALL' };
    }

    if (allIn?.allowed && pressure < 0.65 && chance(0.2)) {
      return { type: 'PLAYER_ACTION', seatId, action: 'ALL_IN' };
    }

    if (fold?.allowed) {
      return { type: 'PLAYER_ACTION', seatId, action: 'FOLD' };
    }
  }

  if (bet?.allowed) {
    return {
      type: 'PLAYER_ACTION',
      seatId,
      action: 'BET',
      amount: chooseTargetAmount(bet, 0.2),
    };
  }

  if (raise?.allowed) {
    return {
      type: 'PLAYER_ACTION',
      seatId,
      action: 'RAISE',
      amount: chooseTargetAmount(raise, 0.2),
    };
  }

  if (allIn?.allowed && !fold?.allowed) {
    return { type: 'PLAYER_ACTION', seatId, action: 'ALL_IN' };
  }

  if (fold?.allowed) {
    return { type: 'PLAYER_ACTION', seatId, action: 'FOLD' };
  }

  return null;
}

export class LocalTableController {
  private state: TexasHoldemState;
  private actionState: TableActionStateDTO;
  private handNumber: number;
  private readonly userSeatId: number;
  private readonly botSeatIds: Set<number>;
  private readonly listeners: Set<Listener>;
  private logs: TableLogEntry[];
  private nextLogId: number;

  public constructor(options: LocalTableControllerOptions = {}) {
    this.userSeatId = options.userSeatId ?? 1;
    this.handNumber = 1;
    this.logs = [];
    this.nextLogId = 1;
    this.listeners = new Set();

    this.state = createTexasHoldemState({
      handId: 'hand-boot',
      dealerSeatId: 1,
      seed: 42,
      config: {
        smallBlind: 5,
        bigBlind: 10,
        minBuyIn: 100,
        maxBuyIn: 1000,
      },
      seats: [
        { seatId: 1, playerId: 'you', stack: 400 },
        { seatId: 2, playerId: 'bot-luna', stack: 400 },
        { seatId: 3, playerId: 'bot-echo', stack: 400 },
        { seatId: 4, playerId: 'bot-rio', stack: 400 },
      ],
    });

    this.actionState = buildTableActionStateDTO(this.state);
    this.botSeatIds = new Set(this.state.seats.map((seat) => seat.seatId).filter((seatId) => seatId !== this.userSeatId));

    this.pushLog('SYSTEM', 'Initialized local simulation table.');
    this.startNextHand();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.toViewModel());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public startNextHand(): void {
    this.safeExecute(() => {
      const handId = `hand-${String(this.handNumber).padStart(4, '0')}`;
      const nextSeed = this.state.rngSeed + 1;

      this.handNumber += 1;
      this.runCommand({ type: 'START_HAND', handId, seed: nextSeed });
      this.runCommand({ type: 'POST_BLINDS' });
      this.runCommand({ type: 'DEAL_HOLE' });
      this.runAutomationLoop();
    }, 'Unable to start next hand.');

    this.emit();
  }

  public performUserAction(intent: UserActionIntent): void {
    this.safeExecute(() => {
      if (!isBettingPhase(this.state.phase)) {
        throw new Error(`Cannot act in phase ${this.state.phase}.`);
      }

      if (this.state.actingSeatId !== this.userSeatId) {
        throw new Error(`Seat ${this.userSeatId} is not acting.`);
      }

      const command: TableCommand = {
        type: 'PLAYER_ACTION',
        seatId: this.userSeatId,
        action: intent.action,
      };

      if (typeof intent.amount === 'number') {
        command.amount = intent.amount;
      }

      this.runCommand(command);
      this.runAutomationLoop();
    }, `Unable to apply ${intent.action}.`);

    this.emit();
  }

  private runAutomationLoop(): void {
    for (let guard = 0; guard < 256; guard += 1) {
      if (this.state.phase === 'DEAL_FLOP') {
        this.runCommand({ type: 'DEAL_FLOP' });
        continue;
      }

      if (this.state.phase === 'DEAL_TURN') {
        this.runCommand({ type: 'DEAL_TURN' });
        continue;
      }

      if (this.state.phase === 'DEAL_RIVER') {
        this.runCommand({ type: 'DEAL_RIVER' });
        continue;
      }

      if (this.state.phase === 'SHOWDOWN') {
        this.runCommand({ type: 'RESOLVE_SHOWDOWN' });
        continue;
      }

      if (!isBettingPhase(this.state.phase)) {
        return;
      }

      const actingSeatId = this.state.actingSeatId;
      if (actingSeatId < 0 || actingSeatId === this.userSeatId || !this.botSeatIds.has(actingSeatId)) {
        return;
      }

      const command = chooseBotCommand(this.actionState, actingSeatId);
      if (!command) {
        this.pushLog('ERROR', `No legal bot command available for seat ${actingSeatId}.`);
        return;
      }

      this.runCommand(command);
    }

    this.pushLog('ERROR', 'Automation loop guard reached; stopped to prevent infinite loop.');
  }

  private runCommand(command: TableCommand): void {
    this.pushLog('COMMAND', this.describeCommand(command));
    const result = applyTexasHoldemCommand(this.state, command);

    this.state = result.state;
    this.actionState = buildTableActionStateDTO(this.state);

    for (const event of result.events) {
      this.pushLog('EVENT', this.describeEvent(event));
    }
  }

  private describeCommand(command: TableCommand): string {
    if (command.type === 'PLAYER_ACTION') {
      const suffix = typeof command.amount === 'number' ? ` ${command.amount}` : '';
      return `${command.type} seat=${command.seatId} action=${command.action}${suffix}`;
    }

    if (command.type === 'START_HAND') {
      return `${command.type} hand=${command.handId} seed=${command.seed ?? 'auto'}`;
    }

    return command.type;
  }

  private describeEvent(event: DomainEvent): string {
    const payloadText = truncate(JSON.stringify(event.payload));
    return `${event.type} ${payloadText}`;
  }

  private safeExecute(action: () => void, message: string): void {
    try {
      action();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.pushLog('ERROR', `${message} ${reason}`);
    }
  }

  private pushLog(kind: TableLogKind, message: string): void {
    this.logs.push({
      id: this.nextLogId,
      timestamp: new Date().toISOString().slice(11, 19),
      kind,
      message,
    });
    this.nextLogId += 1;

    if (this.logs.length > MAX_LOGS) {
      this.logs.splice(0, this.logs.length - MAX_LOGS);
    }
  }

  private toViewModel(): TableViewModel {
    return {
      state: this.state,
      actionState: this.actionState,
      userSeatId: this.userSeatId,
      handNumber: this.handNumber - 1,
      logs: [...this.logs],
    };
  }

  private emit(): void {
    const model = this.toViewModel();
    for (const listener of this.listeners) {
      listener(model);
    }
  }
}
