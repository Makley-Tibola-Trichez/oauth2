import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequisicaoComClaims } from '../guards/token-auth.guard';

/**
 * Claims do access token autenticado, populadas pelo `TokenAuthGuard`.
 *
 * Uso: `async obter(@ClaimsTokenParam() claims: ClaimsToken) { ... }` numa
 * rota protegida por `@UseGuards(TokenAuthGuard)`.
 */
export const ClaimsTokenParam = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequisicaoComClaims>();
  if (!request.claimsToken) {
    throw new InternalServerErrorException(
      '@ClaimsTokenParam() usado numa rota sem TokenAuthGuard aplicado',
    );
  }
  return request.claimsToken;
});
