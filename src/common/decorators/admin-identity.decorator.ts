import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequisicaoComIdentidadeAdmin } from '../guards/admin-auth.guard';

/**
 * Identidade do administrador autenticado, populada pelo `AdminAuthGuard`.
 *
 * Uso: `async criar(@AdminIdentity() admin: IdentidadeAdmin) { ... }` numa
 * rota protegida por `@UseGuards(AdminAuthGuard)`.
 */
export const AdminIdentity = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequisicaoComIdentidadeAdmin>();
  if (!request.adminIdentity) {
    throw new InternalServerErrorException(
      '@AdminIdentity() usado numa rota sem AdminAuthGuard aplicado',
    );
  }
  return request.adminIdentity;
});
