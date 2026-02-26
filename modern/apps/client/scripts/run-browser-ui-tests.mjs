import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const STARTUP_TIMEOUT_MS = 20_000;
const PAGE_TIMEOUT_MS = 12_000;
const PROJECT_DIR = fileURLToPath(new URL('..', import.meta.url));
const VITE_BIN = fileURLToPath(new URL('../../../node_modules/vite/bin/vite.js', import.meta.url));
const DIST_INDEX = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const BROWSER_UI_REQUIRED = process.env.BROWSER_UI_REQUIRED === '1';
const HOST = process.env.BROWSER_UI_HOST ?? '127.0.0.1';
const PREVIEW_PORT = parsePositiveInteger(process.env.BROWSER_UI_PREVIEW_PORT, 4173, 'BROWSER_UI_PREVIEW_PORT');
const DEBUG_PORT = parsePositiveInteger(process.env.BROWSER_UI_DEBUG_PORT, 9222, 'BROWSER_UI_DEBUG_PORT');

function parsePositiveInteger(rawValue, fallback, envName) {
  if (rawValue === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${envName} value "${rawValue}". Expected a positive integer.`);
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findChromeBinary() {
  const fromEnv = process.env.BROWSER_UI_CHROME_BIN;
  if (typeof fromEnv === 'string' && fromEnv.length > 0 && existsSync(fromEnv)) {
    return fromEnv;
  }

  const absoluteCandidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const candidate of absoluteCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const commandCandidates = ['google-chrome', 'chromium-browser', 'chromium', 'chrome'];
  for (const command of commandCandidates) {
    const probe = spawnSync('which', [command], { encoding: 'utf8' });
    if (probe.status === 0) {
      const resolved = probe.stdout.trim();
      if (resolved.length > 0) {
        return resolved;
      }
    }
  }

  return null;
}

async function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function getJson(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Endpoint not ready yet.
    }
    await sleep(120);
  }
  throw new Error(`Timed out waiting for JSON endpoint ${url}.`);
}

function terminateProcess(child, label) {
  if (!child || child.killed) {
    return;
  }
  try {
    child.kill('SIGTERM');
  } catch (error) {
    console.warn(`[browser-ui] Failed to terminate ${label}:`, error);
  }
}

function attachProcessOutput(prefix, child) {
  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[${prefix}] ${chunk}`);
  });
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[${prefix}] ${chunk}`);
  });
}

async function createPageWebSocketUrl(targetUrl) {
  const endpoint = `http://${HOST}:${DEBUG_PORT}/json/new?${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(endpoint, { method: 'PUT' });
    if (response.ok) {
      const payload = await response.json();
      if (payload?.webSocketDebuggerUrl) {
        return payload.webSocketDebuggerUrl;
      }
    }
  } catch {
    // Fall through to GET fallback.
  }

  const fallback = await fetch(endpoint, { method: 'GET' });
  if (!fallback.ok) {
    throw new Error(`Unable to create browser page target (${fallback.status}).`);
  }
  const payload = await fallback.json();
  if (!payload?.webSocketDebuggerUrl) {
    throw new Error('Created browser target did not return a websocket debugger URL.');
  }
  return payload.webSocketDebuggerUrl;
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to browser websocket.')), STARTUP_TIMEOUT_MS);
      this.ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.addEventListener('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    this.ws.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data));
      if (typeof payload.id !== 'number') {
        return;
      }

      const pending = this.pending.get(payload.id);
      if (!pending) {
        return;
      }

      this.pending.delete(payload.id);
      if (payload.error) {
        pending.reject(new Error(payload.error.message ?? 'Unknown CDP error.'));
        return;
      }
      pending.resolve(payload.result ?? {});
    });
  }

  async send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });

    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) {
          return;
        }
        this.pending.delete(id);
        reject(new Error(`CDP command timeout: ${method}`));
      }, PAGE_TIMEOUT_MS);
    });

    this.ws.send(payload);
    return await result;
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (response.exceptionDetails) {
      const description = response.exceptionDetails.text ?? 'Runtime evaluation failed.';
      throw new Error(description);
    }
    return response.result?.value;
  }

  close() {
    this.ws.close();
  }
}

function assertCondition(condition, message, details) {
  if (condition) {
    return;
  }
  throw new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
}

