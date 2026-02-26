import type { ActionOptionDTO, PokerAction, SeatActionStateDTO, SeatState, TablePhase } from '@poker/poker-engine';
import './styles.css';
import { HOW_TO_GUIDES } from './content/howto-content';
import { LocalTableController, type TableController, type TableViewModel } from './table-controller';
import {
  getAvailableMultiTableActionIdsFromActionState,
  getPendingDecisionCountFromState,
  getRaiseBoundsFromActionState,
  normalizeSelectedMultiTableAction,
  resolveMultiTableActionOptionForIntent,
  type MultiTableActionId,
} from './multi-table-logic';
import { executeMultiTableAction } from './multi-table-action-submit';
import { buildWinOddsSnapshot, type SeatWinOdds, type WinOddsSnapshot } from './win-odds';
import { createClientAuthBridge } from './client-auth.ts';
import type { ExternalAuthSessionState } from './auth/external-auth-session-bridge.ts';
import { createRuntimeTableController } from './table-controller-factory.ts';

const root = document.getElementById('app');

if (!root) {
  throw new Error('App root #app was not found.');
}
const appRoot = root;

const seatAvatarById: Record<number, string> = {
  1: 'player_02',
  2: 'nikola-tesla',
  3: 'robot-01',
  4: 'dave-grohl',
};
const seatRadarPositionById: Record<number, string> = {
  1: 'seat-pos-bottom',
  2: 'seat-pos-left',
  3: 'seat-pos-top',
  4: 'seat-pos-right',
};

interface SeatCoordinate {
  xPercent: number;
  yPercent: number;
}

const seatCoordinateById: Record<number, SeatCoordinate> = {
  1: { xPercent: 50, yPercent: 85 },
  2: { xPercent: 12, yPercent: 50 },
  3: { xPercent: 50, yPercent: 15 },
  4: { xPercent: 88, yPercent: 50 },
};

const POT_COORDINATE: SeatCoordinate = { xPercent: 50, yPercent: 50 };
interface LobbyTableCard {
  id: string;
  name: string;
  stakesLabel: string;
  occupancyLabel: string;
  paceLabel: string;
}

interface MultiTableCard {
  id: string;
  name: string;
  stakesLabel: string;
  occupancyLabel: string;
  avgPot: number;
  minRaise: number;
  maxRaise: number;
  callAmount: number;
}

interface MultiTableSeat {
  seatId: number;
  playerLabel: string;
  stack: number;
  status: string;
  positionClass: string;
  isUser?: boolean;
}

interface MultiTableActionOption {
  id: MultiTableActionId;
  label: string;
  shortcut: string;
  tone: 'neutral' | 'aggressive' | 'caution' | 'danger';
}

interface MultiTableUiState {
  selectedTableId: string;
  selectedActionId: MultiTableActionId;
  targetBetAmount: number;
  activityNote: string;
  lastSubmittedActionId: MultiTableActionId | null;
  lastSubmittedAtMs: number | null;
}

const LOBBY_TABLES: readonly LobbyTableCard[] = [
  {
    id: 'table-emerald',
    name: 'Emerald Rush',
    stakesLabel: '5 / 10',
    occupancyLabel: '4 max',
    paceLabel: 'Fast',
  },
  {
    id: 'table-sapphire',
    name: 'Sapphire Deep',
    stakesLabel: '10 / 20',
    occupancyLabel: '4 max',
    paceLabel: 'Standard',
  },
  {
    id: 'table-onyx',
    name: 'Onyx Grind',
    stakesLabel: '2 / 5',
    occupancyLabel: '4 max',
    paceLabel: 'Slow',
  },
];

const MULTI_TABLE_CARDS: readonly MultiTableCard[] = [
  {
    id: 'atlas-01',
    name: 'Atlas 01',
    stakesLabel: '10 / 20',
    occupancyLabel: '5/6 seated',
    avgPot: 360,
    minRaise: 40,
    maxRaise: 900,
    callAmount: 20,
  },
  {
    id: 'blaze-04',
    name: 'Blaze 04',
    stakesLabel: '25 / 50',
    occupancyLabel: '6/6 seated',
    avgPot: 940,
    minRaise: 100,
    maxRaise: 2_500,
    callAmount: 50,
  },
  {
    id: 'drift-09',
    name: 'Drift 09',
    stakesLabel: '5 / 10',
    occupancyLabel: '4/6 seated',
    avgPot: 240,
    minRaise: 20,
    maxRaise: 560,
    callAmount: 10,
  },
];

const MULTI_TABLE_SEATS: readonly MultiTableSeat[] = [
  { seatId: 1, playerLabel: 'You', stack: 1_240, status: 'Acting', positionClass: 'multi-seat-pos-bottom', isUser: true },
  { seatId: 2, playerLabel: 'Rook', stack: 910, status: 'In Pot', positionClass: 'multi-seat-pos-left' },
  { seatId: 3, playerLabel: 'Ivy', stack: 1_580, status: 'In Pot', positionClass: 'multi-seat-pos-top' },
  { seatId: 4, playerLabel: 'Flux', stack: 720, status: 'Folded', positionClass: 'multi-seat-pos-right' },
];

const MULTI_TABLE_ACTIONS: readonly MultiTableActionOption[] = [
  { id: 'FOLD', label: 'Fold', shortcut: 'F', tone: 'caution' },
  { id: 'CHECK', label: 'Check', shortcut: 'K', tone: 'neutral' },
  { id: 'CALL', label: 'Call', shortcut: 'C', tone: 'neutral' },
  { id: 'RAISE', label: 'Raise', shortcut: 'R', tone: 'aggressive' },
  { id: 'ALL_IN', label: 'All In', shortcut: 'A', tone: 'danger' },
];

const MULTI_TABLE_DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
let multiTableState: MultiTableUiState = {
  selectedTableId: MULTI_TABLE_CARDS[0]?.id ?? '',
  selectedActionId: 'CALL',
  targetBetAmount: MULTI_TABLE_CARDS[0]?.minRaise ?? 0,
  activityNote: 'Seat 1 to act. Use action shortcuts on desktop (F/K/C/R/A + Enter).',
  lastSubmittedActionId: null,
  lastSubmittedAtMs: null,
};

let controller: TableController | null = null;
let removeControllerListener: (() => void) | null = null;
let activeView: 'lobby' | 'play' | 'howto' | 'multitable' = 'lobby';
let selectedGuideId = HOW_TO_GUIDES[0]?.id ?? '';
let selectedLobbyTableId = LOBBY_TABLES[0]?.id ?? '';
let selectedLobbySeatId = 1;
let previousPlaySnapshot: PlaySnapshot | null = null;
let lastRenderedModel: TableViewModel | null = null;
let resizeRenderQueued = false;
let draftTargetBetAmount: number | null = null;
let lastProcessedEventLogId: number | null = null;
let hasCompletedInitialRender = false;
const howToCardFaceUpOverrides = new Map<string, boolean>();
const BOARD_DEAL_STAGGER_MS = 70;
const CHIP_FLOW_STAGGER_MS = 90;
const MULTI_ACTION_CONFIRM_MS = 440;
const MULTI_TABLE_USER_SEAT_ID = 1;
const MULTI_TABLE_AUTO_NEXT_HAND_DELAY_MS = 850;
let multiActionConfirmTimerId: number | null = null;
const multiTableControllerById = new Map<string, LocalTableController>();
const multiTableModelByTableId = new Map<string, TableViewModel>();
const multiTableAutoNextHandTimerById = new Map<string, number>();
const clientAuthBridge = createClientAuthBridge();
let clientAuthState: ExternalAuthSessionState = clientAuthBridge.getState();

interface PlaySnapshot {
  handId: string;
  phase: TablePhase;
  boardCount: number;
  actingSeatId: number;
  isUserTurn: boolean;
}

interface PlayTransitionState {
  handAdvanced: boolean;
  phaseChanged: boolean;
  boardAdvanced: boolean;
  actingSeatChanged: boolean;
  userTurnChanged: boolean;
  previousBoardCount: number;
  boardCount: number;
}

type MotionCue = 'IDLE' | 'HAND_STARTED' | 'BOARD_DEALT' | 'PLAYER_ACTION' | 'TURN_CHANGED' | 'HAND_COMPLETE';

interface MotionClassSet {
  shellClass: string;
  playFeltClass: string;
  playBoardClass: string;
  playTurnPanelClass: string;
  playControlsClass: string;
  multiShellClass: string;
  multiFeedClass: string;
  multiActionClass: string;
}

interface BoardDealAnimationPlan {
  boardClass: string;
  dealtSlotIndices: readonly number[];
  streetEmphasisIndices: readonly number[];
}

interface EventLogSnapshot {
  logId: number;
  type: string;
  payload: unknown;
}

type ChipFlowDirection = 'TO_POT' | 'FROM_POT';

interface ChipFlowTransfer {
  seatId: number;
  amount: number;
  direction: ChipFlowDirection;
  delayMs: number;
}

interface ChipFlowAnimationPlan {
  feltClass: string;
  transfers: readonly ChipFlowTransfer[];
  activityText: string | null;
}

function initializeMultiTableControllers(): void {
  for (const table of MULTI_TABLE_CARDS) {
    const tableController = new LocalTableController({ userSeatId: MULTI_TABLE_USER_SEAT_ID });
    multiTableControllerById.set(table.id, tableController);

    tableController.subscribe((model) => {
      multiTableModelByTableId.set(table.id, model);
      scheduleMultiTableAutoNextHand(table.id, model);
      if (table.id === multiTableState.selectedTableId) {
        setMultiTableBetAmount(multiTableState.targetBetAmount);
      }
      if (activeView === 'multitable' && lastRenderedModel) {
        render(appRoot, lastRenderedModel);
      }
    });
  }
}

function scheduleMultiTableAutoNextHand(tableId: string, model: TableViewModel): void {
  const existingTimerId = multiTableAutoNextHandTimerById.get(tableId);
  if (model.state.phase !== 'HAND_COMPLETE') {
    if (typeof existingTimerId === 'number') {
      window.clearTimeout(existingTimerId);
      multiTableAutoNextHandTimerById.delete(tableId);
    }
    return;
  }

  if (typeof existingTimerId === 'number') {
    return;
  }

  const timerId = window.setTimeout(() => {
    multiTableAutoNextHandTimerById.delete(tableId);
    const controllerForTable = multiTableControllerById.get(tableId);
    controllerForTable?.startNextHand();
  }, MULTI_TABLE_AUTO_NEXT_HAND_DELAY_MS);
  multiTableAutoNextHandTimerById.set(tableId, timerId);
}

initializeMultiTableControllers();
mountControllerForSeat(selectedLobbySeatId);
clientAuthBridge.subscribe((state) => {
  clientAuthState = state;
  if (!lastRenderedModel) {
    return;
  }
  render(appRoot, lastRenderedModel);
});
void clientAuthBridge.start();
window.addEventListener('beforeunload', () => {
  clientAuthBridge.stop();
});
window.addEventListener('resize', () => {
  if (!lastRenderedModel || resizeRenderQueued) {
    return;
  }

  resizeRenderQueued = true;
  window.requestAnimationFrame(() => {
    resizeRenderQueued = false;
    if (!lastRenderedModel) {
      return;
    }
    render(appRoot, lastRenderedModel);
  });
});
window.addEventListener('keydown', (event) => {
  if (!lastRenderedModel || activeView !== 'multitable' || !isMultiTableDesktopViewport()) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'arrowleft') {
    event.preventDefault();
    cycleMultiTableActionSelection(-1);
    render(appRoot, lastRenderedModel);
    return;
  }
  if (key === 'arrowright') {
    event.preventDefault();
    cycleMultiTableActionSelection(1);
    render(appRoot, lastRenderedModel);
    return;
  }
  if (key === 'enter') {
    event.preventDefault();
    applyMultiTableAction();
    render(appRoot, lastRenderedModel);
    return;
  }

  const action = MULTI_TABLE_ACTIONS.find((candidate) => candidate.shortcut.toLowerCase() === key);
  if (!action) {
    return;
  }

  const actionOption = resolveMultiTableActionOption(multiTableState.selectedTableId, action.id);
  if (!actionOption?.allowed) {
    return;
  }

  event.preventDefault();
  multiTableState.selectedActionId = action.id;
  render(appRoot, lastRenderedModel);
});

