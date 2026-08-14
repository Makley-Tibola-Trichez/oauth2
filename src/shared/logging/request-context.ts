/** Contexto de requisição propagado para os logs sem passar por parâmetro. */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/** Define o `requestId` da requisição atual (gera um se `valor` for omitido). */
export function definirRequestId(valor?: string | null): string {
  const requestId = valor || crypto.randomUUID();
  storage.enterWith({ requestId });
  return requestId;
}

export function obterRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
