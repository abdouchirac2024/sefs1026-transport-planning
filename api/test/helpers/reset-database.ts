import { execSync } from 'node:child_process';
import * as path from 'node:path';

const API_ROOT = path.resolve(__dirname, '..', '..');

export function resetDatabase(): void {
  execSync('npm run db:reset', { cwd: API_ROOT, stdio: 'inherit' });
}
