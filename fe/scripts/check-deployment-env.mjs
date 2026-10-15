// Only the Vercel build command invokes this check; local/Docker builds stay unchanged.
import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const problems = [];
for (const key of ['VITE_API_BASE_URL', 'VITE_CAMERA_SERVICE_URL', 'VITE_CAMERA_STREAM_URL']) {
  try {
    const value = env[key];
    if (!value || value !== value.trim()) throw new Error();
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const localCamera = key !== 'VITE_API_BASE_URL' && url.protocol === 'http:'
      && ['127.0.0.1', 'localhost'].includes(host) && url.port === '8090';
    if (url.username || url.password || url.search || url.hash) throw new Error();
    if (!localCamera && (url.protocol !== 'https:'
        || !host.includes('.') || host === 'localhost' || host.endsWith('.localhost')
        || host.endsWith('.local') || host.endsWith('.example') || host.endsWith('.invalid')
        || /^[\d.]+$/.test(host) || host.includes(':'))) throw new Error();
    if (key !== 'VITE_CAMERA_STREAM_URL' && (url.pathname !== '/' || value.endsWith('/'))) throw new Error();
    if (key === 'VITE_CAMERA_STREAM_URL' && url.pathname !== '/stream') throw new Error();
  } catch {
    problems.push(`${key}: use a public HTTPS URL (camera also permits local http://127.0.0.1:8090). Base URLs have no trailing slash; stream ends with /stream.`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Deployment URL format checks passed. Backend/camera reachability must be verified separately.');
