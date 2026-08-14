import { Elysia } from 'elysia';
import { SaudeRespostaSchema } from './health.schemas';
import { verificarSaude } from './health.service';

export const healthModule = new Elysia().get('/health', () => verificarSaude(), {
  response: SaudeRespostaSchema,
  detail: {
    tags: ['Infraestrutura'],
    summary: 'Verifica a saúde do serviço',
  },
});
