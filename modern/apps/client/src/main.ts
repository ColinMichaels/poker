import type { ActionOptionDTO, PokerAction, SeatActionStateDTO, SeatState, TablePhase } from '@poker/poker-engine';
import './styles.css';
import { HOW_TO_GUIDES } from './content/howto-content';
import { LocalTableController, type TableViewModel } from './table-controller';

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
interface LobbyTableCard {
  id: string;
  name: string;
  stakesLabel: string;
  occupancyLabel: string;
  paceLabel: string;
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

let controller: LocalTableController | null = null;
let removeControllerListener: (() => void) | null = null;
let activeView: 'lobby' | 'play' | 'howto' = 'lobby';
let selectedGuideId = HOW_TO_GUIDES[0]?.id ?? '';
let selectedLobbyTableId = LOBBY_TABLES[0]?.id ?? '';
let selectedLobbySeatId = 1;
let previousPlaySnapshot: PlaySnapshot | null = null;
let mobileActionDockExpanded = false;
const MOBILE_DOCK_SWIPE_DISTANCE = 46;
const MOBILE_DOCK_SWIPE_DISTANCE_FAST = 20;
const MOBILE_DOCK_FAST_GESTURE_MS = 220;

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

mountControllerForSeat(selectedLobbySeatId);

function mountControllerForSeat(userSeatId: number): void {
  previousPlaySnapshot = null;
  removeControllerListener?.();
  controller = new LocalTableController({ userSeatId });
  removeControllerListener = controller.subscribe((model) => {
    render(appRoot, model);
  });
}

function render(container: HTMLElement, model: TableViewModel): void {
  const userSeatAction = model.actionState.seats.find((seat) => seat.seatId === model.userSeatId);
  const isUserTurn = model.state.actingSeatId === model.userSeatId && isBettingPhase(model.state.phase);
  const allowedActions = userSeatAction?.actions.filter((option) => option.allowed) ?? [];
  const amountOption = allowedActions.find((option) => option.amountSemantics === 'TARGET_BET') ?? null;
  const defaultAmount = amountOption?.minAmount ?? 0;
  const transitionState = buildPlayTransitionState(model, isUserTurn);
  const isDesktopViewport = window.matchMedia('(min-width: 720px)').matches;
  if (!isDesktopViewport && isUserTurn) {
    mobileActionDockExpanded = true;
  }
  const dockExpanded = isDesktopViewport || mobileActionDockExpanded;
  const statusText =
    activeView === 'play'
      ? buildStatusText(model, isUserTurn)
      : activeView === 'lobby'
        ? 'Select a table and seat to begin a hand.'
      : 'Legacy HowTo content is now available in the modern client.';

  container.innerHTML = [
    '<div class="table-shell">',
    '  <header class="table-header">',
    '    <div>',
    `      <p class="eyebrow">Modernization Prototype</p>`,
    `      <h1>Texas Hold'em Local Simulation</h1>`,
    `      <p class="status-line">${escapeHtml(statusText)}</p>`,
    '    </div>',
    '    <div class="header-actions">',
    `      <button class="${activeView === 'lobby' ? 'view-tab is-active' : 'view-tab'}" data-role="view-lobby">Lobby</button>`,
    `      <button class="${activeView === 'play' ? 'view-tab is-active' : 'view-tab'}" data-role="view-play">Play Table</button>`,
    `      <button class="${activeView === 'howto' ? 'view-tab is-active' : 'view-tab'}" data-role="view-howto">How To</button>`,
    activeView === 'play'
      ? `      <button class="cta" data-role="next-hand">${model.state.phase === 'HAND_COMPLETE' ? 'Deal Next Hand' : 'Reset Hand'}</button>`
      : '',
    '    </div>',
    '  </header>',
    activeView === 'play'
      ? renderPlayView(model, allowedActions, isUserTurn, amountOption, defaultAmount, transitionState, isDesktopViewport, dockExpanded)
      : activeView === 'lobby'
        ? renderLobbyView(model)
      : renderHowToView(),
    '</div>',
  ].join('\n');

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

  const howToViewButton = container.querySelector<HTMLButtonElement>('[data-role="view-howto"]');
  howToViewButton?.addEventListener('click', () => {
    activeView = 'howto';
    render(container, model);
  });

  const guideButtons = container.querySelectorAll<HTMLButtonElement>('[data-guide-id]');
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

  if (activeView === 'play') {
    const dockToggleButton = container.querySelector<HTMLButtonElement>('[data-role="dock-toggle"]');
    let suppressDockToggleClick = false;

    dockToggleButton?.addEventListener('click', () => {
      if (suppressDockToggleClick) {
        suppressDockToggleClick = false;
        return;
      }

      mobileActionDockExpanded = !mobileActionDockExpanded;
      render(container, model);
    });
    if (dockToggleButton && !isDesktopViewport) {
      let touchStartY: number | null = null;
      let touchStartAtMs = 0;

      dockToggleButton.addEventListener(
        'touchstart',
        (event) => {
          if (event.touches.length !== 1) {
            return;
          }

          touchStartY = event.touches[0].clientY;
          touchStartAtMs = Date.now();
        },
        { passive: true },
      );

      dockToggleButton.addEventListener(
        'touchend',
        (event) => {
          if (touchStartY === null || event.changedTouches.length !== 1) {
            touchStartY = null;
            return;
          }

          const deltaY = event.changedTouches[0].clientY - touchStartY;
          const durationMs = Date.now() - touchStartAtMs;
          touchStartY = null;

          const didSwipe = applyMobileDockSwipe(deltaY, durationMs);
          if (!didSwipe) {
            return;
          }

          suppressDockToggleClick = true;
          render(container, model);
        },
        { passive: true },
      );

      dockToggleButton.addEventListener(
        'touchcancel',
        () => {
          touchStartY = null;
        },
        { passive: true },
      );
    }

    const nextHandButton = container.querySelector<HTMLButtonElement>('[data-role="next-hand"]');
    nextHandButton?.addEventListener('click', () => {
      controller?.startNextHand();
    });

    const amountInput = container.querySelector<HTMLInputElement>('[data-role="action-amount"]');
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

        amountInput.value = String(Math.round(amount));
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
          const parsedAmount = Number(amountInput?.value ?? option.minAmount ?? 0);
          const min = option.minAmount ?? parsedAmount;
          const max = option.maxAmount ?? parsedAmount;
          const clampedAmount = Math.max(min, Math.min(max, Math.round(parsedAmount)));

          if (!Number.isFinite(clampedAmount)) {
            return;
          }

          amount = clampedAmount;
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
  allowedActions: readonly ActionOptionDTO[],
  isUserTurn: boolean,
  amountOption: ActionOptionDTO | null,
  defaultAmount: number,
  transitionState: PlayTransitionState,
  isDesktopViewport: boolean,
  dockExpanded: boolean,
): string {
  const quickAmounts = buildQuickAmountPresets(amountOption, defaultAmount, model.state.pot);
  const actingSeatLabel = model.state.actingSeatId > 0 ? `Seat ${model.state.actingSeatId}` : 'No active seat';
  const metricsClass = transitionState.handAdvanced ? 'table-metrics is-refresh' : 'table-metrics';
  const feltClasses = ['felt-table'];
  if (transitionState.handAdvanced) {
    feltClasses.push('is-new-hand');
  }
  if (transitionState.phaseChanged) {
    feltClasses.push('is-phase-shift');
  }
  if (transitionState.boardAdvanced) {
    feltClasses.push('is-board-advance');
  }
  const turnPanelClasses = transitionState.actingSeatChanged ? 'turn-panel is-shift' : 'turn-panel';
  const controlsPanelClasses = [
    'controls-panel',
    isUserTurn ? 'is-live' : 'is-waiting',
    isDesktopViewport ? 'is-desktop-dock' : 'is-mobile-dock',
    dockExpanded ? 'is-dock-open' : 'is-dock-collapsed',
    transitionState.userTurnChanged ? 'is-flash' : '',
  ]
    .filter((value) => value.length > 0)
    .join(' ');
  const dockToggleClasses = ['dock-toggle', dockExpanded ? 'is-open' : '']
    .filter((value) => value.length > 0)
    .join(' ');
  const dockSummary = isUserTurn
    ? `Your turn • ${allowedActions.length} actions`
    : dockExpanded
      ? `Waiting • ${allowedActions.length} actions ready`
      : 'Swipe up for actions';

  return [
    `  <section class="${metricsClass}">`,
    metricPill('Hand', `#${model.handNumber} (${model.state.handId})`),
    metricPill('Phase', formatPhaseLabel(model.state.phase)),
    metricPill('Pot', chips(model.state.pot)),
    metricPill('Acting Seat', actingSeatLabel),
    '  </section>',
    '  <div class="play-layout">',
    '    <div class="play-main">',
    '      <section class="table-stage">',
    `        <article class="${feltClasses.join(' ')}">`,
    `          <p class="${transitionState.phaseChanged ? 'phase-pill is-phase-shift' : 'phase-pill'}">${escapeHtml(formatPhaseLabel(model.state.phase))}</p>`,
    '          <p class="felt-badge"><span>Main Pot</span><strong>',
    `            ${escapeHtml(chips(model.state.pot))}`,
    '          </strong></p>',
    `          <div class="seat-radar">${renderSeatRadar(model, transitionState)}</div>`,
    `          <div class="${transitionState.boardAdvanced ? 'board-cards is-board-advance' : 'board-cards'}">${renderBoardCards(model, transitionState)}</div>`,
    '          <p class="stage-note">Community board</p>',
    '        </article>',
    `        <aside class="${turnPanelClasses}">`,
    '          <h2>Hand Flow</h2>',
    `          <p>${escapeHtml(isUserTurn ? 'Your seat is live. Pick a legal action in the dock.' : 'Waiting for another seat to act.')}</p>`,
    '          <div class="turn-grid">',
    `            <p><span>Acting</span><strong>${escapeHtml(actingSeatLabel)}</strong></p>`,
    `            <p><span>Button</span><strong>Seat ${model.state.buttonSeatId}</strong></p>`,
    `            <p><span>Blinds</span><strong>SB ${model.state.smallBlindSeatId} / BB ${model.state.bigBlindSeatId}</strong></p>`,
    '          </div>',
    '        </aside>',
    '      </section>',
    `      ${renderPlayerHud(model, allowedActions, isUserTurn, transitionState)}`,
    `      <section class="seats-grid">${renderSeats(model, transitionState)}</section>`,
    '    </div>',
    '    <aside class="play-side">',
    `      <section class="${controlsPanelClasses}">`,
    `        <button class="${dockToggleClasses}" type="button" data-role="dock-toggle" aria-expanded="${dockExpanded ? 'true' : 'false'}">`,
    '          <span class="dock-grip" aria-hidden="true"></span>',
    `          <span class="dock-summary">${escapeHtml(dockSummary)}</span>`,
    `          <span class="dock-chevron">${dockExpanded ? 'Hide' : 'Swipe'}</span>`,
    '        </button>',
    `        <div class="${dockExpanded ? 'dock-content is-open' : 'dock-content'}">`,
    '        <div class="controls-head">',
    '          <h2>Action Dock</h2>',
    `          <p>${escapeHtml(isUserTurn ? 'Tap an action to keep the hand moving.' : 'The dock updates as soon as it is your turn.')}</p>`,
    '        </div>',
    amountOption
      ? [
          '        <div class="amount-control">',
          '          <label for="action-amount">Target Bet</label>',
          `          <div class="amount-input-wrap"><input id="action-amount" data-role="action-amount" type="number" min="${amountOption.minAmount ?? 0}" max="${amountOption.maxAmount ?? amountOption.minAmount ?? 0}" step="1" value="${defaultAmount}" /></div>`,
          quickAmounts.length > 0 ? `          <div class="quick-amounts">${renderQuickAmountButtons(quickAmounts)}</div>` : '',
          '        </div>',
        ].join('\n')
      : '',
    `        <div class="actions-row">${renderActionButtons(allowedActions, isUserTurn)}</div>`,
    `        ${renderPayouts(model)}`,
    '        </div>',
    '      </section>',
    '      <section class="event-log">',
    '        <h2>Event Log</h2>',
    `        <ul>${renderLogs(model)}</ul>`,
    '      </section>',
    '    </aside>',
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
        `        <button class="${classes}" data-table-id="${table.id}" type="button">`,
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
        `        <button class="${classes}" data-seat-id="${seat.seatId}" type="button">`,
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

function renderPlayerHud(
  model: TableViewModel,
  allowedActions: readonly ActionOptionDTO[],
  isUserTurn: boolean,
  transitionState: PlayTransitionState,
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
  const legalActions = allowedActions.length > 0
    ? allowedActions.map((option) => formatActionLabel(option.action)).join(' · ')
    : 'None';
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
    '        </div>',
    `        <p class="player-hud-actions"><span>Legal:</span> ${escapeHtml(legalActions)}</p>`,
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
      return `    <button class="${classes}" data-guide-id="${guide.id}">${escapeHtml(guide.name)}</button>`;
    }),
    '  </div>',
    '  <article class="howto-card">',
    `    <p class="eyebrow">Guide Source: ${escapeHtml(selectedGuide.sourceFile)}</p>`,
    `    <h2>${escapeHtml(selectedGuide.title)}</h2>`,
    `    <p>${escapeHtml(selectedGuide.description)}</p>`,
    '    <section>',
    '      <h3>Rounds</h3>',
    selectedGuide.rounds.length > 0
      ? `      <ol>${selectedGuide.rounds.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
      : '      <p class="muted">No round sequence listed in legacy source.</p>',
    '    </section>',
    '    <section>',
    '      <h3>Rules</h3>',
    selectedGuide.rules.length > 0
      ? `      <ul>${selectedGuide.rules.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '      <p class="muted">No explicit rules list in legacy source.</p>',
    '    </section>',
    '  </article>',
    '</section>',
  ].join('\n');
}

function renderBoardCards(model: TableViewModel, transitionState: PlayTransitionState): string {
  const slots: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const cardCode = model.state.board[i]?.code;
    const isNewlyDealt =
      transitionState.boardAdvanced && i >= transitionState.previousBoardCount && i < transitionState.boardCount;
    slots.push(renderCard(cardCode ?? null, false, isNewlyDealt));
  }
  return slots.join('');
}

function renderSeats(model: TableViewModel, transitionState: PlayTransitionState): string {
  const seatCards = model.state.seats.map((seat) => {
    const seatAction = model.actionState.seats.find((candidate) => candidate.seatId === seat.seatId);
    if (!seatAction) {
      return '';
    }

    return renderSeatCard(model, seat, seatAction, transitionState);
  });

  return seatCards.join('');
}

function renderSeatCard(
  model: TableViewModel,
  seatState: SeatState,
  actionState: SeatActionStateDTO,
  transitionState: PlayTransitionState,
): string {
  const revealCards = seatState.seatId === model.userSeatId || model.state.phase === 'HAND_COMPLETE';
  const seatClasses = ['seat-card'];

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

  const avatarId = seatAvatarById[seatState.seatId] ?? 'player_02';
  const badges = buildSeatBadges(model, seatState.seatId);
  const holeCards = seatState.holeCards.length > 0
    ? seatState.holeCards.map((card) => renderCard(revealCards ? card.code : null, !revealCards)).join('')
    : `${renderCard(null, true)}${renderCard(null, true)}`;

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
    '  <dl>',
    `    <div><dt>Stack</dt><dd>${chips(seatState.stack)}</dd></div>`,
    `    <div><dt>Street Bet</dt><dd>${chips(seatState.currentBet)}</dd></div>`,
    `    <div><dt>To Call</dt><dd>${chips(actionState.toCall)}</dd></div>`,
    '  </dl>',
    '</article>',
  ].join('\n');
}

