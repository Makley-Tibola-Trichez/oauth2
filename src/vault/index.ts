import type { VaultClient } from './client';
import { FakeVaultClient } from './fake-client';

export type { VaultClient } from './client';
export { VaultError, VaultIndisponivelError, VaultPermissaoError } from './client';
export { FakeVaultClient } from './fake-client';
export { caminhoChavePrivada, caminhoRpa } from './paths';

/**
 * Instância ativa do cliente do Vault.
 *
 * Aponta para o fake em memória por padrão. Quando a implementação real
 * (HTTP contra o Vault) estiver pronta, troque esta linha por ela — o
 * resto da aplicação depende só da interface `VaultClient`, nenhuma outra
 * mudança é necessária.
 */
export const vaultClient: VaultClient = new FakeVaultClient();
