import { spawnSync } from 'node:child_process';
import process from 'node:process';

const [script, ...scriptArguments] = process.argv.slice(2);

if (!script) {
  process.stderr.write('Usage: node scripts/run-powershell.mjs <script.ps1> [...arguments]\n');
  process.exit(2);
}

const executable = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const result = spawnSync(
  executable,
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...scriptArguments],
  { stdio: 'inherit' },
);

if (result.error) {
  process.stderr.write(`Unable to start ${executable}: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