function mountControllerForSeat(userSeatId: number): void {
  previousPlaySnapshot = null;
  draftTargetBetAmount = null;
  lastProcessedEventLogId = null;
  removeControllerListener?.();
  controller = createRuntimeTableController({ userSeatId });
  removeControllerListener = controller.subscribe((model) => {
    render(appRoot, model);
  });
}

function render(container: HTMLElement, model: TableViewModel): void {
  lastRenderedModel = model;

  const userSeatAction = model.actionState.seats.find((seat) => seat.seatId === model.userSeatId);
  const isUserTurn = model.state.actingSeatId === model.userSeatId && isBettingPhase(model.state.phase);
  const allowedActions = userSeatAction?.actions.filter((option) => option.allowed) ?? [];
  const amountOption = allowedActions.find((option) => option.amountSemantics === 'TARGET_BET') ?? null;
  const defaultAmount = amountOption?.minAmount ?? 0;
  const transitionState = buildPlayTransitionState(model, isUserTurn);
  const freshEvents = consumeFreshEventLogs(model);
  const latestEventType = freshEvents.at(-1)?.type ?? null;
  const shouldAnimateEventLog = freshEvents.length > 0;
  const motionCue = resolveMotionCue(model, transitionState, latestEventType);
  const boardDealPlan = buildBoardDealAnimationPlan(transitionState, latestEventType);
  const chipFlowPlan = buildChipFlowAnimationPlan(model, freshEvents);
  const motionClasses = buildMotionClassSet(motionCue);
  if (transitionState.handAdvanced) {
    draftTargetBetAmount = null;
  }
  const targetBetInputAmount = resolveTargetBetInputAmount(amountOption, defaultAmount);
  if (activeView === 'multitable') {
    normalizeMultiTableActionSelection();
    setMultiTableBetAmount(multiTableState.targetBetAmount);
  }
  const winOddsSnapshot = activeView === 'play' ? buildWinOddsSnapshot(model.state) : null;
  const topbarStatus =
    activeView === 'play'
      ? `Hand #${model.handNumber} · Pot ${chips(model.state.pot)}`
      : activeView === 'lobby'
        ? 'Lobby'
        : activeView === 'multitable'
          ? 'Multi-Table'
          : 'Rules';
  const authStatus = formatClientAuthStatus(clientAuthState);
  const isPlayView = activeView === 'play';
  const topbarClasses = ['app-topbar', isPlayView ? 'is-play-focus' : ''].filter((value) => value.length > 0).join(' ');

  const shellClasses = ['table-shell', motionClasses.shellClass].filter((value) => value.length > 0);
  if (!hasCompletedInitialRender) {
    shellClasses.push('is-initial-enter');
  }

  container.innerHTML = [
    `  <div class="${shellClasses.join(' ')}">`,
    `  <header class="${topbarClasses}">`,
    '    <div class="app-topbar-brand">',
    '      <p class="app-badge">Poker App</p>',
    `      <p class="app-status">${escapeHtml(topbarStatus)}</p>`,
    `      <p class="app-status app-auth-status">${escapeHtml(authStatus)}</p>`,
    '    </div>',
    '    <nav class="app-topbar-nav" aria-label="Primary views">',
    ...(isPlayView
      ? [
          '      <button class="view-tab" data-role="view-lobby" aria-pressed="false">Lobby</button>',
          '      <span class="view-pill is-active" aria-current="page">Table</span>',
          '      <button class="view-tab" data-role="view-multitable" aria-pressed="false">Multi</button>',
        ]
      : [
          `      <button class="${activeView === 'lobby' ? 'view-tab is-active' : 'view-tab'}" data-role="view-lobby" aria-pressed="${activeView === 'lobby' ? 'true' : 'false'}">Lobby</button>`,
          `      <button class="${activeView === 'play' ? 'view-tab is-active' : 'view-tab'}" data-role="view-play" aria-pressed="${activeView === 'play' ? 'true' : 'false'}">Table</button>`,
          `      <button class="${activeView === 'multitable' ? 'view-tab is-active' : 'view-tab'}" data-role="view-multitable" aria-pressed="${activeView === 'multitable' ? 'true' : 'false'}">Multi Table</button>`,
          `      <button class="${activeView === 'howto' ? 'view-tab is-active' : 'view-tab'}" data-role="view-howto" aria-pressed="${activeView === 'howto' ? 'true' : 'false'}">Rules</button>`,
        ]),
    '    </nav>',
    '  </header>',
    activeView === 'play'
      ? renderPlayView(
          model,
          userSeatAction?.actions ?? [],
          isUserTurn,
          amountOption,
          targetBetInputAmount,
          winOddsSnapshot as WinOddsSnapshot,
          transitionState,
          boardDealPlan,
          chipFlowPlan,
          motionClasses,
        )
      : activeView === 'lobby'
        ? renderLobbyView(model)
        : activeView === 'multitable'
          ? renderMultiTableView(motionClasses, chipFlowPlan)
          : renderHowToView(),
    activeView === 'play' ? renderAuditLog(model, shouldAnimateEventLog) : '',
    '</div>',
  ].join('\n');
  hasCompletedInitialRender = true;

  const lobbyViewButton = container.querySelector<HTMLButtonElement>('[data-role="view-lobby"]');
  lobbyViewButton?.addEventListener('click', () => {
    activeView = 'lobby';
    render(container, model);
  });

  const enterTableButton = container.querySelector<HTMLButtonElement>('[data-role="enter-table"]');
  enterTableButton?.addEventListener('click', () => {
    const selectedSeat = selectedLobbySeatId;
    activeView = 'play';
    if (model.userSeatId !== selectedSeat) {
      mountControllerForSeat(selectedSeat);
      return;
    }
    render(container, model);
  });

  const tableButtons = container.querySelectorAll<HTMLButtonElement>('[data-table-id]');
  tableButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tableId = button.dataset.tableId;
      if (!tableId) {
        return;
      }

      selectedLobbyTableId = tableId;
      render(container, model);
    });
  });

  const seatButtons = container.querySelectorAll<HTMLButtonElement>('[data-seat-id]');
  seatButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextSeat = Number(button.dataset.seatId);
      if (!Number.isInteger(nextSeat)) {
        return;
      }

      selectedLobbySeatId = nextSeat;
      render(container, model);
    });
  });

  const playViewButton = container.querySelector<HTMLButtonElement>('[data-role="view-play"]');
  playViewButton?.addEventListener('click', () => {
    activeView = 'play';
    if (model.userSeatId !== selectedLobbySeatId) {
      mountControllerForSeat(selectedLobbySeatId);
      return;
    }
    render(container, model);
  });

  const multiTableViewButton = container.querySelector<HTMLButtonElement>('[data-role="view-multitable"]');
  multiTableViewButton?.addEventListener('click', () => {
    activeView = 'multitable';
    render(container, model);
  });

  const howToViewButton = container.querySelector<HTMLButtonElement>('[data-role="view-howto"]');
  howToViewButton?.addEventListener('click', () => {
    activeView = 'howto';
    render(container, model);
  });

  const guideButtons = container.querySelectorAll<HTMLButtonElement>('[data-role="howto-guide-tab"]');
  guideButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextId = button.dataset.guideId;
      if (!nextId) {
        return;
      }
      selectedGuideId = nextId;
      render(container, model);
    });
  });

  if (activeView === 'howto') {
    const cardToggleButtons = container.querySelectorAll<HTMLButtonElement>('[data-role="howto-card-toggle"]');
    cardToggleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const guideId = button.dataset.guideId;
        const exampleIndex = Number(button.dataset.exampleIndex);
        const cardIndex = Number(button.dataset.cardIndex);
        const defaultFaceUp = button.dataset.defaultFaceUp === 'true';
        if (!guideId || !Number.isInteger(exampleIndex) || !Number.isInteger(cardIndex)) {
          return;
        }

        const currentFaceUp = resolveHowToCardFaceUp(guideId, exampleIndex, cardIndex, defaultFaceUp);
        const nextFaceUp = !currentFaceUp;
        setHowToCardFaceUpOverride(guideId, exampleIndex, cardIndex, defaultFaceUp, nextFaceUp);
        applyHowToCardButtonFace(button, nextFaceUp);
      });
    });
  }

  if (activeView === 'multitable') {
    const multiTableButtons = container.querySelectorAll<HTMLButtonElement>('[data-role="multi-table-select"]');
    multiTableButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tableId = button.dataset.tableId;
        if (!tableId) {
          return;
        }

        const table = MULTI_TABLE_CARDS.find((candidate) => candidate.id === tableId);
        if (!table) {
          return;
        }

        multiTableState.selectedTableId = tableId;
        normalizeMultiTableActionSelection();
        setMultiTableBetAmount(multiTableState.targetBetAmount);
        render(container, model);
      });
    });

    const actionButtons = container.querySelectorAll<HTMLButtonElement>('[data-role="multi-action-select"]');
    actionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const actionId = button.dataset.actionId as MultiTableActionId | undefined;
        if (!actionId) {
          return;
        }
        const actionOption = resolveMultiTableActionOption(multiTableState.selectedTableId, actionId);
        if (!actionOption?.allowed) {
          return;
        }
        multiTableState.selectedActionId = actionId;
        render(container, model);
      });
    });

    const amountInput = container.querySelector<HTMLInputElement>('[data-role="multi-bet-input"]');
    amountInput?.addEventListener('input', () => {
      const nextValue = Number(amountInput.value);
      setMultiTableBetAmount(nextValue);
      render(container, model);
    });

    const amountRange = container.querySelector<HTMLInputElement>('[data-role="multi-bet-range"]');
    amountRange?.addEventListener('input', () => {
      const nextValue = Number(amountRange.value);
      setMultiTableBetAmount(nextValue);
      render(container, model);
    });

    const stepButtons = container.querySelectorAll<HTMLButtonElement>('[data-role="multi-bet-step"]');
    stepButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const delta = Number(button.dataset.amountDelta);
        if (!Number.isFinite(delta)) {
          return;
        }
        setMultiTableBetAmount(multiTableState.targetBetAmount + delta);
        render(container, model);
      });
    });

    const submitButton = container.querySelector<HTMLButtonElement>('[data-role="multi-action-submit"]');
    submitButton?.addEventListener('click', () => {
      applyMultiTableAction();
      render(container, model);
    });
  }

  if (activeView === 'play') {
    const nextHandButton = container.querySelector<HTMLButtonElement>('[data-role="next-hand"]');
    nextHandButton?.addEventListener('click', () => {
      controller?.startNextHand();
    });

    const amountInput = container.querySelector<HTMLInputElement>('[data-role="action-amount"]');
    amountInput?.addEventListener('input', () => {
      const nextRawValue = amountInput.value.trim();
      if (nextRawValue.length === 0) {
        draftTargetBetAmount = null;
        return;
      }

      const parsedAmount = Number(nextRawValue);
      if (!Number.isFinite(parsedAmount)) {
        return;
      }
      draftTargetBetAmount = Math.round(parsedAmount);
    });

    const presetButtons = container.querySelectorAll<HTMLButtonElement>('[data-set-amount]');
    presetButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (!amountInput) {
          return;
        }

        const amount = Number(button.dataset.setAmount);
        if (!Number.isFinite(amount)) {
          return;
        }

        const roundedAmount = Math.round(amount);
        draftTargetBetAmount = roundedAmount;
        amountInput.value = String(roundedAmount);
        amountInput.focus();
      });
    });

    const actionButtons = container.querySelectorAll<HTMLButtonElement>('[data-action]');
    actionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action as PokerAction | undefined;
        if (!action || !userSeatAction) {
          return;
        }

        const option = userSeatAction.actions.find((candidate) => candidate.action === action && candidate.allowed);
        if (!option) {
          return;
        }

        let amount: number | undefined;
        if (option.amountSemantics === 'TARGET_BET') {
          const parsedAmount = Number(amountInput?.value ?? targetBetInputAmount);
          const min = option.minAmount ?? parsedAmount;
          const max = option.maxAmount ?? parsedAmount;
          const clampedAmount = clampWholeNumberAmount(parsedAmount, min, max);

          if (!Number.isFinite(clampedAmount)) {
            return;
          }

          amount = clampedAmount;
          draftTargetBetAmount = clampedAmount;
          if (amountInput) {
            amountInput.value = String(clampedAmount);
          }
        }

        controller?.performUserAction({ action, amount });
      });
    });
  }
}

function chips(amount: number): string {
  return `${amount.toLocaleString()} chips`;
}

