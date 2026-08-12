import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CredencialAdminInvalidaError } from '../../modules/admin-auth/admin-auth.errors';
import {
  IAutenticadorAdmin,
  type IdentidadeAdmin,
} from '../../modules/admin-auth/autenticador.interface';
import { AuditLogService, EVENTOS_AUDITORIA } from '../logging';

export interface RequisicaoComIdentidadeAdmin extends Request {
  adminIdentity?: IdentidadeAdmin;
}

/** Exige credencial administrativa válida no cabeçalho `Authorization`. */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly autenticador: IAutenticadorAdmin,
    private readonly auditLog: AuditLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequisicaoComIdentidadeAdmin>();
    const token = extrairTokenBearer(request.headers.authorization);

    try {
      request.adminIdentity = await this.autenticador.autenticar(token);
      return true;
    } catch (erro) {
      if (erro instanceof CredencialAdminInvalidaError) {
        this.auditLog.registrarFalha(
          EVENTOS_AUDITORIA.AUTENTICACAO_FALHA,
          'Credencial administrativa recusada',
          { origem: this.autenticador.origem },
        );
        throw new UnauthorizedException('Credencial administrativa inválida');
      }
      throw new ServiceUnavailableException(
        erro instanceof Error ? erro.message : 'Autenticação administrativa indisponível',
      );
    }
  }
}

function extrairTokenBearer(cabecalho: string | undefined): string | undefined {
  if (!cabecalho?.startsWith('Bearer ')) {
    return undefined;
  }
  return cabecalho.slice('Bearer '.length).trim();
}
