/**
 * Composição da aplicação — separada de `index.ts` para que os testes
 * possam importar `app` e chamar `app.handle(request)` sem abrir uma porta.
 */

import { Elysia } from 'elysia';
import { config } from './config/env';
import { healthModule } from './modules/health/health.routes';
import { errorHandlerPlugin } from './shared/error-handler.plugin';
import { configurarNivelDeLog, requestLogPlugin } from './shared/logging';

configurarNivelDeLog(config.logLevel);

export const app = new Elysia().use(errorHandlerPlugin).use(requestLogPlugin).use(healthModule);

export type App = typeof app;
