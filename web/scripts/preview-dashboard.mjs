// Local UI only: fake Auth0 configuration, no sign-in, database or bank calls.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
console.log('Dashboard preview: http://127.0.0.1:3106/dashboard/preview');
console.log('Synthetic data only. Decisions in the preview never send money.');
const preview = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3106'], {
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    AUTH0_DOMAIN: 'dashboard-preview.invalid',
    AUTH0_CLIENT_ID: 'synthetic-gallery-client',
    AUTH0_CLIENT_SECRET: 'synthetic-gallery-only',
    AUTH0_SECRET: '0'.repeat(64),
    APP_BASE_URL: 'http://127.0.0.1:3106',
  },
});
preview.on('error', () => { console.error('Could not start the preview. Run npm ci first.'); process.exitCode = 1; });
preview.on('exit', (code) => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => preview.kill('SIGINT'));
process.on('SIGTERM', () => preview.kill('SIGTERM'));
