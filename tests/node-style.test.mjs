import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { readFile } from 'node:fs/promises';
import * as arch from '../src/arch.js';

const xml=svg=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(svg,'image/svg+xml');

test('long type/stereotype badges stay on one line with a complete tooltip and do not increase card height',()=>{
  const stereotype='A_VERY_LONG_CUSTOM_STEREOTYPE_'.repeat(8)+'日本語🙂';
  const source=`architecture "Badge" {model {system node "Node" {stereotype ${JSON.stringify(stereotype)}}} view v "V" {place node at (0,0) size (160,96)}}`;
  const model=arch.parse(source),before=JSON.stringify(model),node=arch.layout(model).nodes[0];
  assert.equal(node.badgeLines.length,1);assert.ok(node.badgeLines[0].endsWith('…'));assert.equal(node.height,96);
  for(const theme of ['light','dark']) {
    const d=xml(arch.renderToString(model,{theme})),badge=[...d.getElementsByTagName('text')].find(t=>t.hasAttribute('data-node-badge'));
    assert.equal(badge.getElementsByTagName('tspan').length,1);
    assert.equal(badge.getElementsByTagName('title')[0].textContent,stereotype);
  }
  assert.equal(JSON.stringify(model),before);
});

test('view-local font and dimensions override place size, preserve model data and keep readable content inside minimum heights',async()=>{
  const source=`architecture "Style" {model {system node "Node" {stereotype "OPERATIONAL_PERFORMER"}}
    view custom "Custom" {place node at (10,20) size (200,100) style node {fontSize 14 width 320 height 140}}
    view plain "Plain" {place node at (0,0) size (160,96)}}`;
  const model=arch.parse(source),before=JSON.stringify(model),styled=arch.layout(model,{view:'custom'}).nodes[0],plain=arch.layout(model,{view:'plain'}).nodes[0];
  assert.equal(styled.width,320);assert.equal(styled.height,140);assert.equal(styled.x,10);assert.equal(styled.y,20);
  assert.equal(styled.textStyle.title,14);assert.equal(styled.textStyle.badge,8.4);
  assert.equal(styled.badgeLines[0],'OPERATIONAL_PERFORMER');assert.ok(plain.badgeLines[0].endsWith('…'));
  assert.equal(plain.width,160);assert.equal(plain.height,96);assert.equal(plain.textStyle.title,15);
  const d=xml(arch.renderToString(model,{view:'custom'}));
  assert.ok([...d.getElementsByTagName('text')].some(t=>t.getAttribute('font-size')==='14'));
  assert.equal(JSON.stringify(model),before);
  const tall=arch.layout(arch.parse('architecture "Tall" {model {system node "A long title that needs several lines" {description "A detailed description repeated to require extra room in this small card."}} view v "V" {style node {fontSize 32 width 160 height 96}}}')).nodes[0];
  assert.ok(tall.height>96,'minimum height expands to fit the chosen font and content');
  for(const id of ['uaf','naf41-uaf'])arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
  const clustered=await readFile('examples/naf41-clusters.arch','utf8');
  assert.equal(arch.validate(clustered).valid,true);
  const clusterGraph=arch.layout(arch.parse(clustered));
  assert.equal(clusterGraph.nodes.find(n=>n.id==='f1').parent,'air');
  assert.equal(clusterGraph.nodes.find(n=>n.id==='f1').width,280);
  assert.equal(clusterGraph.nodes.find(n=>n.id==='c').height,140);
  assert.equal(clusterGraph.referenceNodes.length,2);
  assert.ok(clusterGraph.referenceNodes.every(o=>o.node.id==='i'&&o.explicit));
  xml(arch.renderToString(clustered));
});

test('node style rejects invalid font/dimension values and unsupported renderer overrides',()=>{
  for(const style of ['fontSize 5','fontSize 65','fontSize "14"','width 159','height 95','width -1','height 10000001'])
    assert.equal(arch.validate(`architecture "Invalid" {model {system node "Node"} view v "V" {style node {${style}}}}`).valid,false,style);
  const specialized='architecture "Special" {model {system node "Node"} view v "V" {diagram class style node {fontSize 14}}}';
  assert.equal(arch.validate(specialized).valid,false);
});
