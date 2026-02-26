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
    digest(encoding: 'hex'): string;
  }

  export interface BinaryValue {
    toString(encoding: 'hex'): string;
  }

  export function createHmac(algorithm: 'sha256', key: string): Hmac;
  export function randomBytes(size: number): BinaryValue;
  export function scryptSync(password: string, salt: string, keylen: number): BinaryValue;
}

declare const process: {
  env: Record<string, string | undefined>;
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): void;
  exit(code?: number): never;
};