function formatClientAuthStatus(state: ExternalAuthSessionState): string {
  if (state.status === 'disabled') {
    return 'Auth: local mode';
  }
  if (state.status === 'linked' && state.storedSession) {
    return `Auth: linked (${state.storedSession.userEmail})`;
  }
  if (state.status === 'linking') {
    return 'Auth: linking...';
  }
  if (state.status === 'waiting_for_identity') {
    return 'Auth: waiting for Firebase sign-in';
  }
  return `Auth: error (${state.message})`;
}

function metricPill(label: string, value: string): string {
  return [
    '<article class="metric-pill">',
    `  <p>${escapeHtml(label)}</p>`,
    `  <strong>${escapeHtml(value)}</strong>`,
    '</article>',
  ].join('\n');
}

function renderPlayView(
  model: TableViewModel,
  actionOptions: readonly ActionOptionDTO[],
  isUserTurn: boolean,
  amountOption: ActionOptionDTO | null,
  targetBetInputAmount: number,
  winOddsSnapshot: WinOddsSnapshot,
  transitionState: PlayTransitionState,
  boardDealPlan: BoardDealAnimationPlan,
  chipFlowPlan: ChipFlowAnimationPlan,
  motionClasses: MotionClassSet,
): string {
  const quickAmounts = buildQuickAmountPresets(amountOption, targetBetInputAmount, model.state.pot);
  const actingSeatLabel = model.state.actingSeatId > 0 ? `Seat ${model.state.actingSeatId}` : 'No active seat';
  const userWinChance = getSeatWinOdds(winOddsSnapshot, model.userSeatId)?.percentage ?? 0;
  const metricsClass = transitionState.handAdvanced ? 'table-metrics is-refresh' : 'table-metrics';
  const feltClasses = ['felt-table'];
  if (motionClasses.playFeltClass.length > 0) {
    feltClasses.push(motionClasses.playFeltClass);
  }
  if (transitionState.phaseChanged) {
    feltClasses.push('is-phase-shift');
  }
  if (chipFlowPlan.feltClass.length > 0) {
    feltClasses.push(chipFlowPlan.feltClass);
  }
  if (motionClasses.playBoardClass.length > 0) {
    feltClasses.push(motionClasses.playBoardClass);
  }
  const turnPanelClasses = ['turn-panel', motionClasses.playTurnPanelClass]
    .filter((value) => value.length > 0)
    .join(' ');
  const controlsPanelClasses = [
    'controls-panel',
    isUserTurn ? 'is-live' : 'is-waiting',
    motionClasses.playControlsClass,
  ]
    .filter((value) => value.length > 0)
    .join(' ');
  const boardClasses = ['board-cards'];
  if (motionClasses.playBoardClass.length > 0) {
    boardClasses.push(motionClasses.playBoardClass);
  }
  if (boardDealPlan.boardClass.length > 0) {
    boardClasses.push(boardDealPlan.boardClass);
  }

  return [
    `  <section class="${metricsClass}">`,
    metricPill('Hand', `#${model.handNumber}`),
    metricPill('Phase', formatPhaseLabel(model.state.phase)),
    metricPill('Pot', chips(model.state.pot)),
    metricPill('Your Win %', formatWinPercentage(userWinChance)),
    '  </section>',
    `  ${renderHandOutcomeBanner(model, winOddsSnapshot)}`,
    '  <div class="play-layout">',
    '    <section class="play-main">',
    '      <section class="table-stage">',
    `        <article class="${feltClasses.join(' ')}">`,
    `          <p class="${transitionState.phaseChanged ? 'phase-pill is-phase-shift' : 'phase-pill'}">${escapeHtml(formatPhaseLabel(model.state.phase))}</p>`,
    '          <p class="felt-badge"><span>Main Pot</span><strong>',
    `            ${escapeHtml(chips(model.state.pot))}`,
    '          </strong></p>',
    `          <div class="seat-radar">${renderSeatRadar(model, transitionState)}</div>`,
    `          ${renderChipFlowLayer(chipFlowPlan)}`,
    `          <div class="${boardClasses.join(' ')}">${renderBoardCards(model, transitionState, boardDealPlan)}</div>`,
    '        </article>',
    `        <aside class="${turnPanelClasses}">`,
    '          <h2>Table State</h2>',
    '          <div class="turn-grid">',
    `            <p><span>Acting</span><strong>${escapeHtml(actingSeatLabel)}</strong></p>`,
    `            <p><span>Blinds</span><strong>SB ${model.state.smallBlindSeatId} / BB ${model.state.bigBlindSeatId}</strong></p>`,
    '          </div>',
    `          ${renderWinOddsPanel(model, winOddsSnapshot)}`,
    '        </aside>',
    '      </section>',
    '    </section>',
    '    <section class="play-bottom">',
    '      <div class="play-players">',
    `        ${renderPlayerHud(model, isUserTurn, transitionState, winOddsSnapshot)}`,
    `        <section class="seats-grid">${renderSeats(model, transitionState, winOddsSnapshot)}</section>`,
    '      </div>',
    `      <section class="${controlsPanelClasses}">`,
    '        <div class="controls-body">',
    '        <div class="controls-head">',
    '          <div class="controls-head-row">',
    '            <h2>Actions</h2>',
    `            <button class="cta cta-compact" data-role="next-hand">${model.state.phase === 'HAND_COMPLETE' ? 'Deal Next Hand' : 'Reset Hand'}</button>`,
    '          </div>',
    '        </div>',
    amountOption
      ? [
          '        <div class="amount-control">',
          '          <label for="action-amount">Target Bet</label>',
          `          <div class="amount-input-wrap"><input id="action-amount" data-role="action-amount" type="number" inputmode="numeric" pattern="[0-9]*" aria-label="Target bet amount" min="${amountOption.minAmount ?? 0}" max="${amountOption.maxAmount ?? amountOption.minAmount ?? 0}" step="1" value="${targetBetInputAmount}" /></div>`,
          quickAmounts.length > 0 ? `          <div class="quick-amounts">${renderQuickAmountButtons(quickAmounts)}</div>` : '',
          '        </div>',
        ].join('\n')
      : '',
    `        <div class="actions-row">${renderActionButtons(actionOptions, isUserTurn)}</div>`,
    `        ${renderPayouts(model)}`,
    '        </div>',
    '      </section>',
    '    </section>',
    '  </div>',
  ].join('\n');
}

function renderLobbyView(model: TableViewModel): string {
  const selectedTable = LOBBY_TABLES.find((table) => table.id === selectedLobbyTableId) ?? LOBBY_TABLES[0];

  return [
    '  <section class="lobby-shell">',
    '    <section class="lobby-tables-panel">',
    '      <div class="lobby-head">',
    '        <p class="eyebrow">Mobile Lobby</p>',
    '        <h2>Pick a Table</h2>',
    '        <p>Choose your table pace, then lock in a seat before entering the action.</p>',
    '      </div>',
    '      <div class="lobby-tables">',
    ...LOBBY_TABLES.map((table) => {
      const classes = table.id === selectedTable?.id ? 'lobby-table-card is-selected' : 'lobby-table-card';
      return [
        `        <button class="${classes}" data-table-id="${table.id}" type="button" aria-pressed="${table.id === selectedTable?.id ? 'true' : 'false'}">`,
        `          <strong>${escapeHtml(table.name)}</strong>`,
        `          <p>Blinds ${escapeHtml(table.stakesLabel)} · ${escapeHtml(table.paceLabel)}</p>`,
        `          <span>${escapeHtml(table.occupancyLabel)}</span>`,
        '        </button>',
      ].join('\n');
    }),
    '      </div>',
    '    </section>',
    '    <section class="lobby-seat-panel">',
    `      <h2>${escapeHtml(selectedTable?.name ?? 'Table')}</h2>`,
    `      <p class="lobby-meta">Blinds ${escapeHtml(selectedTable?.stakesLabel ?? '-')} · ${escapeHtml(selectedTable?.paceLabel ?? '-')}</p>`,
    '      <div class="lobby-seat-grid">',
    ...model.state.seats.map((seat) => {
      const classes = seat.seatId === selectedLobbySeatId ? 'lobby-seat is-selected' : 'lobby-seat';
      const seatLabel = seat.seatId === selectedLobbySeatId ? 'Your Seat' : `Seat ${seat.seatId}`;

      return [
        `        <button class="${classes}" data-seat-id="${seat.seatId}" type="button" aria-pressed="${seat.seatId === selectedLobbySeatId ? 'true' : 'false'}">`,
        `          <span>${escapeHtml(seatLabel)}</span>`,
        `          <strong>${escapeHtml(chips(seat.stack))}</strong>`,
        `          <small>${escapeHtml(seat.playerId)}</small>`,
        '        </button>',
      ].join('\n');
    }),
    '      </div>',
    `      <button class="cta lobby-enter" data-role="enter-table" type="button">Enter As Seat ${selectedLobbySeatId}</button>`,
    '    </section>',
    '  </section>',
  ].join('\n');
}

