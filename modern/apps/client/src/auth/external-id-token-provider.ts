export interface ExternalIdTokenProvider {
  readonly providerName: string;
  getIdToken(): Promise<string | null>;
  subscribe(listener: (idToken: string | null) => void): () => void;
}
