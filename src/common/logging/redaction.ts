/**
 * Redação de segredos nos logs.
 *
 * Percorre recursivamente qualquer objeto de log e substitui por `***` todo
 * campo cujo nome contenha um dos trechos sensíveis — inclusive dentro de
 * objetos e arrays aninhados. Nenhum `client_secret`, hash, token ou chave
 * privada deve sobreviver a esta função.
 */

export const VALOR_REDIGIDO = '***';

const TRECHOS_SENSIVEIS = [
  'secret',
  'token',
  'password',
  'senha',
  'private',
  'privada',
  'credencia', // cobre "credencial" e "credenciais"
  'credential', // cobre "credential" e "credentials"
  'authorization',
  'apikey',
  'api_key',
  'chaveprivada',
] as const;

// Campos cujo nome casa com os trechos acima mas que não carregam segredo algum.
const CAMPOS_LIBERADOS = new Set(['tokenType', 'token_type', 'grantType', 'grant_type']);

export function campoESensivel(nome: string): boolean {
  const normalizado = nome.toLowerCase();
  if (CAMPOS_LIBERADOS.has(nome) || CAMPOS_LIBERADOS.has(normalizado)) {
    return false;
  }
  return TRECHOS_SENSIVEIS.some((trecho) => normalizado.includes(trecho));
}

export function redigir(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map((item) => redigir(item));
  }
  if (valor !== null && typeof valor === 'object' && !(valor instanceof Date)) {
    const origem = valor as Record<string, unknown>;
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(origem)) {
      saida[chave] = campoESensivel(chave) ? VALOR_REDIGIDO : redigir(origem[chave]);
    }
    return saida;
  }
  return valor;
}

/** Redige apenas os campos de um registro de log (nível superior + aninhados). */
export function redigirCampos(campos: Record<string, unknown>): Record<string, unknown> {
  return redigir(campos) as Record<string, unknown>;
}
