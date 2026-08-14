import { t } from 'elysia';

export const StatusComponenteSchema = t.Union([t.Literal('ok'), t.Literal('indisponivel')]);

export const SaudeRespostaSchema = t.Object({
  status: t.Union([t.Literal('ok'), t.Literal('degradado')]),
  aplicacao: t.String(),
  versao: t.String(),
  ambiente: t.String(),
  componentes: t.Record(t.String(), StatusComponenteSchema),
});

export type SaudeResposta = typeof SaudeRespostaSchema.static;
