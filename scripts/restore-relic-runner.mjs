import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Updates only runner files and its menu entry. It never switches branches,
// merges histories, commits, or pushes. Existing files are backed up first.
export function addRunnerToMenu(source) {
  const start = source.indexOf('const PLAY_GAMES: {');
  const arrayStart = source.indexOf('}[] = [', start);
  if (start < 0 || arrayStart < 0) throw new Error('Could not find PLAY_GAMES; no files have been changed.');
  const end = source.indexOf('\n];', arrayStart);
  if (end < 0) throw new Error('Could not find the end of PLAY_GAMES; no files have been changed.');
  let header = source.slice(start, arrayStart);
  let entries = source.slice(arrayStart, end);
  let rest = source.slice(end);
  const hasRoutes = /\broute\s*:/.test(header);
  if (hasRoutes && !header.includes("'./companion-relic-runner'") && !header.includes("'/companion-relic-runner'")) {
    header = header.replace(/(\broute\s*:\s*)([\s\S]*?);/, "$1$2 | './companion-relic-runner';");
  }
  if (!/id:\s*['"]relic-runner['"]/.test(entries)) {
    const game = [
      '  {', "    id: 'relic-runner',", "    title: 'Relic Runner',",
      "    subtitle: 'Swipe • Jump • Slide • Collect',", "    icon: 'flash-outline',",
      ...(hasRoutes ? ["    route: './companion-relic-runner',"] : []), '  },',
    ].join('\n');
    entries = entries.replace('}[] = [', '}[] = [\n' + game);
  }
  if (!hasRoutes && !/game\.id\s*===\s*['"]relic-runner['"]/.test(rest)) {
    const target = /if \(game\.id === 'food-sort'\) \{/;
    if (!target.test(rest)) throw new Error('Could not find game navigation; no files have been changed.');
    rest = rest.replace(target, [
      "if (game.id === 'relic-runner') {",
      "                router.push('/companion-relic-runner');",
      '                return;',
      '              }',
      "              if (game.id === 'food-sort') {",
    ].join('\n'));
  }
  return source.slice(0, start) + header + entries + rest;
}

export function restoreRunner(sourceRef = 'FETCH_HEAD') {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const root = git('rev-parse', '--show-toplevel').trim();
  const sha = git('rev-parse', '--verify', '--end-of-options', sourceRef + '^{commit}').trim();
  const paths = [
    'src/app/companion-relic-runner.tsx',
    'src/components/relic-runner-track.tsx',
    'src/utils/relic-runner-core.ts',
    'src/utils/relic-runner-core.test.ts',
  ];
  // Read and validate everything before touching the working tree.
  const changes = paths.map((path) => [path, git('-C', root, 'show', sha + ':' + path)]);
  const menuPath = 'src/app/companion.tsx';
  changes.push([menuPath, addRunnerToMenu(readFileSync(join(root, menuPath), 'utf8'))]);
  const changed = changes.filter(([path, content]) =>
    !existsSync(join(root, path)) || readFileSync(join(root, path), 'utf8') !== content);
  if (!changed.length) { console.log('Relic Runner is already up to date.'); return; }
  const backup = mkdtempSync(join(tmpdir(), 'mission-trails-runner-'));
  for (const [path] of changed) {
    if (existsSync(join(root, path))) {
      mkdirSync(dirname(join(backup, path)), { recursive: true });
      writeFileSync(join(backup, path), readFileSync(join(root, path)));
    }
  }
  for (const [path, content] of changed) {
    const destination = join(root, path);
    const temporary = destination + '.runner-tmp';
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(temporary, content);
    renameSync(temporary, destination);
    console.log('Updated: ' + path);
  }
  console.log('Previous files: ' + backup);
  console.log('Branch unchanged. Run npx tsc --noEmit, then npx expo start --clear.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { restoreRunner(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
