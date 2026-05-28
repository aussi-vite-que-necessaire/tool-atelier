// Point d'entrée du worker BullMQ pour l'image lab.
// Le worker est en TypeScript (src/worker/index.ts) et utilise les alias `@/*`
// du tsconfig — on le lance via tsx (présent dans node_modules), qui résout les
// paths du tsconfig nativement. La plateforme lab démarre ce process dans le
// service `worker` du compose (REDIS_URL, DATABASE_URL et secrets injectés).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const tsx = resolve(root, 'node_modules/.bin/tsx');
const entry = resolve(root, 'src/worker/index.ts');

const child = spawn(tsx, [entry], { stdio: 'inherit', cwd: root });

// Propage les signaux d'arrêt pour un shutdown propre (le worker gère SIGTERM/SIGINT).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => child.kill(sig));
}
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