function renderMultiTableView(motionClasses: MotionClassSet, chipFlowPlan: ChipFlowAnimationPlan): string {
  const selectedTable = getSelectedMultiTableCard();
  const selectedAction = getSelectedMultiTableAction();
  const selectedTableModel = getMultiTableModel(selectedTable.id);
  const selectedUserSeatAction = getMultiTableUserSeatActionState(selectedTable.id);
  const selectedActionOption = resolveMultiTableActionOption(selectedTable.id, selectedAction.id);
  const selectedRaiseOption = resolveMultiTableActionOption(selectedTable.id, 'RAISE');
  const selectedCallOption = resolveMultiTableActionOption(selectedTable.id, 'CALL');
  const requiresBetAmount =
    selectedAction.id === 'RAISE' &&
    Boolean(selectedRaiseOption?.allowed) &&
    selectedRaiseOption?.amountSemantics === 'TARGET_BET';
  const selectedTablePendingDecisions = getTablePendingDecisionCount(selectedTable.id);
  const selectedTableIsUserActing = isTableUserActing(selectedTable.id);
  const canSubmitSelectedAction = Boolean(selectedActionOption?.allowed) && selectedTableIsUserActing;
  const totalPendingDecisions = countTotalPendingDecisions();
  const latestEventText = buildLatestMultiTableEventText(selectedTable.id);
  const selectedTablePhaseText = selectedTableModel ? formatPhaseLabel(selectedTableModel.state.phase) : 'State unavailable';
  const pendingQueueLabel =
    totalPendingDecisions > 0
      ? `${totalPendingDecisions} pending decision${totalPendingDecisions === 1 ? '' : 's'} across open tables.`
      : 'No pending decisions across tracked tables.';
  const turnStateLabel =
    selectedTableIsUserActing || selectedTablePendingDecisions > 0
      ? `On the clock at ${selectedTable.name}`
      : `Monitoring ${selectedTable.name}`;
  const feedClasses = ['multi-table-feed', motionClasses.multiFeedClass];
  if (chipFlowPlan.transfers.length > 0) {
    feedClasses.push('is-cue-chip-flow');
  }
  if (selectedTableIsUserActing || selectedTablePendingDecisions > 0) {
    feedClasses.push('is-pending');
  }
  const actionBarClasses = ['multi-table-action-bar', motionClasses.multiActionClass];
  if (selectedTableIsUserActing || selectedTablePendingDecisions > 0) {
    actionBarClasses.push('is-user-turn');
  }
  if (hasRecentMultiActionConfirmation()) {
    actionBarClasses.push('is-action-confirm');
  }
  const selectedCallAmount = selectedCallOption?.minAmount ?? selectedUserSeatAction?.toCall ?? selectedTable.callAmount;
  const raiseLabel = selectedRaiseOption?.action === 'BET' ? 'Bet' : 'Raise';
  const primaryLabel = canSubmitSelectedAction
    ? selectedAction.id === 'RAISE'
      ? `Confirm ${raiseLabel} to ${chips(multiTableState.targetBetAmount)}`
      : selectedAction.id === 'CALL'
        ? `Confirm Call ${chips(selectedCallAmount)}`
        : `Confirm ${formatActionLabel(selectedAction.id)}`
    : selectedTableIsUserActing
      ? 'Action Unavailable'
      : 'Waiting For Turn';
  const primaryActionClasses = ['multi-primary-action'];
  if (hasRecentMultiActionConfirmation(selectedAction.id)) {
    primaryActionClasses.push('is-confirmed');
  }
  const boardCards = buildMultiTableBoardCards(selectedTable.id);
  const multiTableSeats = buildMultiTableSeatStates(selectedTable.id);
  const selectedTablePot = selectedTableModel?.state.pot ?? selectedTable.avgPot;

  return [
    // Mobile-first composition: main gameplay content scrolls above a fixed bottom action bar for thumb reach.
    `  <section class="${['multi-table-shell', motionClasses.multiShellClass].filter((value) => value.length > 0).join(' ')}" aria-label="Multi-table control screen">`,
    '    <div class="multi-table-main">',
    '      <section class="multi-table-rail">',
    '        <header>',
    '          <h2>Open Tables</h2>',
    '          <p>Jump between active tables without leaving your current hand context.</p>',
    '        </header>',
    '        <div class="multi-table-rail-list" role="tablist" aria-label="Active tables">',
    ...MULTI_TABLE_CARDS.map((table) => {
      const selected = table.id === selectedTable.id;
      const tableModel = getMultiTableModel(table.id);
      const pendingDecisions = getTablePendingDecisionCount(table.id);
      const tableIsUserActing = isTableUserActing(table.id);
      const tablePot = tableModel?.state.pot ?? table.avgPot;
      const tablePendingLabel =
        tableIsUserActing
          ? 'Acting now'
          : pendingDecisions > 0
            ? `${pendingDecisions} pending`
            : 'No pending';
      const tableClasses = ['multi-table-pill'];
      if (selected) {
        tableClasses.push('is-selected');
      }
      if (pendingDecisions > 0 || tableIsUserActing) {
        tableClasses.push('is-pending');
      }
      if (tableIsUserActing) {
        tableClasses.push('is-user-turn');
      }
      return [
        `          <button class="${tableClasses.join(' ')}" data-role="multi-table-select" data-table-id="${table.id}" aria-selected="${selected ? 'true' : 'false'}" role="tab">`,
        `            <strong>${escapeHtml(table.name)}</strong>`,
        `            <span>${escapeHtml(table.stakesLabel)} · ${escapeHtml(table.occupancyLabel)}</span>`,
        `            <small>Pot ${escapeHtml(chips(tablePot))}</small>`,
        `            <p class="multi-pill-status">${escapeHtml(tablePendingLabel)}</p>`,
        '          </button>',
      ].join('\n');
    }),
    '        </div>',
    '      </section>',
    '      <section class="multi-table-stage">',
    '        <article class="multi-table-felt">',
    `          <p class="phase-pill">Table ${escapeHtml(selectedTable.name)} · ${escapeHtml(selectedTablePhaseText)}</p>`,
    `          <p class="felt-badge"><span>Live Pot</span><strong>${escapeHtml(chips(selectedTablePot))}</strong></p>`,
    `          <div class="multi-board-cards">${boardCards}</div>`,
    '          <p class="stage-note">Live Board Preview</p>',
    '          <div class="multi-seat-ring">',
    ...multiTableSeats.map((seat) => {
      const seatClasses = ['multi-seat-chip', seat.positionClass];
      if (seat.isUser) {
        seatClasses.push('is-user');
      }
      if (seat.status === 'Acting') {
        seatClasses.push('is-acting');
      }

      return [
        `            <article class="${seatClasses.join(' ')}">`,
        `              <p class="multi-seat-name">${escapeHtml(seat.playerLabel)}</p>`,
        `              <p class="multi-seat-stack">${escapeHtml(chips(seat.stack))}</p>`,
        `              <p class="multi-seat-status">${escapeHtml(seat.status)}</p>`,
        '            </article>',
      ].join('\n');
    }),
    '          </div>',
    '        </article>',
    `        <article class="${feedClasses.filter((value) => value.length > 0).join(' ')}">`,
    '          <h3>Table Activity</h3>',
    `          <p>${escapeHtml(multiTableState.activityNote)}</p>`,
    '          <ul>',
    chipFlowPlan.activityText ? `            <li>${escapeHtml(chipFlowPlan.activityText)}</li>` : '',
    latestEventText ? `            <li>${escapeHtml(latestEventText)}</li>` : '',
    `            <li>Phase: ${escapeHtml(selectedTablePhaseText)}.</li>`,
    `            <li>${escapeHtml(
      selectedTableIsUserActing
        ? 'You are currently acting at this table.'
        : selectedTablePendingDecisions > 0
          ? `${selectedTablePendingDecisions} pending decision${selectedTablePendingDecisions === 1 ? '' : 's'} on this table.`
          : 'No pending decision on this table.',
    )}</li>`,
    `            <li>${escapeHtml(pendingQueueLabel)}</li>`,
    '          </ul>',
    '        </article>',
    '      </section>',
    '    </div>',
    // Desktop keeps this dock in a sticky side rail while mobile keeps it fixed near thumb reach.
    `    <aside class="${actionBarClasses.filter((value) => value.length > 0).join(' ')}" aria-label="Table action bar">`,
    '      <div class="multi-action-head">',
    '        <h2>Action Bar</h2>',
    '        <p>Use touch on mobile or keyboard shortcuts on desktop.</p>',
    `        <p class="multi-action-turn-state" aria-live="polite">${escapeHtml(turnStateLabel)}</p>`,
    '      </div>',
    '      <div class="multi-action-list" role="toolbar" aria-label="Poker actions">',
    ...MULTI_TABLE_ACTIONS.map((option) => {
      const isSelected = option.id === selectedAction.id;
      const mappedOption = resolveMultiTableActionOption(selectedTable.id, option.id);
      const isAvailable = Boolean(mappedOption?.allowed);
      const optionLabel = option.id === 'RAISE' && mappedOption?.action === 'BET' ? 'Bet' : option.label;
      const shortcutLabel =
        option.id === 'CALL' && isAvailable && (mappedOption?.minAmount ?? 0) > 0
          ? `${chips(mappedOption?.minAmount ?? 0)} · ${option.shortcut}`
          : option.shortcut;
      const optionClasses = ['multi-action-btn', `tone-${option.tone}`];
      if (isSelected) {
        optionClasses.push('is-selected');
      }
      if (hasRecentMultiActionConfirmation(option.id)) {
        optionClasses.push('is-confirmed');
      }
      if (!isAvailable) {
        optionClasses.push('is-disabled');
      }
      return [
        `        <button class="${optionClasses.join(' ')}" data-role="multi-action-select" data-action-id="${option.id}" aria-pressed="${isSelected ? 'true' : 'false'}" aria-disabled="${isAvailable ? 'false' : 'true'}" ${isAvailable ? '' : 'disabled'}>`,
        `          <span>${escapeHtml(optionLabel)}</span>`,
        `          <small>${escapeHtml(shortcutLabel)}</small>`,
        '        </button>',
      ].join('\n');
    }),
    '      </div>',
    requiresBetAmount
      ? [
          '      <div class="multi-bet-control">',
          '        <label for="multi-bet-input">Target Bet</label>',
          `        <div class="multi-bet-fields"><input id="multi-bet-input" data-role="multi-bet-input" type="number" inputmode="numeric" min="${selectedRaiseOption?.minAmount ?? selectedTable.minRaise}" max="${selectedRaiseOption?.maxAmount ?? selectedTable.maxRaise}" step="10" value="${multiTableState.targetBetAmount}" /><input data-role="multi-bet-range" type="range" min="${selectedRaiseOption?.minAmount ?? selectedTable.minRaise}" max="${selectedRaiseOption?.maxAmount ?? selectedTable.maxRaise}" step="10" value="${multiTableState.targetBetAmount}" /></div>`,
          '        <div class="multi-bet-steps">',
          '          <button type="button" data-role="multi-bet-step" data-amount-delta="-20">-20</button>',
          '          <button type="button" data-role="multi-bet-step" data-amount-delta="20">+20</button>',
          '          <button type="button" data-role="multi-bet-step" data-amount-delta="100">+100</button>',
          '        </div>',
          '      </div>',
        ].join('\n')
      : '',
    `      <button class="${primaryActionClasses.join(' ')}" data-role="multi-action-submit" ${canSubmitSelectedAction ? '' : 'disabled'}>${escapeHtml(primaryLabel)}</button>`,
    '      <p class="multi-action-help">Desktop: Arrow keys switch actions, Enter confirms.</p>',
    '    </aside>',
    '  </section>',
  ].join('\n');
}

function renderPlayerHud(
  model: TableViewModel,
  isUserTurn: boolean,
  transitionState: PlayTransitionState,
  winOddsSnapshot: WinOddsSnapshot,
): string {
  const userSeat = model.state.seats.find((seat) => seat.seatId === model.userSeatId);
  const userActionSeat = model.actionState.seats.find((seat) => seat.seatId === model.userSeatId);
  if (!userSeat || !userActionSeat) {
    return '<section class="player-hud"><p class="muted">Your seat state is unavailable.</p></section>';
  }

  const badges = buildSeatBadges(model, userSeat.seatId);
  const metaLine = badges.length > 0 ? `Seat ${userSeat.seatId} · ${badges}` : `Seat ${userSeat.seatId}`;
  const cards = userSeat.holeCards.length > 0
    ? userSeat.holeCards.map((card) => renderCard(card.code, false)).join('')
    : `${renderCard(null, true)}${renderCard(null, true)}`;
  const userWinOdds = getSeatWinOdds(winOddsSnapshot, model.userSeatId);
  const userWinLabel = userWinOdds?.isContender ? formatWinPercentage(userWinOdds.percentage) : '--';
  const playerHudClasses = [
    'player-hud',
    transitionState.userTurnChanged && isUserTurn ? 'is-enter-turn' : '',
    transitionState.userTurnChanged && !isUserTurn ? 'is-exit-turn' : '',
  ]
    .filter((value) => value.length > 0)
    .join(' ');

  return [
    `      <section class="${playerHudClasses}">`,
    '        <header class="player-hud-head">',
    '          <div>',
    '            <h2>Your Seat</h2>',
    `            <p class="player-hud-meta">${escapeHtml(metaLine)}</p>`,
    '          </div>',
    `          <p class="${isUserTurn ? 'player-turn is-live' : 'player-turn'}">${escapeHtml(
      isUserTurn ? 'Your move' : userActionSeat.folded ? 'Folded' : 'Waiting',
    )}</p>`,
    '        </header>',
    `        <div class="player-hud-cards">${cards}</div>`,
    '        <div class="player-hud-stats">',
    `          <p><span>Stack</span><strong>${escapeHtml(chips(userSeat.stack))}</strong></p>`,
    `          <p><span>Street Bet</span><strong>${escapeHtml(chips(userSeat.currentBet))}</strong></p>`,
    `          <p><span>To Call</span><strong>${escapeHtml(chips(userActionSeat.toCall))}</strong></p>`,
    `          <p><span>Win %</span><strong>${escapeHtml(userWinLabel)}</strong></p>`,
    '        </div>',
    userWinOdds?.handLabel ? `        <p class="player-hud-actions"><span>Best Hand:</span> ${escapeHtml(userWinOdds.handLabel)}</p>` : '',
    '      </section>',
  ].join('\n');
}

