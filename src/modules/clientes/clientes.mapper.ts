import type { Cliente } from '../../generated/prisma/client';
import type {
  ClienteCriadoRespostaDto,
  ClienteRespostaDto,
  SecretRotacionadoRespostaDto,
} from './dto/cliente-resposta.dto';

const AVISO_SECRET = 'Guarde o client_secret agora: ele não poderá ser consultado novamente.';

/**
 * Mapeia a linha do Prisma para a resposta HTTP. **Nunca** espalhar `Cliente`
 * direto na resposta — a linha carrega `id` e `clientSecretHash`, que não
 * podem sair do serviço.
 */
export function paraClienteResposta(cliente: Cliente): ClienteRespostaDto {
  return {
    clientId: cliente.clientId,
    nome: cliente.nome,
    descricao: cliente.descricao,
    tipo: cliente.tipo,
    status: cliente.status,
    criadoEm: cliente.criadoEm,
    atualizadoEm: cliente.atualizadoEm,
    secretRotacionadoEm: cliente.secretRotacionadoEm,
    revogadoEm: cliente.revogadoEm,
  };
}

export function paraClienteCriadoResposta(
  cliente: Cliente,
  secret: string,
): ClienteCriadoRespostaDto {
  return { ...paraClienteResposta(cliente), clientSecret: secret, aviso: AVISO_SECRET };
}

export function paraSecretRotacionadoResposta(
  cliente: Cliente,
  secret: string,
): SecretRotacionadoRespostaDto {
  return {
    clientId: cliente.clientId,
    clientSecret: secret,
    secretRotacionadoEm: cliente.secretRotacionadoEm as Date,
    aviso: AVISO_SECRET,
  };
}
