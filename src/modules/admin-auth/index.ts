export { CredencialAdminInvalidaError } from './admin-auth.errors';
export { criarAutenticadorAdmin } from './admin-auth.factory';
export { AdminAuthModule } from './admin-auth.module';
export {
  IAutenticadorAdmin,
  type IdentidadeAdmin,
  ORIGEM_ENTRA_ID,
  ORIGEM_ESTATICA,
} from './autenticador.interface';
export { AutenticadorEntraIdService } from './autenticador-entra-id.service';
export { AutenticadorTokenEstaticoService } from './autenticador-token-estatico.service';