function renderHowToView(): string {
  const selectedGuide = HOW_TO_GUIDES.find((guide) => guide.id === selectedGuideId) ?? HOW_TO_GUIDES[0];
  if (!selectedGuide) {
    return '<section class="howto-panel"><p>No guide content is available.</p></section>';
  }

  return [
    '<section class="howto-panel">',
    '  <div class="howto-nav">',
    ...HOW_TO_GUIDES.map((guide) => {
      const classes = guide.id === selectedGuide.id ? 'howto-tab is-active' : 'howto-tab';
      return `    <button class="${classes}" data-role="howto-guide-tab" data-guide-id="${guide.id}" aria-pressed="${guide.id === selectedGuide.id ? 'true' : 'false'}">${escapeHtml(guide.name)}</button>`;
    }),
    '  </div>',
    '  <article class="howto-card">',
    '    <p class="eyebrow">Game Rules Reference</p>',
    `    <h2>${escapeHtml(selectedGuide.title)}</h2>`,
    `    <p>${escapeHtml(selectedGuide.description)}</p>`,
    selectedGuide.cardExamples.length > 0
      ? [
          '    <section>',
          '      <h3>Hand Examples</h3>',
          `      ${renderHowToCardExamples(selectedGuide.id, selectedGuide.cardExamples)}`,
          '    </section>',
        ].join('\n')
      : '',
    '    <section>',
    '      <h3>Rounds</h3>',
    selectedGuide.rounds.length > 0
      ? `      <ol>${selectedGuide.rounds.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
      : '      <p class="muted">No round sequence listed.</p>',
    '    </section>',
    '    <section>',
    '      <h3>Rules</h3>',
    selectedGuide.rules.length > 0
      ? `      <ul>${selectedGuide.rules.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '      <p class="muted">No explicit rules list available.</p>',
    '    </section>',
    '  </article>',
    '</section>',
  ].join('\n');
}

function renderHowToCardExamples(
  guideId: string,
  examples: readonly {
    groupId: string;
    deckClass: string;
    label: string;
    items: readonly {
      kind: 'card' | 'separator';
      code?: string;
      hidden?: boolean;
      text?: string;
    }[];
    cards: readonly {
      code: string;
      hidden: boolean;
    }[];
  }[],
): string {
  const groupedExamples = groupHowToExamplesByDeckContainer(examples);

  return [
    '      <div class="howto-examples">',
    ...groupedExamples.map((group) => {
      const groupClasses = ['howto-example-group'];
      if (group.entries.length > 1) {
        groupClasses.push('is-multi');
      }

      return [
        `        <section class="${groupClasses.join(' ')}">`,
        ...group.entries.map((entry) => renderHowToExampleRow(guideId, entry.exampleIndex, entry.example)),
        '        </section>',
      ].join('\n');
    }),
    '      </div>',
  ].join('\n');
}

function groupHowToExamplesByDeckContainer(
  examples: readonly {
    groupId: string;
    deckClass: string;
    label: string;
    items: readonly {
      kind: 'card' | 'separator';
      code?: string;
      hidden?: boolean;
      text?: string;
    }[];
    cards: readonly {
      code: string;
      hidden: boolean;
    }[];
  }[],
): Array<{
  groupId: string;
  entries: Array<{
    exampleIndex: number;
    example: (typeof examples)[number];
  }>;
}> {
  const grouped: Array<{
    groupId: string;
    entries: Array<{
      exampleIndex: number;
      example: (typeof examples)[number];
    }>;
  }> = [];

  for (let index = 0; index < examples.length; index += 1) {
    const example = examples[index];
    const groupId = example.groupId.length > 0 ? example.groupId : `single-${index}`;
    const lastGroup = grouped[grouped.length - 1];
    if (lastGroup && lastGroup.groupId === groupId) {
      lastGroup.entries.push({ exampleIndex: index, example });
      continue;
    }

    grouped.push({
      groupId,
      entries: [{ exampleIndex: index, example }],
    });
  }

  return grouped;
}

function renderHowToExampleRow(
  guideId: string,
  exampleIndex: number,
  example: {
    deckClass: string;
    label: string;
    items: readonly {
      kind: 'card' | 'separator';
      code?: string;
      hidden?: boolean;
      text?: string;
    }[];
    cards: readonly {
      code: string;
      hidden: boolean;
    }[];
  },
): string {
  const rowClasses = ['howto-example-row'];
  if (example.deckClass.includes('texas-holdem-street')) {
    rowClasses.push('is-compact-street');
  }
  if (example.deckClass.includes('seven-card-stud-hole')) {
    rowClasses.push('is-stud-deck');
  }
  if (example.deckClass.includes('omaha-pocket')) {
    rowClasses.push('is-omaha-pocket');
  }

  const sequence = example.items.length > 0
    ? example.items
    : example.cards.map((card) => ({
        kind: 'card' as const,
        code: card.code,
        hidden: card.hidden,
      }));
  let cardIndex = 0;
  const renderedSequence = sequence
    .map((item) => {
      if (item.kind === 'separator') {
        return renderHowToExampleSeparator(item.text ?? '+');
      }

      if (typeof item.code !== 'string' || typeof item.hidden !== 'boolean') {
        return '';
      }

      const renderedCard = renderHowToExampleCard(guideId, exampleIndex, cardIndex, item.code, item.hidden);
      cardIndex += 1;
      return renderedCard;
    })
    .join('');

  return [
    `          <article class="${rowClasses.join(' ')}">`,
    example.label.length > 0 ? `            <p class="howto-example-label">${escapeHtml(example.label)}</p>` : '',
    `            <div class="howto-example-cards">${renderedSequence}</div>`,
    '          </article>',
  ].join('\n');
}

function renderHowToExampleSeparator(text: string): string {
  return `<span class="howto-example-separator" aria-hidden="true">${escapeHtml(text)}</span>`;
}

function renderHowToExampleCard(
  guideId: string,
  exampleIndex: number,
  cardIndex: number,
  cardCode: string,
  hidden: boolean,
): string {
  const defaultFaceUp = !hidden;
  const isFaceUp = resolveHowToCardFaceUp(guideId, exampleIndex, cardIndex, defaultFaceUp);
  const buttonClasses = ['howto-flip-card'];
  if (!isFaceUp) {
    buttonClasses.push('is-face-down');
  }

  const ariaLabel = `Toggle example card ${cardCode}`;

  return [
    `<button type="button" class="${buttonClasses.join(' ')}" data-role="howto-card-toggle" data-guide-id="${guideId}" data-example-index="${exampleIndex}" data-card-index="${cardIndex}" data-default-face-up="${defaultFaceUp ? 'true' : 'false'}" aria-label="${escapeHtml(ariaLabel)}" aria-pressed="${isFaceUp ? 'true' : 'false'}">`,
    '  <span class="howto-flip-card-inner">',
    `    <img class="howto-flip-face howto-flip-face-front" src="/assets/cards/${cardCode}.svg" alt="${escapeHtml(cardCode)}" loading="lazy" />`,
    '    <img class="howto-flip-face howto-flip-face-back" src="/assets/cards/Card_back_01.svg" alt="Card back" loading="lazy" />',
    '  </span>',
    '</button>',
  ].join('');
}

function buildHowToCardKey(guideId: string, exampleIndex: number, cardIndex: number): string {
  return `${guideId}:${exampleIndex}:${cardIndex}`;
}

function resolveHowToCardFaceUp(guideId: string, exampleIndex: number, cardIndex: number, defaultFaceUp: boolean): boolean {
  const key = buildHowToCardKey(guideId, exampleIndex, cardIndex);
  const override = howToCardFaceUpOverrides.get(key);
  return typeof override === 'boolean' ? override : defaultFaceUp;
}

function setHowToCardFaceUpOverride(
  guideId: string,
  exampleIndex: number,
  cardIndex: number,
  defaultFaceUp: boolean,
  nextFaceUp: boolean,
): void {
  const key = buildHowToCardKey(guideId, exampleIndex, cardIndex);
  if (nextFaceUp === defaultFaceUp) {
    howToCardFaceUpOverrides.delete(key);
    return;
  }

  howToCardFaceUpOverrides.set(key, nextFaceUp);
}

function applyHowToCardButtonFace(button: HTMLButtonElement, isFaceUp: boolean): void {
  button.classList.toggle('is-face-down', !isFaceUp);
  button.setAttribute('aria-pressed', isFaceUp ? 'true' : 'false');
}

function renderBoardCards(
  model: TableViewModel,
  transitionState: PlayTransitionState,
  boardDealPlan: BoardDealAnimationPlan,
): string {
  const slots: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const cardCode = model.state.board[i]?.code;
    const fallbackDeal =
      transitionState.boardAdvanced && i >= transitionState.previousBoardCount && i < transitionState.boardCount;
    const isPlannedDealt = boardDealPlan.dealtSlotIndices.includes(i);
    const isNewlyDealt = isPlannedDealt || fallbackDeal;
    const dealIndex = boardDealPlan.dealtSlotIndices.indexOf(i);
    const dealDelayMs = dealIndex >= 0 ? dealIndex * BOARD_DEAL_STAGGER_MS : 0;
    const isStreetEmphasis = boardDealPlan.streetEmphasisIndices.includes(i);
    slots.push(renderCard(cardCode ?? null, false, isNewlyDealt, dealDelayMs, isStreetEmphasis));
  }
  return slots.join('');
}

function renderSeats(model: TableViewModel, transitionState: PlayTransitionState, winOddsSnapshot: WinOddsSnapshot): string {
  const seatCards = model.state.seats.map((seat) => {
    const seatAction = model.actionState.seats.find((candidate) => candidate.seatId === seat.seatId);
    if (!seatAction) {
      return '';
    }

    return renderSeatCard(model, seat, seatAction, transitionState, winOddsSnapshot);
  });

  return seatCards.join('');
}

function renderSeatCard(
  model: TableViewModel,
  seatState: SeatState,
  actionState: SeatActionStateDTO,
  transitionState: PlayTransitionState,
  winOddsSnapshot: WinOddsSnapshot,
): string {
  const revealCards = seatState.seatId === model.userSeatId || model.state.phase === 'HAND_COMPLETE';
  const seatClasses = ['seat-card'];
  const seatWinOdds = getSeatWinOdds(winOddsSnapshot, seatState.seatId);
  const payoutAmount = seatWinOdds?.payoutAmount ?? 0;
  const isWinner = model.state.phase === 'HAND_COMPLETE' && payoutAmount > 0;

  if (actionState.isActingSeat) {
    seatClasses.push('is-acting');
  }
  if (actionState.folded) {
    seatClasses.push('is-folded');
  }
  if (actionState.allIn) {
    seatClasses.push('is-all-in');
  }
  if (transitionState.actingSeatChanged && actionState.isActingSeat) {
    seatClasses.push('is-actor-pop');
  }
  if (seatWinOdds?.isLeader && !isWinner && model.state.phase !== 'HAND_COMPLETE') {
    seatClasses.push('is-odds-leader');
  }
  if (isWinner) {
    seatClasses.push('is-winner');
  }

  const avatarId = seatAvatarById[seatState.seatId] ?? 'player_02';
  const badges = buildSeatBadges(model, seatState.seatId);
  const holeCards = seatState.holeCards.length > 0
    ? seatState.holeCards.map((card) => renderCard(revealCards ? card.code : null, !revealCards)).join('')
    : `${renderCard(null, true)}${renderCard(null, true)}`;
  const winLabel = seatWinOdds?.isContender ? formatWinPercentage(seatWinOdds.percentage) : '--';
  const winMeterWidth = seatWinOdds?.isContender ? Math.max(0, Math.min(100, seatWinOdds.percentage)) : 0;
  const winMeterBarStyle = ` style="width:${winMeterWidth.toFixed(2)}%"`;
  const outcomePill = renderSeatOutcomePill(model, seatWinOdds);

  return [
    `<article class="${seatClasses.join(' ')}">`,
    '  <header>',
    `    <div class="seat-avatar"><img src="/assets/avatars/${avatarId}.svg" alt="Seat ${seatState.seatId} avatar" loading="lazy" /></div>`,
    '    <div>',
    `      <h3>${escapeHtml(seatState.playerId)}</h3>`,
    `      <p>Seat ${seatState.seatId}</p>`,
    '    </div>',
    `    <p class="seat-badges">${escapeHtml(badges)}</p>`,
    '  </header>',
    `  <div class="hole-cards">${holeCards}</div>`,
    outcomePill.length > 0 ? `  ${outcomePill}` : '',
    '  <div class="seat-win-meter">',
    `    <p><span>Win Chance</span><strong>${escapeHtml(winLabel)}</strong></p>`,
    `    <div class="seat-win-track" aria-hidden="true"><span${winMeterBarStyle}></span></div>`,
    '  </div>',
    seatWinOdds?.handLabel ? `  <p class="seat-showdown-label">${escapeHtml(seatWinOdds.handLabel)}</p>` : '',
    '  <dl>',
    `    <div><dt>Stack</dt><dd>${chips(seatState.stack)}</dd></div>`,
    `    <div><dt>Street Bet</dt><dd>${chips(seatState.currentBet)}</dd></div>`,
    `    <div><dt>To Call</dt><dd>${chips(actionState.toCall)}</dd></div>`,
    '  </dl>',
    '</article>',
  ].join('\n');
}

function renderCard(
  cardCode: string | null,
  hidden: boolean,
  isNewlyDealt = false,
  dealDelayMs = 0,
  isStreetEmphasis = false,
): string {
  if (!cardCode && !hidden) {
    return '<div class="card-slot empty"></div>';
  }

  const src = hidden || !cardCode ? '/assets/cards/Card_back_01.svg' : `/assets/cards/${cardCode}.svg`;
  const alt = hidden || !cardCode ? 'Card back' : cardCode;
  const classes = ['card-slot'];
  if (isNewlyDealt) {
    classes.push('is-dealt');
  }
  if (isStreetEmphasis) {
    classes.push('is-street-emphasis');
  }
  const delayStyle = isNewlyDealt && dealDelayMs > 0 ? ` style="--deal-delay:${dealDelayMs}ms"` : '';
  return `<img class="${classes.join(' ')}" src="${src}" alt="${alt}"${delayStyle} />`;
}

