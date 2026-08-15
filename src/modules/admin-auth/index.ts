export { adminAuthPlugin, criarAdminAuthPlugin } from './admin-auth.plugin';
export {
  type AutenticadorAdmin,
  type IdentidadeAdmin,
  ORIGEM_ENTRA_ID,
  ORIGEM_ESTATICA,
} from './admin-auth.types';
export { AutenticadorEntraId } from './entra-id';
export { autenticadorAdmin, criarAutenticadorAdmin } from './factory';
export { AutenticadorTokenEstatico } from './static-token';
