/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_EXTERNAL_AUTH_MODE?: string;
  readonly VITE_EXTERNAL_AUTH_LOGIN_PATH?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
  readonly VITE_FIREBASE_AUTH_CUSTOM_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
