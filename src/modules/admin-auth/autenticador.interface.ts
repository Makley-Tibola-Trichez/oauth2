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
 * Os controllers e services dependem apenas deste contrato e da
 * `IdentidadeAdmin` devolvida por ele. Trocar o token estático pelo Entra ID
 * é substituir a implementação escolhida pelo `useFactory` do
 * `AdminAuthModule`: nenhuma regra de negócio muda.
 */
export abstract class IAutenticadorAdmin {
  abstract readonly origem: string;

  /** Valida a credencial ou lança `CredencialAdminInvalidaError`. */
  abstract autenticar(credencial: string | undefined | null): Promise<IdentidadeAdmin>;
}