async function waitForAppReady(cdpClient) {
  const start = Date.now();
  while (Date.now() - start < STARTUP_TIMEOUT_MS) {
    try {
      const ready = await cdpClient.evaluate(`Boolean(document.querySelector('[data-role="view-multitable"]'))`);
      if (ready) {
        return;
      }
    } catch {
      // Wait for runtime availability.
    }
    await sleep(120);
  }
  throw new Error('Timed out waiting for app shell controls.');
}

async function setViewport(cdpClient, viewport) {
  await cdpClient.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await cdpClient.send('Emulation.setTouchEmulationEnabled', {
    enabled: viewport.mobile,
    maxTouchPoints: viewport.mobile ? 5 : 0,
  });
}

async function run() {
  if (!existsSync(VITE_BIN)) {
    throw new Error(`Unable to resolve Vite binary at "${VITE_BIN}". Run npm install from modern/.`);
  }
  if (!existsSync(DIST_INDEX)) {
    throw new Error(`Missing client build output at "${DIST_INDEX}". Run npm run build --workspace @poker/client before browser UI tests.`);
  }

  const chromeBinary = findChromeBinary();
  if (!chromeBinary) {
    if (BROWSER_UI_REQUIRED) {
      throw new Error(
        'Browser UI tests require Chrome/Chromium in this environment. Set BROWSER_UI_CHROME_BIN or install google-chrome/chromium.',
      );
    }
    console.log('[browser-ui] Skipping browser UI tests: no Chrome/Chromium binary found.');
    return;
  }

  const preview = spawn(process.execPath, [VITE_BIN, 'preview', '--host', HOST, '--port', String(PREVIEW_PORT)], {
    cwd: PROJECT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  attachProcessOutput('preview', preview);

  const userDataDir = mkdtempSync(join(tmpdir(), 'poker-browser-ui-'));
  const chrome = spawn(
    chromeBinary,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--window-size=1280,800',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  attachProcessOutput('chrome', chrome);

  let cdpClient = null;
  try {
    const previewUrl = `http://${HOST}:${PREVIEW_PORT}/`;
    await waitForHttp(previewUrl, STARTUP_TIMEOUT_MS);
    await getJson(`http://${HOST}:${DEBUG_PORT}/json/version`, STARTUP_TIMEOUT_MS);

    const wsUrl = await createPageWebSocketUrl(previewUrl);
    cdpClient = new CdpClient(wsUrl);
    await cdpClient.connect();
    await cdpClient.send('Page.enable');
    await cdpClient.send('Runtime.enable');
    await waitForAppReady(cdpClient);

    const lobbyFlow = await cdpClient.evaluate(`
      (async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const seatButton = document.querySelector('[data-seat-id="3"]');
        const enterButton = document.querySelector('[data-role="enter-table"]');
        if (!seatButton || !enterButton) {
          return { ok: false, reason: 'missing-lobby-controls' };
        }

        seatButton.click();
        await sleep(80);
        const updatedEnterButton = document.querySelector('[data-role="enter-table"]');
        if (!updatedEnterButton) {
          return { ok: false, reason: 'missing-updated-enter-button' };
        }
        const enterLabel = updatedEnterButton.textContent?.trim() ?? '';
        const enterHeight = updatedEnterButton.getBoundingClientRect().height;
        updatedEnterButton.click();
        await sleep(120);

        const playLayoutPresent = Boolean(document.querySelector('.play-layout'));
        const actionHeights = Array.from(document.querySelectorAll('.actions-row .action-btn')).map((button) => button.getBoundingClientRect().height);
        const minActionHeight = actionHeights.length > 0 ? Math.min(...actionHeights) : 0;
        const oddsRows = Array.from(document.querySelectorAll('.turn-odds-row'));
        const hasOddsPercent = oddsRows.some((row) => /%/.test(row.querySelector('.turn-odds-percent')?.textContent ?? ''));
        const auditLog = document.querySelector('[data-role="audit-log"]');
        const auditLogPresent = Boolean(auditLog);
        const auditLogCollapsed = auditLog ? !auditLog.hasAttribute('open') : false;
        return {
          ok:
            playLayoutPresent &&
            /Seat\\s3/.test(enterLabel) &&
            enterHeight >= 44 &&
            minActionHeight >= 44 &&
            oddsRows.length >= 2 &&
            hasOddsPercent &&
            auditLogPresent &&
            auditLogCollapsed,
          enterLabel,
          enterHeight,
          playLayoutPresent,
          actionButtonCount: actionHeights.length,
          minActionHeight,
          oddsRowCount: oddsRows.length,
          hasOddsPercent,
          auditLogPresent,
          auditLogCollapsed,
        };
      })()
    `);

    assertCondition(Boolean(lobbyFlow?.ok), 'Lobby flow and touch-target assertions failed.', lobbyFlow);

    const baseline = await cdpClient.evaluate(`
      (() => {
        const viewButton = document.querySelector('[data-role="view-multitable"]');
        if (!viewButton) {
          return { ok: false, reason: 'missing-view-button' };
        }

        viewButton.click();
        const actingPill = document.querySelector('.multi-table-pill.is-user-turn');
        if (actingPill) {
          actingPill.click();
        }

        const shellPresent = Boolean(document.querySelector('.multi-table-shell'));
        const submit = document.querySelector('[data-role="multi-action-submit"]');
        const turnText = document.querySelector('.multi-action-turn-state')?.textContent?.trim() ?? '';
        const actionButtons = Array.from(document.querySelectorAll('[data-role="multi-action-select"]')).map((button) => ({
          actionId: button.getAttribute('data-action-id'),
          disabled: button.hasAttribute('disabled'),
          classDisabled: button.classList.contains('is-disabled'),
          ariaDisabled: button.getAttribute('aria-disabled'),
        }));
        const enabledCount = actionButtons.filter((button) => !button.disabled).length;
        const disabledStateAligned = actionButtons.every(
          (button) => button.disabled === button.classDisabled && (button.disabled ? button.ariaDisabled === 'true' : button.ariaDisabled === 'false'),
        );
        const submitDisabled = submit ? submit.hasAttribute('disabled') : null;
        const submitAligned = turnText.includes('On the clock') ? submitDisabled === false : submitDisabled === true;
        return {
          ok: shellPresent && enabledCount > 0 && disabledStateAligned && submitAligned,
          shellPresent,
          enabledCount,
          disabledStateAligned,
          submitAligned,
          submitDisabled,
          turnText,
          actionButtons,
        };
      })()
    `);

    assertCondition(Boolean(baseline?.ok), 'Multi-table baseline UI assertions failed.', baseline);

    const keyboardSubmit = await cdpClient.evaluate(`
      (async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const viewButton = document.querySelector('[data-role="view-multitable"]');
        if (!viewButton) {
          return { ok: false, reason: 'missing-view-button' };
        }
        viewButton.click();

        for (let index = 0; index < 20; index += 1) {
          const actingPill = document.querySelector('.multi-table-pill.is-user-turn');
          if (actingPill) {
            actingPill.click();
            break;
          }
          await sleep(50);
        }

        await sleep(80);
        const turnText = document.querySelector('.multi-action-turn-state')?.textContent?.trim() ?? '';
        const enabledButtons = Array.from(document.querySelectorAll('[data-role="multi-action-select"]')).filter(
          (button) => !button.hasAttribute('disabled'),
        );
        if (enabledButtons.length === 0) {
          return { ok: false, reason: 'no-enabled-buttons', turnText };
        }

        enabledButtons[0].click();
        const before = document.querySelector('.multi-table-feed p')?.textContent ?? '';
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await sleep(120);
        const after = document.querySelector('.multi-table-feed p')?.textContent ?? '';

        return {
          ok: after !== before && /You\\s/.test(after),
          before,
          after,
          turnText,
        };
      })()
    `);

    assertCondition(Boolean(keyboardSubmit?.ok), 'Multi-table keyboard submit assertions failed.', keyboardSubmit);

    const howToFlip = await cdpClient.evaluate(`
      (async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const howToViewButton = document.querySelector('[data-role="view-howto"]');
        if (!howToViewButton) {
          return { ok: false, reason: 'missing-howto-view-button' };
        }
        howToViewButton.click();
        await sleep(80);

        const cardButton = document.querySelector('[data-role="howto-card-toggle"]');
        if (!cardButton) {
          return { ok: false, reason: 'missing-howto-card-toggle' };
        }

        const beforePressed = cardButton.getAttribute('aria-pressed');
        const beforeFaceDown = cardButton.classList.contains('is-face-down');
        cardButton.click();
        await sleep(60);

        const afterPressed = cardButton.getAttribute('aria-pressed');
        const afterFaceDown = cardButton.classList.contains('is-face-down');
        cardButton.click();
        await sleep(60);

        const restoredPressed = cardButton.getAttribute('aria-pressed');
        const restoredFaceDown = cardButton.classList.contains('is-face-down');
        return {
          ok:
            beforePressed !== afterPressed &&
            beforeFaceDown !== afterFaceDown &&
            restoredPressed === beforePressed &&
            restoredFaceDown === beforeFaceDown,
          beforePressed,
          afterPressed,
          restoredPressed,
          beforeFaceDown,
          afterFaceDown,
          restoredFaceDown,
        };
      })()
    `);

    assertCondition(Boolean(howToFlip?.ok), 'How To flip-card interaction assertions failed.', howToFlip);

    await setViewport(cdpClient, {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdpClient.send('Page.reload', { ignoreCache: true });
    await waitForAppReady(cdpClient);

    const mobileReachability = await cdpClient.evaluate(`
      (async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const lobbyEnterButton = document.querySelector('[data-role="enter-table"]');
        const lobbyEnterHeight = lobbyEnterButton?.getBoundingClientRect().height ?? 0;

        const multiViewButton = document.querySelector('[data-role="view-multitable"]');
        if (!multiViewButton) {
          return { ok: false, reason: 'missing-view-button' };
        }
        multiViewButton.click();

        for (let index = 0; index < 20; index += 1) {
          const actingPill = document.querySelector('.multi-table-pill.is-user-turn');
          if (actingPill) {
            actingPill.click();
            break;
          }
          await sleep(50);
        }
        await sleep(100);

        const actionBar = document.querySelector('.multi-table-action-bar');
        const submitButton = document.querySelector('[data-role="multi-action-submit"]');
        const actionButtons = Array.from(document.querySelectorAll('[data-role="multi-action-select"]'));
        if (!actionBar || !submitButton || actionButtons.length === 0) {
          return {
            ok: false,
            reason: 'missing-mobile-action-controls',
            actionBar: Boolean(actionBar),
            submitButton: Boolean(submitButton),
            actionButtons: actionButtons.length,
          };
        }

        const actionBarRect = actionBar.getBoundingClientRect();
        const submitRect = submitButton.getBoundingClientRect();
        const minActionHeight = actionButtons.reduce((minimum, button) => {
          const nextHeight = button.getBoundingClientRect().height;
          return Math.min(minimum, nextHeight);
        }, Number.POSITIVE_INFINITY);
        const computedPosition = getComputedStyle(actionBar).position;
        const viewportHeight = window.innerHeight;
        const bottomGap = viewportHeight - actionBarRect.bottom;
        const actionBarInLowerHalf = actionBarRect.top >= viewportHeight * 0.45;
        const thumbZoneTop = viewportHeight * 0.62;
        const submitInThumbZone = submitRect.bottom >= thumbZoneTop;
        const hasLargeTargets = lobbyEnterHeight >= 44 && submitRect.height >= 44 && minActionHeight >= 44;

        return {
          ok:
            computedPosition === 'fixed' &&
            actionBarInLowerHalf &&
            bottomGap >= -2 &&
            bottomGap <= 96 &&
            submitInThumbZone &&
            hasLargeTargets,
          computedPosition,
          bottomGap,
          actionBarTop: actionBarRect.top,
          viewportHeight,
          submitTop: submitRect.top,
          submitBottom: submitRect.bottom,
          thumbZoneTop,
          lobbyEnterHeight,
          submitHeight: submitRect.height,
          minActionHeight,
          actionBarInLowerHalf,
          submitInThumbZone,
        };
      })()
    `);

    assertCondition(Boolean(mobileReachability?.ok), 'Mobile action-bar reachability assertions failed.', mobileReachability);
    console.log('[browser-ui] Browser UI tests passed.');
  } finally {
    try {
      cdpClient?.close();
    } catch {
      // ignore
    }
    terminateProcess(chrome, 'chrome');
    terminateProcess(preview, 'preview');
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

run().catch((error) => {
  console.error('[browser-ui] Browser UI tests failed.');
  console.error(error);
  process.exitCode = 1;
});
