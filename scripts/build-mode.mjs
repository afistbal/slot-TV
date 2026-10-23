import { spawnSync } from 'node:child_process';

const mode = String(process.argv[2] || '').trim();

if (!mode) {
  throw new Error('Usage: npm run build:mode -- <dev|development|prod|production>');
}

if (!['dev', 'development', 'prod', 'production'].includes(mode)) {
  throw new Error(`Unsupported build mode: ${mode}`);
}

const outDir = mode === 'prod' || mode === 'production'
    ? 'D:/JJ-TV/movie-www-prod'
    : 'D:/JJ-TV/movie-www';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

run('node', ['./scripts/bump-version.mjs']);
run('npx', ['tsc', '-b']);
run('node', ['./scripts/clean-movie-www.mjs', outDir]);
run('npx', ['vite', 'build', '--mode', mode]);
