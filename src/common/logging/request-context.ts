import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestContextStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/** Executa `callback` com um `requestId` associado ao contexto assíncrono atual. */
export function runWithRequestContext<T>(requestId: string | undefined, callback: () => T): T {
  return storage.run({ requestId: requestId ?? randomUUID() }, callback);
}

export function obterRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
