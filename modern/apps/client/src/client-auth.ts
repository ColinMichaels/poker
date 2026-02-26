import { createExternalAuthSessionBridge, type ExternalAuthSessionBridge } from './auth/external-auth-session-bridge.ts';
import { createFirebaseWebIdTokenProvider } from './auth/firebase-web-id-token-provider.ts';
import { loadClientRuntimeConfig, type ClientRuntimeConfig } from './client-runtime-config.ts';

function joinBaseUrlAndPath(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim();
  if (!normalizedBase) {
    return path;
  }
  return `${normalizedBase}${path}`;
}

function createTokenProvider(config: ClientRuntimeConfig) {
  if (config.externalAuthMode !== 'firebase_id_token') {
    return null;
  }
  if (!config.firebase) {
    return null;
  }
  return createFirebaseWebIdTokenProvider({
    config: config.firebase,
  });
}

export function createClientAuthBridge(config: ClientRuntimeConfig = loadClientRuntimeConfig()): ExternalAuthSessionBridge {
  return createExternalAuthSessionBridge({
    loginUrl: joinBaseUrlAndPath(config.apiBaseUrl, config.externalAuthLoginPath),
    tokenProvider: createTokenProvider(config),
  });
}