function renderCard(cardCode: string | null, hidden: boolean, isNewlyDealt = false): string {
  if (!cardCode && !hidden) {
    return '<div class="card-slot empty"></div>';
  }

  const src = hidden || !cardCode ? '/assets/cards/Card_back_01.svg' : `/assets/cards/${cardCode}.svg`;
  const alt = hidden || !cardCode ? 'Card back' : cardCode;
  const classes = ['card-slot'];
  if (isNewlyDealt) {
    classes.push('is-dealt');
  }
  return `<img class="${classes.join(' ')}" src="${src}" alt="${alt}" />`;
}

function renderActionButtons(options: readonly ActionOptionDTO[], isUserTurn: boolean): string {
  const order: PokerAction[] = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'];
  const allowedByAction = new Map(options.map((option) => [option.action, option]));

  const buttons: string[] = [];

  for (const action of order) {
    const option = allowedByAction.get(action);
    if (!option || !option.allowed) {
      continue;
    }

    const bettingRange =
      option.amountSemantics === 'TARGET_BET'
        ? `${option.minAmount ?? 0}-${option.maxAmount ?? option.minAmount ?? 0}`
        : '';

    buttons.push(
      [
        `<button class="action-btn action-${actionTone(action)}" data-action="${action}" ${isUserTurn ? '' : 'disabled'}>`,
        `  <span>${formatActionButtonLabel(action, option)}</span>`,
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
    .map((amount) => `<button type="button" data-set-amount="${amount}">${amount.toLocaleString()}</button>`)
    .join('');
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

function renderPayouts(model: TableViewModel): string {
  if (model.state.payouts.length === 0) {
    return '';
  }

  const lines = model.state.payouts.map((payout) => `Seat ${payout.seatId} +${payout.amount} (${payout.reason})`);
  return `<p class="payouts"><strong>Payouts:</strong> ${escapeHtml(lines.join(' | '))}</p>`;
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

function buildStatusText(model: TableViewModel, isUserTurn: boolean): string {
  if (model.state.phase === 'HAND_COMPLETE') {
    if (model.state.payouts.length === 0) {
      return 'Hand complete. No payouts recorded.';
    }
    const winners = model.state.payouts.map((payout) => `Seat ${payout.seatId} (+${payout.amount})`).join(', ');
    return `Hand complete. Winners: ${winners}.`;
  }

  if (isUserTurn) {
    return `Seat ${model.userSeatId} to act. Pot: ${model.state.pot}.`;
  }

  if (isBettingPhase(model.state.phase)) {
    return `Seat ${model.state.actingSeatId} is acting.`;
  }

  if (model.state.phase.startsWith('DEAL_')) {
    return 'Auto-dealing next street.';
  }

  return 'Simulation is running.';
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

function applyMobileDockSwipe(deltaY: number, durationMs: number): boolean {
  const isFastGesture = durationMs <= MOBILE_DOCK_FAST_GESTURE_MS;
  const threshold = isFastGesture ? MOBILE_DOCK_SWIPE_DISTANCE_FAST : MOBILE_DOCK_SWIPE_DISTANCE;

  if (Math.abs(deltaY) < threshold) {
    return false;
  }

  if (deltaY < 0 && !mobileActionDockExpanded) {
    mobileActionDockExpanded = true;
    return true;
  }

  if (deltaY > 0 && mobileActionDockExpanded) {
    mobileActionDockExpanded = false;
    return true;
  }

  return false;
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
  return phase
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
