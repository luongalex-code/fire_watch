// Optional manual check before connecting the deployed frontend to a backend.
// Run: node scripts/check-deployment-env.mjs. This does not gate frontend builds.
import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const problems = [];
for (const key of ['VITE_API_BASE_URL', 'VITE_CAMERA_SERVICE_URL', 'VITE_CAMERA_STREAM_URL']) {
  try {
    const value = env[key];
    if (!value || value !== value.trim()) throw new Error();
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const localService = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(host)
      && url.port === (key === 'VITE_API_BASE_URL' ? '8000' : '8090');
    if (url.username || url.password || url.search || url.hash) throw new Error();
    if (!localService && (url.protocol !== 'https:'
        || !host.includes('.') || host === 'localhost' || host.endsWith('.localhost')
        || host.endsWith('.local') || host.endsWith('.example') || host.endsWith('.invalid')
        || /^[\d.]+$/.test(host) || host.includes(':'))) throw new Error();
    if (key !== 'VITE_CAMERA_STREAM_URL' && (url.pathname !== '/' || value.endsWith('/'))) throw new Error();
    if (key === 'VITE_CAMERA_STREAM_URL' && url.pathname !== '/stream') throw new Error();
  } catch {
    problems.push(`${key}: use public HTTPS or local loopback (API port 8000, camera port 8090). Base URLs have no trailing slash; stream ends with /stream.`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('URL format checks passed. Local URLs work only on the browser device; verify service reachability and browser local-network permissions separately.');
