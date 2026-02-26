declare module 'node:http' {
  export interface IncomingMessage extends AsyncIterable<Uint8Array | string> {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  }

  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(chunk?: string): void;
  }

  export interface Server {
    listen(port: number, host: string, callback?: () => void): void;
    close(callback?: (error?: Error) => void): void;
  }

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void,
  ): Server;
}

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function renameSync(oldPath: string, newPath: string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:crypto' {
  export interface Hmac {
    update(data: string): Hmac;
    digest(encoding: 'hex' | 'base64'): string;
  }

  export interface Sign {
    update(data: string): Sign;
    sign(privateKey: string, outputFormat: 'base64'): string;
  }

  export interface Verify {
    update(data: string): Verify;
    verify(publicKey: string, signature: BinaryValue): boolean;
  }

  export interface BinaryValue {
    toString(encoding: 'hex'): string;
  }

  export interface KeyPairSyncResult<TPublicKey, TPrivateKey> {
    publicKey: TPublicKey;
    privateKey: TPrivateKey;
  }

  export function createHmac(algorithm: 'sha256', key: string): Hmac;
  export function createSign(algorithm: 'RSA-SHA256'): Sign;
  export function createVerify(algorithm: 'RSA-SHA256'): Verify;
  export function generateKeyPairSync(
    type: 'rsa',
    options: {
      modulusLength: number;
      publicKeyEncoding: {
        type: 'spki';
        format: 'pem';
      };
      privateKeyEncoding: {
        type: 'pkcs8';
        format: 'pem';
      };
    },
  ): KeyPairSyncResult<string, string>;
  export function randomBytes(size: number): BinaryValue;
  export function scryptSync(password: string, salt: string, keylen: number): BinaryValue;
}

declare const process: {
  env: Record<string, string | undefined>;
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): void;
  exit(code?: number): never;
};
