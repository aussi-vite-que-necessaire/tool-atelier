import { type ChildProcess, spawn } from 'node:child_process';

let workerProcess: ChildProcess | undefined;

async function globalSetup(): Promise<() => Promise<void>> {
  // Mode serveur externe (CI contre un conteneur) : web et worker tournent déjà
  // comme conteneurs (pilotés par le job e2e), rien à démarrer ici.
  if (process.env.E2E_BASE_URL) return async () => {};

  // Le worker BullMQ n'a pas de serveur HTTP : on le démarre ici en hors-bande
  // (Playwright `webServer` requiert une URL de probe, ce qui ne matche pas).
  workerProcess = spawn('npm', ['run', 'worker'], {
    env: {
      ...process.env,
      E2E_TESTING: 'true',
      RESEND_API_KEY: '',
      // Stub media-engine filesystem : URLs chargeables par le navigateur,
      // bytes partagés entre le process web et le process worker.
      CONTENT_OS_MEDIA_STUB: 'fs',
      // Stub LinkedIn : publishStub retourne un faux URN sans appel réseau.
      CONTENT_OS_LINKEDIN_STUB: '1',
    },
    stdio: 'inherit',
    detached: false,
  });

  // Laisse au worker quelques centaines de ms pour se connecter à Redis avant
  // que les tests ne commencent. Le E2E n'exerce pas directement la queue
  // mais on veut que la stack complète soit live.
  await new Promise((r) => setTimeout(r, 1500));

  return async () => {
    if (workerProcess && !workerProcess.killed) {
      workerProcess.kill('SIGTERM');
      // Attend au plus 3s la sortie propre
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          workerProcess?.kill('SIGKILL');
          resolve();
        }, 3000);
        workerProcess?.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  };
}

export default globalSetup;
