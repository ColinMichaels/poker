import type { ActionOptionDTO, PokerAction, SeatActionStateDTO, SeatState, TablePhase } from '@poker/poker-engine';
import './styles.css';
import { HOW_TO_GUIDES } from './content/howto-content';
import { LocalTableController, type TableViewModel } from './table-controller';

const root = document.getElementById('app');

if (!root) {
  throw new Error('App root #app was not found.');
}

const seatAvatarById: Record<number, string> = {
  1: 'player_02',
  2: 'nikola-tesla',
  3: 'robot-01',
  4: 'dave-grohl',
};

const controller = new LocalTableController({ userSeatId: 1 });
let activeView: 'play' | 'howto' = 'play';
let selectedGuideId = HOW_TO_GUIDES[0]?.id ?? '';

controller.subscribe((model) => {
  render(root, model);
});

function render(container: HTMLElement, model: TableViewModel): void {
  const userSeatAction = model.actionState.seats.find((seat) => seat.seatId === model.userSeatId);
  const isUserTurn = model.state.actingSeatId === model.userSeatId && isBettingPhase(model.state.phase);
  const allowedActions = userSeatAction?.actions.filter((option) => option.allowed) ?? [];
  const amountOption = allowedActions.find((option) => option.amountSemantics === 'TARGET_BET') ?? null;
  const defaultAmount = amountOption?.minAmount ?? 0;
  const statusText =
    activeView === 'play'
      ? buildStatusText(model, isUserTurn)
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
    `      <button class="${activeView === 'play' ? 'view-tab is-active' : 'view-tab'}" data-role="view-play">Play Table</button>`,
    `      <button class="${activeView === 'howto' ? 'view-tab is-active' : 'view-tab'}" data-role="view-howto">How To</button>`,
    activeView === 'play'
      ? `      <button class="cta" data-role="next-hand">${model.state.phase === 'HAND_COMPLETE' ? 'Deal Next Hand' : 'Reset Hand'}</button>`
      : '',
    '    </div>',
    '  </header>',
    activeView === 'play'
      ? renderPlayView(model, allowedActions, isUserTurn, amountOption, defaultAmount)
      : renderHowToView(),
    '</div>',
  ].join('\n');

  const playViewButton = container.querySelector<HTMLButtonElement>('[data-role="view-play"]');
  playViewButton?.addEventListener('click', () => {
    activeView = 'play';
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
    const nextHandButton = container.querySelector<HTMLButtonElement>('[data-role="next-hand"]');
    nextHandButton?.addEventListener('click', () => {
      controller.startNextHand();
    });

    const amountInput = container.querySelector<HTMLInputElement>('[data-role="action-amount"]');

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

        controller.performUserAction({ action, amount });
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
): string {
  return [
    '  <section class="table-metrics">',
    metricPill('Hand', `#${model.handNumber} (${model.state.handId})`),
    metricPill('Phase', model.state.phase),
    metricPill('Pot', chips(model.state.pot)),
    metricPill('Acting Seat', model.state.actingSeatId > 0 ? String(model.state.actingSeatId) : '-'),
    '  </section>',
    '  <section class="board-wrap">',
    '    <h2>Board</h2>',
    `    <div class="board-cards">${renderBoardCards(model)}</div>`,
    '  </section>',
    `  <section class="seats-grid">${renderSeats(model)}</section>`,
    '  <section class="controls-panel">',
    '    <h2>Actions</h2>',
    `    <p>${escapeHtml(isUserTurn ? 'Your turn. Choose a legal action.' : 'Waiting for bot actions or next hand.')}</p>`,
    amountOption
      ? `    <label class="amount-control">Target Bet <input data-role="action-amount" type="number" min="${amountOption.minAmount ?? 0}" max="${amountOption.maxAmount ?? amountOption.minAmount ?? 0}" step="1" value="${defaultAmount}" /></label>`
      : '',
    `    <div class="actions-row">${renderActionButtons(allowedActions, isUserTurn)}</div>`,
    `    ${renderPayouts(model)}`,
    '  </section>',
    '  <section class="event-log">',
    '    <h2>Event Log</h2>',
    `    <ul>${renderLogs(model)}</ul>`,
    '  </section>',
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

function renderBoardCards(model: TableViewModel): string {
  const slots: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const cardCode = model.state.board[i]?.code;
    slots.push(renderCard(cardCode ?? null, false));
  }
  return slots.join('');
}

function renderSeats(model: TableViewModel): string {
  const seatCards = model.state.seats.map((seat) => {
    const seatAction = model.actionState.seats.find((candidate) => candidate.seatId === seat.seatId);
    if (!seatAction) {
      return '';
    }

    return renderSeatCard(model, seat, seatAction);
  });

  return seatCards.join('');
}

function renderSeatCard(model: TableViewModel, seatState: SeatState, actionState: SeatActionStateDTO): string {
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

function renderCard(cardCode: string | null, hidden: boolean): string {
  if (!cardCode && !hidden) {
    return '<div class="card-slot empty"></div>';
  }

  const src = hidden || !cardCode ? '/assets/cards/Card_back_01.svg' : `/assets/cards/${cardCode}.svg`;
  const alt = hidden || !cardCode ? 'Card back' : cardCode;
  return `<img class="card-slot" src="${src}" alt="${alt}" />`;
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

    const suffix =
      option.amountSemantics === 'TARGET_BET'
        ? ` (${option.minAmount ?? 0}-${option.maxAmount ?? option.minAmount ?? 0})`
        : '';

    buttons.push(
      `<button data-action="${action}" ${isUserTurn ? '' : 'disabled'}>${action}${suffix}</button>`,
    );
  }

  if (buttons.length === 0) {
    return '<p class="muted">No actions available.</p>';
  }

  return buttons.join('');
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
