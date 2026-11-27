import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const source = `architecture "Canvas" {
  config { backgroundColor "#e8eef7" views all }
  model { system systemA "System A" }
  view overview "Overview" {}
  view detail "Detail" { backgroundColor white }
  view inherited "Inherited" { extends detail }
  view transparent "Transparent" { diagram tree backgroundColor transparent }
  view grid "Grid" { diagram viewpointGrid backgroundColor transparent }
  view source "Source" {
    backgroundColor "#bed"
    @meta json
  }
}`;

const svg = (source, options) => new DOMParser()
  .parseFromString(arch.renderToString(source, options), 'image/svg+xml').documentElement;
const canvas = element => [...element.childNodes]
  .find(child => child.tagName === 'rect' || child.getAttribute?.('fill-rule') === 'evenodd');

test('the view canvas inherits config, overrides its base theme, and survives DSL and JSON translation', () => {
  const json = JSON.parse(arch.translate(source, { format:'json' }));
  assert.equal(json.architecture.config.backgroundColor, '#e8eef7');
  assert.equal(json.architecture.views.detail.backgroundColor, 'white');
  assert.equal(json.architecture.views.overview.backgroundColor, undefined);
  for (const input of [source, json, arch.translate(json, { format:'dsl' })]) {
    for (const [view, fill] of Object.entries({overview:'#e8eef7', detail:'#ffffff', inherited:'#ffffff', transparent:'none', source:'#bed'})) {
      const diagram = svg(input, {view, theme:'dark'});
      assert.equal(canvas(diagram).getAttribute('fill'), fill, view);
      assert.ok(diagram.getAttribute('style').includes(`background:${fill === 'none' ? 'transparent' : fill}`), view);
    }
  }
  const implicit = 'architecture "Default" { model { system systemA "System A" } }';
  assert.equal(canvas(svg(implicit, { theme:'dark' })).getAttribute('fill'), '#111827');
  assert.equal(canvas(svg(implicit.replace('model', 'config { backgroundColor transparent } model'))).getAttribute('fill'), 'none');
});

test('transparent grid and stacked views leave the host page visible, even in partial preview', () => {
  const grid = svg(source, {view:'grid'});
  assert.equal(canvas(grid).getAttribute('fill'), 'none');
  const gridSurface = [...grid.childNodes].find(child => child.getAttribute?.('rx') === '14');
  assert.equal(gridSurface.getAttribute('fill'), 'none');

  const input = source.replace('views all', 'views [detail, transparent] syntaxRecovery true');
  const stack = svg(input);
  const backdrop = canvas(stack);
  assert.equal(backdrop.getAttribute('fill'), '#e8eef7');
  assert.equal(backdrop.getAttribute('fill-rule'), 'evenodd');
  assert.equal(backdrop.getAttribute('d').split('M').length, 3);
  assert.ok(stack.getAttribute('style').endsWith('background:transparent'));
  const partial = svg(input.replace('system systemA "System A"', 'system systemA "System A" Unknown pending "Pending"'));
  assert.equal(partial.getAttribute('data-arch-syntax'), 'true');
  assert.equal(canvas(partial).getAttribute('fill'), 'none');
});

test('an embedded view uses its explicit background over the host canvas', () => {
  const diagram = svg(source.replace('view overview "Overview" {}',
    'view overview "Overview" { backgroundColor transparent embed detail }'), {view:'overview'});
  assert.equal(canvas(diagram).getAttribute('fill'), 'none');
  const embed = [...diagram.childNodes].find(child => child.getAttribute?.('data-embed-background') === 'detail');
  assert.equal(embed.getAttribute('fill'), '#ffffff');
});

test('config and view canvas backgrounds reject unsupported values with contextual help', () => {
  const invalid = '"url(https://example.com/background.svg)"';
  for (const [input, help] of [
    [source.replace('"#e8eef7"', invalid), '@help config'],
    [source.replace('backgroundColor white', `backgroundColor ${invalid}`), '@help views']
  ]) {
    const {valid, diagnostics} = arch.validate(input);
    assert.equal(valid, false);
    assert.match(diagnostics[0].message, /backgroundColor requires/);
    assert.equal(diagnostics[0].help, help);
  }
});
