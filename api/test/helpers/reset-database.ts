import { execSync } from 'node:child_process';
import * as path from 'node:path';

const API_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Relance `npm run db:reset` (même commande que documentée dans le README : docker compose
 * exec + sqlcmd -i init.sql) pour repartir de données connues. Utilisé dans un beforeAll/
 * beforeEach de test e2e, pour qu'aucun test ne dépende de l'effet d'un autre.
 */
export function resetDatabase(): void {
  execSync('npm run db:reset', { cwd: API_ROOT, stdio: 'inherit' });
}
