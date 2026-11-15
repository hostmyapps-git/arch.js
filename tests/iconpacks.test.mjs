import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { registerIconPack, renderIconToString, parse, renderToString } from '../src/arch.js';
import { convertBody, convertCollection } from '../scripts/iconpacks.mjs';

const lock = JSON.parse(await readFile('icons/sources.lock.json', 'utf8'));

test('all downloaded packs and licenses match pinned checksums; every icon and alias survives conversion', async () => {
  for (const source of lock.packs) {
    for (const [file, expected] of [[source.file, source.sha256], [source.licenseFile, source.licenseSha256]])
      assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), expected, file);
    const original = JSON.parse(await readFile(source.file, 'utf8'));
    const generated = JSON.parse(await readFile(`icons/${source.name}.json`, 'utf8'));
    assert.deepEqual(JSON.parse(JSON.stringify(convertCollection(original, source))), generated);
    assert.equal(Object.keys(generated.icons).length, source.iconCount + source.aliasCount);
    assert.deepEqual(Object.keys(generated.icons).sort(), [...Object.keys(original.icons), ...Object.keys(original.aliases ?? {})].sort());
    registerIconPack(source.name, generated);
    for (const name of Object.keys(generated.icons)) assert.match(renderIconToString(`${source.name}.${name}`), /^<svg/);
    for (const [id, alias] of Object.entries(original.aliases ?? {})) assert.deepEqual(generated.icons[id], generated.icons[alias.parent]);
  }
});

test('Bootstrap retains filled areas and evenodd holes; line icons retain the original stroke width', async () => {
  for (const source of lock.packs) registerIconPack(source.name, JSON.parse(await readFile(`icons/${source.name}.json`, 'utf8')));
  const filled = renderIconToString('bootstrap.person');
  assert.match(filled, /fill="currentColor" stroke="none"/);
  assert.match(renderIconToString('bootstrap.cc-square'), /fill-rule="evenodd"/);
  for (const pack of ['lucide', 'tabler']) assert.match(renderIconToString(`${pack}.user`), /fill="none" stroke="currentColor" stroke-width="2"/);
  assert.match(renderIconToString('bootstrap.align-top'), /<path/);
  assert.match(renderIconToString('bootstrap.apple'), /<path/);
  assert.match(renderIconToString('tabler.123'), /data-icon="tabler.123"/);
});

test('registered structured paths are copied, frozen, validated atomically and never inject markup', () => {
  const path = { d: 'M0 0h24v24H0Z', fill: 'currentColor', stroke: 'none', fillRule: 'evenodd', opacity: .5 };
  const pack = { icons: { sample: { paths: [path] } } };
  registerIconPack('structured', pack); path.fill = '<script>'; path.d = 'invalid';
  assert.match(renderIconToString('structured.sample'), /opacity="0.5"/);
  for (const value of [{ d: 'M0 0', onclick: 'alert(1)' }, { d: 'M0 0', fill: 'url(evil)' },
    { d: 'M0 0', opacity: NaN }, { d: 'M0 0', strokeWidth: -1 }, { d: 'M0 0', linecap: 'evil' },
    { d: 'M0 0', fillRule: 'evil' }, { d: 'M0 0', fillOpacity: 2 }])
    assert.throws(() => registerIconPack('structured', { icons: { invalid: { paths: [value] } } }));
  assert.doesNotThrow(() => renderIconToString('structured.sample'));
  assert.throws(() => registerIconPack('raw', { icons: { x: { body: '<script/>' } } }));
  assert.throws(() => renderIconToString('structured.sample', { size: 0 }));
  assert.throws(() => renderIconToString('missing.icon'));
  assert.ok(!renderIconToString('structured.sample', { title: '<script>' }).includes('<script>'));
});

test('conversion resolves local references and transforms while rejecting external or executable SVG', () => {
  const paths = convertBody('<defs><circle id="point" cx="12" cy="12" r="5"/></defs><g fill="none" stroke="currentColor"><use href="#point"/></g>');
  assert.equal(paths.length, 1); assert.equal(paths[0].stroke, 'currentColor');
  assert.match(convertBody('<rect width="4" height="12" transform="matrix(1 0 0 -1 6 15)"/>')[0].d, /M6 15/);
  for (const body of ['<script>alert(1)</script>', '<path d="M0 0" onclick="evil()"/>',
    '<use href="https://example.com/icon.svg"/>', '<image href="x"/>', '<!DOCTYPE svg><path d="M0 0"/>',
    '<g id="a"><use href="#a"/></g>', '<path d="M0 0" style="fill:url(evil)"/>']) assert.throws(() => convertBody(body));
});

test('iconpack architecture fixture renders all four views using downloaded icons', async () => {
  for (const source of lock.packs) registerIconPack(source.name, JSON.parse(await readFile(`icons/${source.name}.json`, 'utf8')));
  const model = parse(await readFile('examples/iconpacks.arch', 'utf8'));
  assert.equal(model.views.length, 4);
  for (const view of model.views) assert.match(renderToString(model, { view: view.id }), /data-icon="(?:bootstrap|lucide|tabler)\./);
});
