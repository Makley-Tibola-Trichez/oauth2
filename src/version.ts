import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface PackageJson {
  version: string;
}

function lerVersao(): string {
  try {
    const conteudo = readFileSync(join(__dirname, '..', 'package.json'), 'utf-8');
    return (JSON.parse(conteudo) as PackageJson).version;
  } catch {
    return '0.0.0';
  }
}

/** Versão da aplicação, lida do `package.json` — evita duplicar o número. */
export const APP_VERSION = lerVersao();