function renderActionButtons(options: readonly ActionOptionDTO[], isUserTurn: boolean): string {
  const order: PokerAction[] = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'];
  const allowedByAction = new Map(options.map((option) => [option.action, option]));

  const buttons: string[] = [];

  for (const action of order) {
    const fallbackSemantics =
      action === 'ALL_IN' ? 'ALL_IN' : action === 'BET' || action === 'RAISE' ? 'TARGET_BET' : 'NO_AMOUNT';
    const option =
      allowedByAction.get(action) ??
      ({
        action,
        allowed: false,
        amountSemantics: fallbackSemantics,
        minAmount: null,
        maxAmount: null,
      } satisfies ActionOptionDTO);

    const bettingRange =
      option.allowed && option.amountSemantics === 'TARGET_BET'
        ? `${option.minAmount ?? 0}-${option.maxAmount ?? option.minAmount ?? 0}`
        : '';
    const buttonLabel = option.allowed ? formatActionButtonLabel(action, option) : formatActionLabel(action);
    const actionAriaLabel = bettingRange.length > 0 ? `${buttonLabel} (${bettingRange})` : buttonLabel;
    const buttonDisabled = !isUserTurn || !option.allowed;

    buttons.push(
      [
        `<button class="action-btn action-${actionTone(action)}" data-action="${action}" aria-label="${escapeHtml(actionAriaLabel)}" ${buttonDisabled ? 'disabled' : ''}>`,
        `  <span>${buttonLabel}</span>`,
        bettingRange.length > 0 ? `  <small>${bettingRange}</small>` : '',
        '</button>',
      ].join(''),
    );
  }

  if (buttons.length === 0) {
    return '<p class="muted">No actions available.</p>';
  }

  return buttons.join('');
}

function renderQuickAmountButtons(amounts: readonly number[]): string {
  return amounts
    .map(
      (amount) =>
        `<button type="button" data-set-amount="${amount}" aria-label="Set target bet to ${amount.toLocaleString()} chips">${amount.toLocaleString()}</button>`,
    )
    .join('');
}

function resolveTargetBetInputAmount(option: ActionOptionDTO | null, fallbackAmount: number): number {
  if (!option || option.amountSemantics !== 'TARGET_BET') {
    return fallbackAmount;
  }

  const min = option.minAmount ?? fallbackAmount;
  const max = option.maxAmount ?? min;
  const draftAmount = draftTargetBetAmount ?? fallbackAmount;
  return clampWholeNumberAmount(draftAmount, min, max);
}

function clampWholeNumberAmount(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  const rounded = Math.round(value);
  return Math.max(min, Math.min(max, rounded));
}

function getSelectedMultiTableCard(): MultiTableCard {
  return MULTI_TABLE_CARDS.find((table) => table.id === multiTableState.selectedTableId) ?? MULTI_TABLE_CARDS[0];
}

function getSelectedMultiTableAction(): MultiTableActionOption {
  return MULTI_TABLE_ACTIONS.find((option) => option.id === multiTableState.selectedActionId) ?? MULTI_TABLE_ACTIONS[0];
}

function getMultiTableModel(tableId: string): TableViewModel | null {
  return multiTableModelByTableId.get(tableId) ?? null;
}

function getMultiTableUserSeatActionState(tableId: string): SeatActionStateDTO | null {
  const model = getMultiTableModel(tableId);
  if (!model) {
    return null;
  }
  return model.actionState.seats.find((seat) => seat.seatId === model.userSeatId) ?? null;
}

function resolveMultiTableActionOption(tableId: string, actionId: MultiTableActionId): ActionOptionDTO | null {
  const actionState = getMultiTableUserSeatActionState(tableId);
  return resolveMultiTableActionOptionForIntent(actionState, actionId);
}

function getAvailableMultiTableActionIds(tableId: string): MultiTableActionId[] {
  return getAvailableMultiTableActionIdsFromActionState(getMultiTableUserSeatActionState(tableId));
}

function normalizeMultiTableActionSelection(): void {
  const actionState = getMultiTableUserSeatActionState(multiTableState.selectedTableId);
  multiTableState.selectedActionId = normalizeSelectedMultiTableAction(actionState, multiTableState.selectedActionId);
}

function getMultiTableRaiseBounds(tableId: string): { min: number; max: number } {
  const table = MULTI_TABLE_CARDS.find((candidate) => candidate.id === tableId);
  const fallbackMin = table?.minRaise ?? 0;
  const fallbackMax = table?.maxRaise ?? fallbackMin;
  const actionState = getMultiTableUserSeatActionState(tableId);
  return getRaiseBoundsFromActionState(actionState, fallbackMin, fallbackMax);
}

function setMultiTableBetAmount(amount: number): void {
  const bounds = getMultiTableRaiseBounds(multiTableState.selectedTableId);
  multiTableState.targetBetAmount = clampWholeNumberAmount(amount, bounds.min, bounds.max);
}

function getTablePendingDecisionCount(tableId: string): number {
  const model = getMultiTableModel(tableId);
  if (!model) {
    return 0;
  }

  return getPendingDecisionCountFromState(model.state.phase, model.state.actingSeatId, model.userSeatId);
}

function isTableUserActing(tableId: string): boolean {
  return getTablePendingDecisionCount(tableId) > 0;
}

function countTotalPendingDecisions(): number {
  return MULTI_TABLE_CARDS.reduce((total, table) => total + getTablePendingDecisionCount(table.id), 0);
}

function buildMultiTableBoardCards(tableId: string): string {
  const model = getMultiTableModel(tableId);
  const boardCodes: Array<string | null> = [];
  for (let index = 0; index < 5; index += 1) {
    boardCodes.push(model?.state.board[index]?.code ?? null);
  }

  return boardCodes.map((cardCode) => renderCard(cardCode, false)).join('');
}

function getMultiTableSeatPositionClass(seatId: number): string {
  switch (seatId) {
    case 1:
      return 'multi-seat-pos-bottom';
    case 2:
      return 'multi-seat-pos-left';
    case 3:
      return 'multi-seat-pos-top';
    case 4:
      return 'multi-seat-pos-right';
    default:
      return 'multi-seat-pos-top';
  }
}

function buildMultiTableSeatStates(tableId: string): MultiTableSeat[] {
  const model = getMultiTableModel(tableId);
  if (!model) {
    return [...MULTI_TABLE_SEATS];
  }

  return model.state.seats
    .slice()
    .sort((left, right) => left.seatId - right.seatId)
    .map((seatState) => {
      const actionState = model.actionState.seats.find((candidate) => candidate.seatId === seatState.seatId);
      const status = actionState
        ? actionState.folded
          ? 'Folded'
          : actionState.allIn
            ? 'All In'
            : actionState.isActingSeat
              ? 'Acting'
              : seatState.currentBet > 0
                ? `Bet ${seatState.currentBet}`
                : 'Waiting'
        : 'Waiting';
      const playerLabel = seatState.seatId === model.userSeatId ? 'You' : formatRadarName(seatState.playerId, seatState.seatId, model.userSeatId);

      return {
        seatId: seatState.seatId,
        playerLabel,
        stack: seatState.stack,
        status,
        positionClass: getMultiTableSeatPositionClass(seatState.seatId),
        isUser: seatState.seatId === model.userSeatId,
      };
    });
}

function buildLatestMultiTableEventText(tableId: string): string | null {
  const model = getMultiTableModel(tableId);
  if (!model) {
    return null;
  }

  const latestEventLog = [...model.logs].reverse().find((log) => log.kind === 'EVENT');
  if (!latestEventLog) {
    return null;
  }

  const parsed = parseEventLog(latestEventLog.id, latestEventLog.message);
  if (!parsed) {
    return null;
  }

  return formatMultiTableEventSummary(parsed);
}

function formatMultiTableEventSummary(event: EventLogSnapshot): string {
  const payload = toRecord(event.payload);
  const seatId = payload ? readInteger(payload, 'seatId') : null;

  switch (event.type) {
    case 'PLAYER_FOLDED':
      return seatId ? `Seat ${seatId} folded.` : 'A seat folded.';
    case 'PLAYER_CHECKED':
      return seatId ? `Seat ${seatId} checked.` : 'A seat checked.';
    case 'PLAYER_CALLED': {
      const amount = payload ? readInteger(payload, 'amount') : null;
      return seatId && amount ? `Seat ${seatId} called ${chips(amount)}.` : 'A seat called.';
    }
    case 'PLAYER_BET':
    case 'PLAYER_RAISED':
    case 'PLAYER_ALL_IN': {
      const wager = payload ? readInteger(payload, 'wager') : null;
      const actionText = event.type === 'PLAYER_BET' ? 'bet' : event.type === 'PLAYER_RAISED' ? 'raised' : 'moved all in for';
      return seatId && wager ? `Seat ${seatId} ${actionText} ${chips(wager)}.` : `A seat ${actionText}.`;
    }
    case 'DEAL_FLOP':
      return 'Flop dealt.';
    case 'DEAL_TURN':
      return 'Turn dealt.';
    case 'DEAL_RIVER':
      return 'River dealt.';
    case 'SHOWDOWN_RESOLVED':
      return 'Showdown resolved.';
    case 'HAND_WON_UNCONTESTED':
      return 'Pot awarded uncontested.';
    default:
      return `${formatTokenLabel(event.type)}.`;
  }
}

function cycleMultiTableActionSelection(offset: number): void {
  const availableActionIds = getAvailableMultiTableActionIds(multiTableState.selectedTableId);
  const actionPool = availableActionIds.length > 0 ? availableActionIds : MULTI_TABLE_ACTIONS.map((option) => option.id);
  const currentIndex = actionPool.findIndex((option) => option === multiTableState.selectedActionId);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;
  const nextIndex = (safeIndex + offset + actionPool.length) % actionPool.length;
  multiTableState.selectedActionId = actionPool[nextIndex];
}

function applyMultiTableAction(): void {
  const table = getSelectedMultiTableCard();
  const selectedAction = getSelectedMultiTableAction();
  const tableController = multiTableControllerById.get(table.id);
  const actionOption = resolveMultiTableActionOption(table.id, selectedAction.id);
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const userSeatAction = getMultiTableUserSeatActionState(table.id);
  const result = executeMultiTableAction({
    controller: tableController ?? null,
    tableName: table.name,
    selectedActionId: selectedAction.id,
    selectedActionLabel: formatActionLabel(selectedAction.id),
    actionOption,
    isUserActing: isTableUserActing(table.id),
    targetBetAmount: multiTableState.targetBetAmount,
    userStack: userSeatAction?.stack ?? null,
    timestampLabel: timestamp,
  });

  multiTableState.targetBetAmount = result.clampedTargetBetAmount;
  multiTableState.activityNote = result.activityNote;

  if (result.illegalActionRequested) {
    normalizeMultiTableActionSelection();
  }

  if (result.submitted && result.submittedActionId) {
    multiTableState.lastSubmittedActionId = result.submittedActionId;
    multiTableState.lastSubmittedAtMs = Date.now();
    queueMultiActionConfirmationReset();
  }
}

function hasRecentMultiActionConfirmation(actionId?: MultiTableActionId): boolean {
  if (!multiTableState.lastSubmittedActionId || multiTableState.lastSubmittedAtMs === null) {
    return false;
  }

  if (Date.now() - multiTableState.lastSubmittedAtMs > MULTI_ACTION_CONFIRM_MS) {
    return false;
  }

  if (!actionId) {
    return true;
  }
  return multiTableState.lastSubmittedActionId === actionId;
}

function queueMultiActionConfirmationReset(): void {
  if (multiActionConfirmTimerId !== null) {
    window.clearTimeout(multiActionConfirmTimerId);
  }

  multiActionConfirmTimerId = window.setTimeout(() => {
    multiActionConfirmTimerId = null;
    multiTableState.lastSubmittedActionId = null;
    multiTableState.lastSubmittedAtMs = null;
    if (activeView === 'multitable' && lastRenderedModel) {
      render(appRoot, lastRenderedModel);
    }
  }, MULTI_ACTION_CONFIRM_MS);
}

function isMultiTableDesktopViewport(): boolean {
  return window.matchMedia(MULTI_TABLE_DESKTOP_MEDIA_QUERY).matches;
}

