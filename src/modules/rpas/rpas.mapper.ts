import type { Rpa } from '../../generated/prisma/client';
import type { RpaRespostaDto } from './dto/rpa-resposta.dto';

/** Mapeia a linha do Prisma para a resposta HTTP, sem o `id` interno. */
export function paraRpaResposta(rpa: Rpa): RpaRespostaDto {
  return {
    rpaId: rpa.rpaId,
    nome: rpa.nome,
    descricao: rpa.descricao,
    status: rpa.status,
    criadoEm: rpa.criadoEm,
    atualizadoEm: rpa.atualizadoEm,
    revogadoEm: rpa.revogadoEm,
  };
}
