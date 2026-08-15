export const ORIGEM_ESTATICA = 'static';
export const ORIGEM_ENTRA_ID = 'entraid';

/** Quem executou a operação administrativa — vai para o log de auditoria. */
export interface IdentidadeAdmin {
  identificador: string;
  origem: string;
  nome?: string;
}

/**
 * Autenticação administrativa — ponto de troca para o Microsoft Entra ID.
 *
 * As rotas administrativas dependem apenas deste contrato e da
 * `IdentidadeAdmin` devolvida por ele. Trocar o token estático pelo Entra ID
 * é trocar a implementação escolhida em `criarAutenticadorAdmin`: nenhuma
 * rota nem regra de negócio muda.
 */
export interface AutenticadorAdmin {
  readonly origem: string;

  /** Valida a credencial ou lança `CredencialAdminInvalidaError`. */
  autenticar(credencial: string | undefined | null): Promise<IdentidadeAdmin>;
}
