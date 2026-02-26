import { describe, expect, it } from 'vitest';
import { loadClientRuntimeConfig } from '../src/client-runtime-config.ts';

function createEnv(overrides: Partial<ImportMetaEnv> = {}): ImportMetaEnv {
  return {
    DEV: false,
    PROD: true,
    SSR: false,
    BASE_URL: '/',
    MODE: 'test',
    ...overrides,
  } as ImportMetaEnv;
}

describe('client runtime config', () => {
  it('defaults external auth mode to disabled when firebase config is absent', () => {
    const config = loadClientRuntimeConfig(createEnv());
    expect(config.externalAuthMode).toBe('disabled');
    expect(config.tableRuntimeMode).toBe('local');
    expect(config.tablePollIntervalMs).toBe(900);
    expect(config.firebase).toBeNull();
  });

  it('auto-enables firebase external auth mode when firebase config is complete', () => {
    const config = loadClientRuntimeConfig(
      createEnv({
        VITE_FIREBASE_API_KEY: 'key',
        VITE_FIREBASE_AUTH_DOMAIN: 'auth.domain',
        VITE_FIREBASE_PROJECT_ID: 'project-id',
        VITE_FIREBASE_APP_ID: 'app-id',
      }),
    );

    expect(config.externalAuthMode).toBe('firebase_id_token');
    expect(config.firebase?.projectId).toBe('project-id');
  });

  it('keeps external auth disabled when mode is explicitly disabled', () => {
    const config = loadClientRuntimeConfig(
      createEnv({
        VITE_EXTERNAL_AUTH_MODE: 'disabled',
        VITE_FIREBASE_API_KEY: 'key',
        VITE_FIREBASE_AUTH_DOMAIN: 'auth.domain',
        VITE_FIREBASE_PROJECT_ID: 'project-id',
        VITE_FIREBASE_APP_ID: 'app-id',
      }),
    );

    expect(config.externalAuthMode).toBe('disabled');
    expect(config.firebase?.projectId).toBe('project-id');
  });

  it('normalizes api base url and login path', () => {
    const config = loadClientRuntimeConfig(
      createEnv({
        VITE_API_BASE_URL: 'https://example.com/',
        VITE_EXTERNAL_AUTH_LOGIN_PATH: 'api/auth/external/login',
      }),
    );

    expect(config.apiBaseUrl).toBe('https://example.com');
    expect(config.externalAuthLoginPath).toBe('/api/auth/external/login');
  });

  it('parses table runtime env values', () => {
    const config = loadClientRuntimeConfig(
      createEnv({
        VITE_TABLE_RUNTIME_MODE: 'server',
        VITE_TABLE_POLL_INTERVAL_MS: '1400',
      }),
    );

    expect(config.tableRuntimeMode).toBe('server');
    expect(config.tablePollIntervalMs).toBe(1400);
  });
});
