import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const schema = { id: 'payload-labels', nodeTypes: { endpoint: {}, payload: {} },
  relationTypes: { exchange: { from: ['endpoint'], to: ['endpoint'], attributes: { documents: { type:'reference',many:true,targets:['payload'] } }, referenceLabels: { documents:'Documents' } }, specialized: { extends:'exchange' } } };
const source = (title = 'Sends', type = 'specialized') => `architecture "Payload labels" {model {
  endpoint a "A" endpoint b "B" payload first "Report <one>" payload second "Report <one>"
  relation r a -> b "${title}" {type ${type} documents [first, second]}
}}`;
const xml = svg => new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(svg,'image/svg+xml');

test('reference labels use configured fields, resolved titles and unambiguous IDs without changing the model', () => {
  const model = arch.parse(source(),{profile:schema}), before = JSON.stringify(model);
  const graph = arch.layout(model);
  assert.equal(graph.edges[0].title,'Sends');
  assert.equal(graph.edges[0].labelText,'Sends\nDocuments: Report <one> [first], Report <one> [second]');
  assert.equal(JSON.stringify(model),before);
  const parallel = source().replace('\n}}',' relation reply b -> a "Returns" {type exchange documents [second]}\n}}');
  const edges = arch.layout(arch.parse(parallel,{profile:schema})).edges;
  assert.equal(edges.find(e=>e.id==='reply').labelText,'Returns\nDocuments: Report <one> [second]');
  assert.equal(edges.find(e=>e.id==='r').labelText,graph.edges[0].labelText);
  for (const theme of ['light','dark']) {
    const svg = arch.renderToString(model,{theme}), document = xml(svg);
    assert.equal(document.getElementsByTagName('one').length,0);
    assert.match(document.documentElement.textContent,/Report <one> \[first\]/);
    assert.match(document.documentElement.textContent,/Report <one> \[second\]/);
    assert.ok(svg.includes('data-label-for="r"'));
  }
});

test('empty titles still display payloads; hidden payload cards keep their referenced names; unconfigured fields stay unchanged', () => {
  const doc = source('').replace('}}','} view v "V" {include a, b}}');
  const graph = arch.layout(arch.parse(doc,{profile:schema}));
  assert.equal(graph.nodes.length,2);
  assert.match(graph.edges[0].labelText,/Documents: Report <one>/);
  assert.ok(arch.renderToString(doc,{profile:schema}).includes('data-label-for="r"'));
  const noLabels = structuredClone(schema); noLabels.relationTypes.exchange.referenceLabels = {};
  assert.equal(arch.layout(arch.parse(source(),{profile:noLabels})).edges[0].labelText,'Sends');
});

test('reference label metadata rejects nonexistent/scalar attributes and malformed labels atomically', () => {
  for (const referenceLabels of [{missing:'Missing'},{documents:''},{documents:5}]) {
    const invalid = structuredClone(schema); invalid.relationTypes.exchange.referenceLabels = referenceLabels;
    assert.throws(()=>arch.registerProfile('bad-labels',{...invalid,id:'bad-labels'}),/referenceLabels/);
  }
  const invalid=structuredClone(schema); invalid.relationTypes.exchange.attributes.documents.type='string';delete invalid.relationTypes.exchange.attributes.documents.targets;
  assert.throws(()=>arch.registerProfile('bad-labels',{...invalid,id:'bad-labels'}),/reference attribute/);
});

test('the exact fighter/controller L3 example visibly identifies the information carried by its relation', async () => {
  for (const id of ['uaf','naf41-uaf']) arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
  const source = await readFile('tests/fixtures/naf41/user-l3.arch','utf8');
  const model = arch.parse(source), graph = arch.layout(model);
  assert.equal(graph.edges[0].labelText,'controlls\nConveys: Controll [i]');
  assert.equal(graph.nodes.find(n=>n.id==='f').x,400);
  for (const theme of ['light','dark']) {
    const d=xml(arch.renderToString(source,{theme}));
    const label=[...d.getElementsByTagName('g')].find(e=>e.getAttribute('data-label-for')==='control');
    assert.equal(label.textContent,'controlls');
    const card=[...d.getElementsByTagName('g')].find(e=>e.getAttribute('class')==='arch-edge-reference');
    assert.equal(card.getAttribute('data-reference-for'),'control');
    assert.equal(card.getAttribute('data-reference-node'),'i');
    assert.ok(card.textContent.includes('Controll'));
  }
});
