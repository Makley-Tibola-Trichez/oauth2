import type { ExecutionContext } from '@nestjs/common';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CredencialAdminInvalidaError } from '../../modules/admin-auth/admin-auth.errors';
import type {
  IAutenticadorAdmin,
  IdentidadeAdmin,
} from '../../modules/admin-auth/autenticador.interface';
import { AuditLogService } from '../logging';
import { AdminAuthGuard, type RequisicaoComIdentidadeAdmin } from './admin-auth.guard';

function contextoComCabecalho(authorization?: string): ExecutionContext {
  const request: Partial<RequisicaoComIdentidadeAdmin> = { headers: { authorization } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminAuthGuard', () => {
  const identidade: IdentidadeAdmin = { identificador: 'admin-x', origem: 'static' };

  it('permite acesso e popula request.adminIdentity com credencial válida', async () => {
    const autenticador: IAutenticadorAdmin = {
      origem: 'static',
      autenticar: async (credencial) => {
        expect(credencial).toBe('token-valido');
        return identidade;
      },
    };
    const guard = new AdminAuthGuard(autenticador, mock<AuditLogService>());
    const contexto = contextoComCabecalho('Bearer token-valido');

    expect(await guard.canActivate(contexto)).toBe(true);
    const request = contexto.switchToHttp().getRequest<RequisicaoComIdentidadeAdmin>();
    expect(request.adminIdentity).toEqual(identidade);
  });

  it('rejeita com 401 quando a credencial é inválida', async () => {
    const autenticador: IAutenticadorAdmin = {
      origem: 'static',
      autenticar: async () => {
        throw new CredencialAdminInvalidaError('inválida');
      },
    };
    const guard = new AdminAuthGuard(autenticador, mock<AuditLogService>());

    await expect(guard.canActivate(contextoComCabecalho('Bearer errado'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejeita com 401 quando não há cabeçalho Authorization', async () => {
    const autenticador: IAutenticadorAdmin = {
      origem: 'static',
      autenticar: async (credencial) => {
        expect(credencial).toBeUndefined();
        throw new CredencialAdminInvalidaError('ausente');
      },
    };
    const guard = new AdminAuthGuard(autenticador, mock<AuditLogService>());

    await expect(guard.canActivate(contextoComCabecalho(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejeita com 503 quando o autenticador não está implementado (Entra ID)', async () => {
    const autenticador: IAutenticadorAdmin = {
      origem: 'entraid',
      autenticar: async () => {
        throw new Error('ainda não implementado');
      },
    };
    const guard = new AdminAuthGuard(autenticador, mock<AuditLogService>());

    await expect(guard.canActivate(contextoComCabecalho('Bearer x'))).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
