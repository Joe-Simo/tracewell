// Offline manifest check using the @forge/manifest validator that ships with the Forge CLI.
// Usage: node scripts/validate-manifest.cjs (needs @forge/cli installed globally).
const { execSync } = require('node:child_process');
const path = require('node:path');

const globalRoot = execSync('npm root -g').toString().trim();
const { validate } = require(path.join(globalRoot, '@forge/cli/node_modules/@forge/manifest'));

validate(false, path.join(process.cwd(), 'manifest.yml')).then((r) => {
  if (r.success) {
    console.log('manifest.yml is valid');
    return;
  }
  for (const e of r.errors ?? []) console.error(`line ${e.line ?? '?'}: ${e.message}`);
  process.exit(1);
});
