import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const doc = (source, options) => new DOMParser().parseFromString(arch.renderToString(source, options), 'image/svg+xml');
const images = parent => [...parent.getElementsByTagName('image')];
const hrefs = parent => images(parent).map(image => image.getAttribute('href'));
const floor = '/images/site.svg';
const server = '/images/server.png';
const alternate = 'https://example.org/site.png?region=north&detail=1';
const source = `architecture "Backgrounds" {
  model {
    process server "Server" { icon core.service backgroundImage "${server}" }
    system factory "Factory" { backgroundImage "/images/factory.png" }
  }
  view plain "Plain" {}
  view overview "Overview" {
    backgroundImage "${floor}"
    showBackgroundImage true
    style server { backgroundImage "${alternate}" }
    style factory { showBackgroundImage false }
  }
  view tree "Tree" {
    diagram tree
    style server { showBackgroundImage true showIcon false }
  }
  view classes "Classes" {
    diagram class
    showBackgroundImage true
  }
}`;

test('view images and opt-in element images have separate layers and icon controls', () => {
  assert.deepEqual(hrefs(doc(source)), []);
  const overview = doc(source, { view:'overview' });
  assert.deepEqual(hrefs(overview), [floor, alternate]);
  const [canvas, card] = images(overview);
  assert.equal(canvas.parentNode, overview.documentElement);
  assert.equal(card.parentNode.getAttribute('data-node'), 'server');
  assert.equal(card.getAttribute('aria-hidden'), 'true');
  const clipId = card.getAttribute('clip-path').slice(5, -1);
  assert.equal(overview.getElementById(clipId).getElementsByTagName('path').length, 1);
  const paintOrder = [...card.parentNode.childNodes].filter(node => node.nodeType === 1);
  const icon = [...card.parentNode.getElementsByTagName('g')].find(node => node.getAttribute('data-icon') === 'core.service');
  assert.ok(icon);
  assert.ok(paintOrder.indexOf(card) < paintOrder.indexOf(icon.parentNode));
  assert.ok(paintOrder.indexOf(card) < paintOrder.findIndex(node => node.nodeName === 'text'));
  const tree = doc(source, { view:'tree' });
  assert.deepEqual(hrefs(tree), [server]);
  assert.ok([...images(tree)[0].parentNode.getElementsByTagName('g')].every(node => !node.hasAttribute('data-icon')));
  assert.deepEqual(hrefs(doc(source, { view:'classes' })), [server, '/images/factory.png']);
});

test('background image settings round-trip through JSON and stay scoped to each selected view', () => {
  const json = JSON.parse(arch.translate(source, { format:'json' }));
  assert.equal(json.architecture.model.elements.server.backgroundImage, server);
  assert.equal(json.architecture.views.overview.showBackgroundImage, true);
  assert.equal(json.architecture.views.overview.style.factory.showBackgroundImage, false);
  assert.equal(json.architecture.views.overview.style.server.backgroundImage, alternate);
  const d = doc(arch.translate(json, { format:'dsl' }), { views:['plain','overview','tree'] });
  const sections = [...d.getElementsByTagName('svg')].filter(svg => svg.hasAttribute('data-view-id'));
  assert.deepEqual(sections.map(hrefs), [[], [floor, alternate], [server]]);
});

test('view reuse preserves image settings and embedded element visibility', () => {
  const d = doc(`architecture "Reuse" {
    model { system server "Server" { backgroundImage "${server}" } }
    view base "Base" { backgroundImage "${floor}" showBackgroundImage true }
    view detail "Detail" { extends base showBackgroundImage false }
    view host "Host" { showBackgroundImage true embed detail }
  }`, { views:['detail','host'] });
  assert.deepEqual(hrefs(d), [floor, floor]);
  assert.deepEqual(images(d).map(image => image.getAttribute('data-background-image')), ['view','embed']);
});

test('unsafe image locations and invalid visibility flags fail validation', () => {
  for (const location of ['', '//example.org/site.svg', 'java\tscript:alert(1)', 'file:///tmp/a.png', 'data:image/svg+xml;base64,AA==']) {
    const clause = `backgroundImage ${JSON.stringify(location)}`;
    for (const [node, view] of [[clause, ''], ['', clause], ['', `style n { ${clause} }`]]) {
      const result = arch.validate(`architecture "Invalid" { model { system n "N" { ${node} } } view v "View" { ${view} } }`);
      assert.equal(result.valid, false);
      assert.match(result.diagnostics[0].message, /backgroundImage requires/);
    }
  }
  for (const view of ['showBackgroundImage "true"', 'style n { showBackgroundImage 1 }'])
    assert.equal(arch.validate(`architecture "Invalid" { model { system n "N" } view v "View" { ${view} } }`).valid, false);
});