function buildQuickAmountPresets(option: ActionOptionDTO | null, fallbackAmount: number, pot: number): number[] {
  if (!option || option.amountSemantics !== 'TARGET_BET') {
    return [];
  }

  const min = option.minAmount ?? fallbackAmount;
  const max = option.maxAmount ?? min;
  if (max <= min) {
    return [min];
  }

  const halfPot = Math.max(min, Math.round(pot * 0.5));
  const fullPot = Math.max(min, Math.round(pot));
  const midpoint = min + Math.floor((max - min) / 2);
  const bounded = [min, halfPot, fullPot, midpoint, max].map((amount) => Math.max(min, Math.min(max, amount)));
  return [...new Set(bounded)].sort((a, b) => a - b);
}

function renderSeatRadar(model: TableViewModel, transitionState: PlayTransitionState): string {
  return model.state.seats
    .map((seatState) => {
      const actionState = model.actionState.seats.find((seat) => seat.seatId === seatState.seatId);
      if (!actionState) {
        return '';
      }

      const classes = ['radar-seat', seatRadarPositionById[seatState.seatId] ?? 'seat-pos-top'];
      if (seatState.seatId === model.userSeatId) {
        classes.push('is-user');
      }
      if (actionState.isActingSeat) {
        classes.push('is-acting');
      }
      if (transitionState.actingSeatChanged && actionState.isActingSeat) {
        classes.push('is-actor-pop');
      }
      if (actionState.folded) {
        classes.push('is-folded');
      }
      if (actionState.allIn) {
        classes.push('is-all-in');
      }

      const status = actionState.folded
        ? 'Folded'
        : actionState.allIn
          ? 'All In'
          : actionState.isActingSeat
            ? 'Acting'
            : `Bet ${seatState.currentBet}`;

      return [
        `<article class="${classes.join(' ')}">`,
        `  <p class="radar-name">${escapeHtml(formatRadarName(seatState.playerId, seatState.seatId, model.userSeatId))}</p>`,
        `  <p class="radar-stack">${escapeHtml(chips(seatState.stack))}</p>`,
        `  <p class="radar-state">${escapeHtml(status)}</p>`,
        '</article>',
      ].join('\n');
    })
    .join('');
}

function getSeatWinOdds(snapshot: WinOddsSnapshot, seatId: number): SeatWinOdds | null {
  return snapshot.seats.find((seat) => seat.seatId === seatId) ?? null;
}

function formatWinPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function renderSeatOutcomePill(model: TableViewModel, seatWinOdds: SeatWinOdds | null): string {
  if (!seatWinOdds) {
    return '';
  }

  if (model.state.phase === 'HAND_COMPLETE') {
    if (seatWinOdds.payoutAmount > 0) {
      return `<p class="seat-outcome-pill is-winner">Winner +${escapeHtml(chips(seatWinOdds.payoutAmount))}</p>`;
    }
    return '<p class="seat-outcome-pill is-muted">No payout</p>';
  }

  if (seatWinOdds.isLeader && seatWinOdds.isContender) {
    return '<p class="seat-outcome-pill is-leader">Odds Leader</p>';
  }

  if (!seatWinOdds.isContender || seatWinOdds.isFolded) {
    return '<p class="seat-outcome-pill is-muted">Out of hand</p>';
  }

  return '';
}

function renderHandOutcomeBanner(model: TableViewModel, snapshot: WinOddsSnapshot): string {
  if (model.state.phase !== 'HAND_COMPLETE' || model.state.payouts.length === 0) {
    return '';
  }

  const winners = snapshot.seats.filter((seat) => seat.payoutAmount > 0);
  if (winners.length === 0) {
    return '';
  }

  const reasons = new Set(model.state.payouts.map((payout) => payout.reason));
  const isShowdown = reasons.has('SHOWDOWN');
  const classes = ['hand-outcome-banner', isShowdown ? 'is-showdown' : 'is-uncontested'];

  if (winners.length === 1) {
    const winner = winners[0];
    const winnerName = winner.seatId === model.userSeatId ? 'You' : winner.playerId;
    const detail = isShowdown
      ? winner.handLabel
        ? `${winnerName} wins with ${winner.handLabel}.`
        : `${winnerName} wins at showdown.`
      : `${winnerName} wins uncontested.`;
    return [
      `  <section class="${classes.join(' ')}" aria-live="polite">`,
      `    <h3>Seat ${winner.seatId} wins ${escapeHtml(chips(winner.payoutAmount))}</h3>`,
      `    <p>${escapeHtml(detail)}</p>`,
      '  </section>',
    ].join('\n');
  }

  const splitSummary = winners
    .map((winner) => {
      const label = winner.seatId === model.userSeatId ? 'You' : `Seat ${winner.seatId}`;
      const handDetail = winner.handLabel ? ` (${winner.handLabel})` : '';
      return `${label}: +${chips(winner.payoutAmount)}${handDetail}`;
    })
    .join(' · ');

  return [
    `  <section class="${classes.join(' ')}" aria-live="polite">`,
    '    <h3>Split Pot</h3>',
    `    <p>${escapeHtml(splitSummary)}</p>`,
    '  </section>',
  ].join('\n');
}

function renderWinOddsPanel(model: TableViewModel, snapshot: WinOddsSnapshot): string {
  const description =
    snapshot.mode === 'SIMULATED'
      ? `${snapshot.simulations} runouts simulated`
      : snapshot.mode === 'DETERMINISTIC'
        ? 'All community cards dealt'
        : snapshot.mode === 'PAYOUT'
          ? 'Final pot share'
          : snapshot.mode === 'SINGLE_CONTENDER'
            ? 'Single contender remains'
            : 'Waiting for dealt cards';

  return [
    '          <section class="turn-odds">',
    '            <header class="turn-odds-head">',
    '              <h3>Win Chances</h3>',
    `              <p>${escapeHtml(description)}</p>`,
    '            </header>',
    '            <div class="turn-odds-list">',
    ...snapshot.seats.map((seat) => {
      const rowClasses = ['turn-odds-row'];
      if (seat.isLeader && seat.isContender) {
        rowClasses.push('is-leader');
      }
      if (seat.payoutAmount > 0 && model.state.phase === 'HAND_COMPLETE') {
        rowClasses.push('is-winner');
      }
      if (!seat.isContender || seat.isFolded) {
        rowClasses.push('is-out');
      }

      const label = seat.seatId === model.userSeatId ? `Seat ${seat.seatId} (You)` : `Seat ${seat.seatId}`;
      const percentLabel = seat.isContender ? formatWinPercentage(seat.percentage) : '--';
      const meterWidth = seat.isContender ? Math.max(0, Math.min(100, seat.percentage)) : 0;
      const outcomeText =
        model.state.phase === 'HAND_COMPLETE'
          ? seat.payoutAmount > 0
            ? `+${chips(seat.payoutAmount)}`
            : 'No payout'
          : seat.isFolded
            ? 'Folded'
            : seat.isContender
              ? 'Live'
              : 'Out';
      return [
        `              <article class="${rowClasses.join(' ')}">`,
        '                <div class="turn-odds-meta">',
        `                  <p class="turn-odds-seat">${escapeHtml(label)}</p>`,
        `                  <p class="turn-odds-percent">${escapeHtml(percentLabel)}</p>`,
        '                </div>',
        `                <div class="turn-odds-bar" aria-hidden="true"><span style="width:${meterWidth.toFixed(2)}%"></span></div>`,
        '                <div class="turn-odds-foot">',
        `                  <span>${escapeHtml(outcomeText)}</span>`,
        seat.handLabel ? `                  <small>${escapeHtml(seat.handLabel)}</small>` : '                  <small>&nbsp;</small>',
        '                </div>',
        '              </article>',
      ].join('\n');
    }),
    '            </div>',
    '          </section>',
  ].join('\n');
}

function renderPayouts(model: TableViewModel): string {
  if (model.state.payouts.length === 0) {
    return '';
  }

  const lines = model.state.payouts.map((payout) => `Seat ${payout.seatId} +${payout.amount} (${payout.reason})`);
  return `<p class="payouts"><strong>Payouts:</strong> ${escapeHtml(lines.join(' | '))}</p>`;
}

function renderChipFlowLayer(chipFlowPlan: ChipFlowAnimationPlan): string {
  if (chipFlowPlan.transfers.length === 0) {
    return '';
  }

  return [
    '<div class="chip-flow-layer" aria-hidden="true">',
    ...chipFlowPlan.transfers.map((transfer) => renderChipTransfer(transfer)),
    '</div>',
  ].join('\n');
}

function renderChipTransfer(transfer: ChipFlowTransfer): string {
  const seatCoordinate = seatCoordinateById[transfer.seatId] ?? seatCoordinateById[1];
  const movingToPot = transfer.direction === 'TO_POT';
  const start = movingToPot ? seatCoordinate : POT_COORDINATE;
  const end = movingToPot ? POT_COORDINATE : seatCoordinate;
  const amountLabel = `${movingToPot ? '-' : '+'}${transfer.amount.toLocaleString()}`;
  const style = [
    `--chip-start-x: ${start.xPercent}%`,
    `--chip-start-y: ${start.yPercent}%`,
    `--chip-end-x: ${end.xPercent}%`,
    `--chip-end-y: ${end.yPercent}%`,
    `--chip-delay: ${transfer.delayMs}ms`,
  ].join('; ');

  return `<span class="chip-transfer ${movingToPot ? 'is-to-pot' : 'is-from-pot'}" style="${style}">${escapeHtml(amountLabel)}</span>`;
}

function renderLogs(model: TableViewModel): string {
  const logRows = [...model.logs].slice(-28).reverse();
  return logRows
    .map(
      (entry) =>
        `<li class="log-${entry.kind.toLowerCase()}"><time>${entry.timestamp}</time><span>${escapeHtml(entry.kind)}:</span><code>${escapeHtml(entry.message)}</code></li>`,
    )
    .join('');
}

function renderAuditLog(model: TableViewModel, shouldAnimateEventLog: boolean): string {
  const latestLog = model.logs.at(-1);
  const latestSummary = latestLog ? `${latestLog.kind} ${latestLog.timestamp}` : 'No entries yet';
  const auditClasses = ['audit-log'];
  if (shouldAnimateEventLog) {
    auditClasses.push('is-animate');
  }

  return [
    `  <details class="${auditClasses.join(' ')}" data-role="audit-log">`,
    `    <summary><span>Audit Log</span><small>${escapeHtml(`${model.logs.length} entries · ${latestSummary}`)}</small></summary>`,
    '    <div class="audit-log-body">',
    '      <p>Command and event timeline for audit trails and move replay checks.</p>',
    `      <ul>${renderLogs(model)}</ul>`,
    '    </div>',
    '  </details>',
  ].join('\n');
}

function resolveMotionCue(
  model: TableViewModel,
  transitionState: PlayTransitionState,
  latestEventType: string | null,
): MotionCue {
  if (transitionState.handAdvanced) {
    return 'HAND_STARTED';
  }
  if (model.state.phase === 'HAND_COMPLETE' && transitionState.phaseChanged) {
    return 'HAND_COMPLETE';
  }
  if (transitionState.boardAdvanced) {
    return 'BOARD_DEALT';
  }

  if (latestEventType?.startsWith('PLAYER_')) {
    return 'PLAYER_ACTION';
  }

  if (transitionState.actingSeatChanged || transitionState.userTurnChanged) {
    return 'TURN_CHANGED';
  }

  return 'IDLE';
}

function buildBoardDealAnimationPlan(
  transitionState: PlayTransitionState,
  latestEventType: string | null,
): BoardDealAnimationPlan {
  if (!transitionState.boardAdvanced) {
    return {
      boardClass: '',
      dealtSlotIndices: [],
      streetEmphasisIndices: [],
    };
  }

  if (latestEventType === 'DEAL_FLOP') {
    return {
      boardClass: 'is-flop-deal',
      dealtSlotIndices: [0, 1, 2],
      streetEmphasisIndices: [],
    };
  }

  if (latestEventType === 'DEAL_TURN') {
    return {
      boardClass: 'is-street-deal',
      dealtSlotIndices: [3],
      streetEmphasisIndices: [3],
    };
  }

  if (latestEventType === 'DEAL_RIVER') {
    return {
      boardClass: 'is-street-deal',
      dealtSlotIndices: [4],
      streetEmphasisIndices: [4],
    };
  }

  const dealtSlotIndices: number[] = [];
  for (let index = transitionState.previousBoardCount; index < transitionState.boardCount; index += 1) {
    if (index >= 0 && index < 5) {
      dealtSlotIndices.push(index);
    }
  }

  const streetEmphasisIndices = dealtSlotIndices.length === 1 ? [dealtSlotIndices[0]] : [];
  return {
    boardClass: dealtSlotIndices.length > 1 ? 'is-flop-deal' : dealtSlotIndices.length === 1 ? 'is-street-deal' : '',
    dealtSlotIndices,
    streetEmphasisIndices,
  };
}

