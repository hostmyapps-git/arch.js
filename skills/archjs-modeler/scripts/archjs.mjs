import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const [command, ...args] = process.argv.slice(2);
const usage = 'Usage: node archjs.mjs help [TOPIC ...] | check FILE | svg FILE VIEW_ID | dashboard FILE';

if (command !== 'help' && !(command === 'svg' && args.length === 2)
    && !(['check', 'dashboard'].includes(command) && args.length === 1)) {
  console.error(usage);
  process.exitCode = 2;
} else {
  try {
    await run(command, args);
  } catch (error) {
    console.error(error.message);
    if (error.help) console.error(error.help);
    process.exitCode = 1;
  }
}

async function optionalFile(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function loadRuntime(includeIcons) {
  const root = resolve(process.env.ARCHJS_DIR ?? process.cwd());
  const minified = join(root, 'arch.min.js');
  const standard = join(root, 'arch.js');
  const minifiedSource = await optionalFile(minified);
  const filename = minifiedSource === undefined ? standard : minified;
  const bundled = minifiedSource ?? await optionalFile(standard);
  if (bundled === undefined) throw new Error(`arch.js bundles were not found in ${root}. Set ARCHJS_DIR to a trusted arch.js distribution.`);

  // The browser distribution is already bundled and runs without npm
  // dependencies. Only installed engine/profile code is evaluated here.
  const context = createContext({ console, TextDecoder, TextEncoder, URL });
  runInContext(bundled, context, { filename });
  const profileFile = join(root, 'profiles', 'profiles.js');
  const profileSource = await optionalFile(profileFile);
  if (profileSource !== undefined) runInContext(profileSource, context, { filename:profileFile });
  if (includeIcons) {
    const packs = ['bootstrap', 'lucide', 'tabler'];
    const contents = await Promise.all(packs.map(pack => optionalFile(join(root,'icons',pack+'.json'))));
    for (const [index, content] of contents.entries())
      if (content !== undefined) context.arch.registerIconPack(packs[index], JSON.parse(content));
  }
  return context.arch;
}

async function run(command, args) {
  const arch = await loadRuntime(command !== 'help' || args[0] === 'iconpacks');
  if (command === 'help') {
    console.log(arch.help(args.join(' ')));
    return;
  }
  const source = await readFile(args[0], 'utf8');
  const strict = { validation:'strict', syntaxRecovery:false };
  if (command === 'svg') {
    process.stdout.write(arch.renderToString(source, { ...strict, view:args[1] }));
    return;
  }
  if (command === 'dashboard') {
    process.stdout.write(arch.renderDashboardToHTML(source, strict));
    return;
  }
  const report = arch.architectureReport(source, { ...strict, checkRendering:true });
  const valid = report.diagnostics.every(issue => issue.severity !== 'error');
  const { title, profile, initialView, views, diagnostics } = report;
  console.log(JSON.stringify({ valid, title, profile, initialView, views, diagnostics }, null, 2));
  if (!valid) process.exitCode = 1;
}
