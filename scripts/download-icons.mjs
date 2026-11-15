import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Downloads are explicit. Normal builds and the demo never access the network.
const revision = 'd0290276f8f74436ebcfa5f8ff38a8dcc91a0ef5';
const definitions = [
  { name: 'bootstrap', prefix: 'bi', licenseUrl: 'https://raw.githubusercontent.com/twbs/icons/70407d811eda8aadf8d7a83f278dc6cfb7d746a6/LICENSE' },
  { name: 'lucide', prefix: 'lucide', licenseUrl: 'https://raw.githubusercontent.com/lucide-icons/lucide/e715245d62667c800e7f54c94b1b023692e900a3/LICENSE' },
  { name: 'tabler', prefix: 'tabler', licenseUrl: 'https://raw.githubusercontent.com/tabler/tabler-icons/v3.51.0/LICENSE' },
];
const sha = data => createHash('sha256').update(data).digest('hex');
let previous;
try { previous = JSON.parse(await readFile('icons/sources.lock.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const files = [], packs = [];
for (const definition of definitions) {
  const url = `https://raw.githubusercontent.com/iconify/icon-sets/${revision}/json/${definition.prefix}.json`;
  const get = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`${response.status} downloading ${url}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const json = await get(url), collection = JSON.parse(json), license = await get(definition.licenseUrl);
  const entry = { ...definition, url, file: `icons/upstream/${definition.name}.json`,
    sha256: sha(json), licenseFile: `icons/licenses/${definition.name}.txt`, licenseSha256: sha(license),
    title: collection.info.name, version: collection.info.version ?? null,
    iconCount: Object.keys(collection.icons).length, aliasCount: Object.keys(collection.aliases ?? {}).length,
    license: collection.info.license.spdx };
  const old = previous?.packs.find(pack => pack.name === entry.name);
  if (old && (old.sha256 !== entry.sha256 || old.licenseSha256 !== entry.licenseSha256))
    throw new Error(`${entry.name}: checksum changed; review upstream changes explicitly before updating the lock.`);
  files.push([entry.file, json], [entry.licenseFile, license]); packs.push(entry);
}
await mkdir('icons/upstream', { recursive: true }); await mkdir('icons/licenses', { recursive: true });
for (const [file, contents] of files) await writeFile(file, contents);
await writeFile('icons/sources.lock.json', JSON.stringify({ repository: 'https://github.com/iconify/icon-sets', revision, packs }, null, 2) + '\n');
for (const pack of packs) console.log(`${pack.name}: ${pack.iconCount} icons + ${pack.aliasCount} aliases (${pack.license})`);