function consumeFreshEventLogs(model: TableViewModel): EventLogSnapshot[] {
  const eventLogs = model.logs.filter((log) => log.kind === 'EVENT');
  if (eventLogs.length === 0) {
    lastProcessedEventLogId = null;
    return [];
  }

  const latestEventLog = eventLogs[eventLogs.length - 1];
  if (!latestEventLog) {
    return [];
  }

  if (lastProcessedEventLogId === null) {
    lastProcessedEventLogId = latestEventLog.id;
    return [];
  }

  if (latestEventLog.id < lastProcessedEventLogId) {
    lastProcessedEventLogId = latestEventLog.id;
    return [];
  }

  const processedEventLogId = lastProcessedEventLogId;
  const freshLogs = eventLogs.filter((log) => log.id > processedEventLogId);
  lastProcessedEventLogId = latestEventLog.id;
  return freshLogs
    .map((log) => parseEventLog(log.id, log.message))
    .filter((event): event is EventLogSnapshot => event !== null);
}

function parseEventLog(logId: number, message: string): EventLogSnapshot | null {
  const firstSpace = message.indexOf(' ');
  const eventType = (firstSpace >= 0 ? message.slice(0, firstSpace) : message).trim();
  if (!/^[A-Z_]+$/.test(eventType)) {
    return null;
  }

  const payloadText = firstSpace >= 0 ? message.slice(firstSpace + 1).trim() : '';
  const payload = parseEventPayload(payloadText);
  return {
    logId,
    type: eventType,
    payload,
  };
}

function parseEventPayload(payloadText: string): unknown {
  if (payloadText.length === 0 || (!payloadText.startsWith('{') && !payloadText.startsWith('['))) {
    return null;
  }

  try {
    return JSON.parse(payloadText);
  } catch {
    return null;
  }
}

function buildChipFlowAnimationPlan(model: TableViewModel, freshEvents: readonly EventLogSnapshot[]): ChipFlowAnimationPlan {
  const transfers: ChipFlowTransfer[] = [];

  for (const event of freshEvents) {
    switch (event.type) {
      case 'BLIND_POSTED': {
        const transfer = buildSeatAmountTransfer(event.payload, 'amount', 'TO_POT');
        if (transfer) {
          transfers.push(transfer);
        }
        break;
      }
      case 'PLAYER_CALLED': {
        const transfer = buildSeatAmountTransfer(event.payload, 'amount', 'TO_POT');
        if (transfer) {
          transfers.push(transfer);
        }
        break;
      }
      case 'PLAYER_BET':
      case 'PLAYER_RAISED':
      case 'PLAYER_ALL_IN': {
        const transfer = buildSeatAmountTransfer(event.payload, 'wager', 'TO_POT');
        if (transfer) {
          transfers.push(transfer);
        }
        break;
      }
      case 'HAND_WON_UNCONTESTED': {
        const transfer = buildSeatAmountTransfer(event.payload, 'amount', 'FROM_POT');
        if (transfer) {
          transfers.push(transfer);
        } else {
          transfers.push(...buildPayoutTransfers(model.state.payouts));
        }
        break;
      }
      case 'SHOWDOWN_RESOLVED': {
        const payoutTransfers = buildPayoutTransfers(model.state.payouts);
        if (payoutTransfers.length > 0) {
          transfers.push(...payoutTransfers);
        } else {
          transfers.push(...buildPayoutTransfersFromPayload(event.payload));
        }
        break;
      }
      default:
        break;
    }
  }

  const planTransfers = transfers
    .filter((transfer) => transfer.amount > 0)
    .map((transfer, index) => ({
      ...transfer,
      delayMs: index * CHIP_FLOW_STAGGER_MS,
    }));

  if (planTransfers.length === 0) {
    return {
      feltClass: '',
      transfers: [],
      activityText: null,
    };
  }

  const includesPayout = planTransfers.some((transfer) => transfer.direction === 'FROM_POT');
  const totalToPot = planTransfers
    .filter((transfer) => transfer.direction === 'TO_POT')
    .reduce((sum, transfer) => sum + transfer.amount, 0);
  const totalFromPot = planTransfers
    .filter((transfer) => transfer.direction === 'FROM_POT')
    .reduce((sum, transfer) => sum + transfer.amount, 0);
  return {
    feltClass: includesPayout ? 'is-chip-flow-collect' : 'is-chip-flow-bet',
    transfers: planTransfers,
    activityText: includesPayout
      ? `Pot settled: ${chips(totalFromPot)} returned to winning seats.`
      : `Pot pressure: ${chips(totalToPot)} moved to center.`,
  };
}

function buildSeatAmountTransfer(
  payload: unknown,
  amountKey: 'amount' | 'wager',
  direction: ChipFlowDirection,
): ChipFlowTransfer | null {
  const payloadRecord = toRecord(payload);
  if (!payloadRecord) {
    return null;
  }

  const seatId = readInteger(payloadRecord, 'seatId');
  const amount = readInteger(payloadRecord, amountKey);
  if (!seatId || !amount || amount <= 0) {
    return null;
  }

  return {
    seatId,
    amount,
    direction,
    delayMs: 0,
  };
}

function buildPayoutTransfersFromPayload(payload: unknown): ChipFlowTransfer[] {
  const payloadRecord = toRecord(payload);
  if (!payloadRecord) {
    return [];
  }

  const payouts = payloadRecord.payouts;
  if (!Array.isArray(payouts)) {
    return [];
  }

  return payouts
    .map<ChipFlowTransfer | null>((payout) => {
      const payoutRecord = toRecord(payout);
      if (!payoutRecord) {
        return null;
      }

      const seatId = readInteger(payoutRecord, 'seatId');
      const amount = readInteger(payoutRecord, 'amount');
      if (!seatId || !amount || amount <= 0) {
        return null;
      }

      return {
        seatId,
        amount,
        direction: 'FROM_POT' as const,
        delayMs: 0,
      };
    })
    .filter((transfer): transfer is ChipFlowTransfer => transfer !== null);
}

function buildPayoutTransfers(
  payouts: readonly {
    seatId: number;
    amount: number;
  }[],
): ChipFlowTransfer[] {
  return payouts
    .filter((payout) => payout.amount > 0)
    .map((payout) => ({
      seatId: payout.seatId,
      amount: payout.amount,
      direction: 'FROM_POT' as const,
      delayMs: 0,
    }));
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readInteger(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }
  return value;
}

// Centralized event-to-motion map for both play-table and multi-table screens.
function buildMotionClassSet(cue: MotionCue): MotionClassSet {
  switch (cue) {
    case 'HAND_STARTED':
      return {
        shellClass: 'is-cue-hand-started',
        playFeltClass: 'is-new-hand',
        playBoardClass: '',
        playTurnPanelClass: '',
        playControlsClass: '',
        multiShellClass: 'is-cue-hand-started',
        multiFeedClass: '',
        multiActionClass: '',
      };
    case 'BOARD_DEALT':
      return {
        shellClass: '',
        playFeltClass: '',
        playBoardClass: 'is-board-advance',
        playTurnPanelClass: '',
        playControlsClass: '',
        multiShellClass: '',
        multiFeedClass: '',
        multiActionClass: '',
      };
    case 'PLAYER_ACTION':
      return {
        shellClass: '',
        playFeltClass: '',
        playBoardClass: '',
        playTurnPanelClass: '',
        playControlsClass: 'is-flash',
        multiShellClass: '',
        multiFeedClass: 'is-cue-player-action',
        multiActionClass: '',
      };
    case 'TURN_CHANGED':
      return {
        shellClass: '',
        playFeltClass: '',
        playBoardClass: '',
        playTurnPanelClass: 'is-shift',
        playControlsClass: 'is-flash',
        multiShellClass: '',
        multiFeedClass: '',
        multiActionClass: 'is-cue-turn-changed',
      };
    case 'HAND_COMPLETE':
      return {
        shellClass: 'is-cue-hand-complete',
        playFeltClass: '',
        playBoardClass: '',
        playTurnPanelClass: '',
        playControlsClass: 'is-flash',
        multiShellClass: 'is-cue-hand-complete',
        multiFeedClass: '',
        multiActionClass: '',
      };
    case 'IDLE':
      return {
        shellClass: '',
        playFeltClass: '',
        playBoardClass: '',
        playTurnPanelClass: '',
        playControlsClass: '',
        multiShellClass: '',
        multiFeedClass: '',
        multiActionClass: '',
      };
    default: {
      const _never: never = cue;
      return _never;
    }
  }
}

function buildPlayTransitionState(model: TableViewModel, isUserTurn: boolean): PlayTransitionState {
  const boardCount = countBoardCards(model);
  const currentSnapshot: PlaySnapshot = {
    handId: model.state.handId,
    phase: model.state.phase,
    boardCount,
    actingSeatId: model.state.actingSeatId,
    isUserTurn,
  };

  if (!previousPlaySnapshot) {
    previousPlaySnapshot = currentSnapshot;
    return {
      handAdvanced: false,
      phaseChanged: false,
      boardAdvanced: false,
      actingSeatChanged: false,
      userTurnChanged: false,
      previousBoardCount: boardCount,
      boardCount,
    };
  }

  const previousSnapshot = previousPlaySnapshot;
  const handAdvanced = previousSnapshot.handId !== currentSnapshot.handId;
  const phaseChanged = previousSnapshot.phase !== currentSnapshot.phase;
  const actingSeatChanged = previousSnapshot.actingSeatId !== currentSnapshot.actingSeatId;
  const userTurnChanged = previousSnapshot.isUserTurn !== currentSnapshot.isUserTurn;
  const previousBoardCount = handAdvanced ? 0 : previousSnapshot.boardCount;
  const boardAdvanced = currentSnapshot.boardCount > previousBoardCount;

  previousPlaySnapshot = currentSnapshot;

  return {
    handAdvanced,
    phaseChanged,
    boardAdvanced,
    actingSeatChanged,
    userTurnChanged,
    previousBoardCount,
    boardCount: currentSnapshot.boardCount,
  };
}

function countBoardCards(model: TableViewModel): number {
  return model.state.board.reduce((count, card) => (card ? count + 1 : count), 0);
}

function buildSeatBadges(model: TableViewModel, seatId: number): string {
  const badges: string[] = [];

  if (seatId === model.state.buttonSeatId) {
    badges.push('BTN');
  }
  if (seatId === model.state.smallBlindSeatId) {
    badges.push('SB');
  }
  if (seatId === model.state.bigBlindSeatId) {
    badges.push('BB');
  }
  if (seatId === model.userSeatId) {
    badges.push('YOU');
  }

  return badges.join(' · ');
}

function formatPhaseLabel(phase: TablePhase): string {
  return formatTokenLabel(phase);
}

function formatTokenLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function formatActionLabel(action: PokerAction): string {
  if (action === 'ALL_IN') {
    return 'All In';
  }

  return `${action.slice(0, 1)}${action.slice(1).toLowerCase()}`;
}

function formatActionButtonLabel(action: PokerAction, option: ActionOptionDTO): string {
  if (action === 'CALL') {
    const amount = option.minAmount ?? option.maxAmount ?? 0;
    return amount > 0 ? `Call ${amount.toLocaleString()}` : 'Call';
  }

  return formatActionLabel(action);
}

function formatRadarName(playerId: string, seatId: number, userSeatId: number): string {
  if (seatId === userSeatId) {
    return 'You';
  }

  const normalized = playerId.replace('bot-', '').replaceAll('-', ' ');
  return normalized.length <= 11 ? normalized : `${normalized.slice(0, 11)}...`;
}

function actionTone(action: PokerAction): 'neutral' | 'aggressive' | 'caution' | 'danger' {
  if (action === 'FOLD') {
    return 'caution';
  }
  if (action === 'ALL_IN') {
    return 'danger';
  }
  if (action === 'BET' || action === 'RAISE') {
    return 'aggressive';
  }
  return 'neutral';
}

function isBettingPhase(phase: TablePhase): boolean {
  return phase === 'BETTING_PRE_FLOP' || phase === 'BETTING_FLOP' || phase === 'BETTING_TURN' || phase === 'BETTING_RIVER';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
