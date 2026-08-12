import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ClaimsToken } from '../../modules/token-service';
import { TokenInvalidoError, TokenService } from '../../modules/token-service';

export interface RequisicaoComClaims extends Request {
  claimsToken?: ClaimsToken;
}

/** Exige um access token válido do próprio serviço (RPA ou microsserviço). */
@Injectable()
export class TokenAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequisicaoComClaims>();
    const token = extrairTokenBearer(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Token de acesso não informado');
    }

    try {
      request.claimsToken = await this.tokenService.validar(token);
      return true;
    } catch (erro) {
      const mensagem = erro instanceof TokenInvalidoError ? erro.message : 'Token inválido';
      throw new UnauthorizedException(mensagem);
    }
  }
}

function extrairTokenBearer(cabecalho: string | undefined): string | undefined {
  if (!cabecalho?.startsWith('Bearer ')) {
    return undefined;
  }
  return cabecalho.slice('Bearer '.length).trim();
}
