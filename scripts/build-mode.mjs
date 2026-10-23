import { releaseBuild } from './release-build.mjs';

const mode = String(process.argv[2] || '').trim();

if (!mode) {
  throw new Error('Usage: npm run build:mode -- <dev|development|prod|production>');
}

if (!['dev', 'development', 'prod', 'production'].includes(mode)) {
  throw new Error(`Unsupported build mode: ${mode}`);
}

await releaseBuild(mode);
