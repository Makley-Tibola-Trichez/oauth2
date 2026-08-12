export { ChavePrivadaCache } from './chave-privada-cache';
export { ChaveDeAssinaturaIndisponivelError } from './chaves-jwt.errors';
export { ChavesJwtModule } from './chaves-jwt.module';
export type { ChaveDeAssinatura, ChavePublicaRegistrada } from './key-manager.service';
export { KeyManagerService } from './key-manager.service';
export {
  ALGORITMO_PADRAO,
  calcularKid,
  chavePublicaParaJwk,
  gerarParDeChaves,
  type ParDeChaves,
} from './rsa-key.util';
