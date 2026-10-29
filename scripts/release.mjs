import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

/** Esegue un comando senza interpolazione della shell. */
function run(command, args, capture = false) {
  return execFileSync(command, args, {
    encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })?.trim();
}

/** Interrompe il rilascio se manca un prerequisito. */
function check(condition, message) {
  if (!condition) throw new Error(message);
}

/** Confronta numericamente due versioni stabili. */
function compare(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

/** Propone la patch successiva e pubblica commit e tag solo dopo conferma. */
async function release() {
  check(process.argv.slice(2).every(arg => arg === '--dry-run'),
    'Uso: npm run release [-- --dry-run]');
  check(run('git', ['branch', '--show-current'], true) === 'main', 'Esegui il rilascio da main.');
  check(!run('git', ['status', '--porcelain'], true), 'Prima salva tutte le modifiche in un commit.');
  check(run('git', ['remote', 'get-url', 'origin'], true) === 'https://github.com/kasa85/timbri.git',
    'Il remote origin deve essere il repository kasa85/timbri.');
  run('git', ['fetch', 'origin', '--tags']);
  const original = ['package.json', 'package-lock.json'].map(path => [path, readFileSync(path, 'utf8')]);
  const manifest = JSON.parse(original[0][1]);
  const tags = run('git', ['tag', '--list'], true).split('\n').filter(tag => /^v\d+\.\d+\.\d+$/.test(tag));
  const current = [manifest.version, ...tags.map(tag => tag.slice(1))].sort(compare).at(-1);
  const parts = current.split('.').map(Number);
  const proposed = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  console.log(`Versione attuale: ${current}; patch proposta: ${proposed}`);
  if (process.argv.includes('--dry-run')) return;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let commitStarted = false;
  try {
    const version = (await prompt.question(`Nuova versione [${proposed}]: `)).trim() || proposed;
    check(/^\d+\.\d+\.\d+$/.test(version) && compare(version, current) > 0,
      `Inserisci una versione stabile maggiore di ${current}.`);
    const tag = `v${version}`;
    const answer = await prompt.question(`Aggiornare versione, creare commit e tag ${tag} e fare push con deploy? [s/N]: `);
    if (answer.trim().toLowerCase() !== 's') return;
    for (const [path, content] of original) {
      const data = JSON.parse(content);
      data.version = version;
      if (data.packages?.['']) data.packages[''].version = version;
      writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
    }
    run('git', ['diff', '--check']);
    run('git', ['add', '--', 'package.json', 'package-lock.json']);
    commitStarted = true;
    run('git', ['commit', '-m', `chore: release ${tag}`]);
    run('git', ['tag', '-a', tag, '-m', `Release ${tag}`]);
    run('git', ['push', '--atomic', '-u', 'origin', 'main', tag]);
    console.log(`Pubblicato ${tag}. Segui il deploy su https://github.com/kasa85/timbri/actions`);
  } catch (error) {
    if (!commitStarted) {
      for (const [path, content] of original) writeFileSync(path, content);
    } else {
      console.error('Rilascio interrotto: controlla commit, tag e remote prima di riprovare. Non aumentare di nuovo la versione.');
    }
    throw error;
  } finally {
    prompt.close();
  }
}

release().catch(error => {
  console.error(`Rilascio fallito: ${error.message}`);
  process.exitCode = 1;
});
