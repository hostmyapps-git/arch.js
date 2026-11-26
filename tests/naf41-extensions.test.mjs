import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.studio.js';
import { relationshipEndpointIssues } from '../src/profile-validation.js';
import { cases as nafCases, document as nafDocument } from './fixtures/naf41/cases.mjs';
import { cases, document } from './fixtures/naf41-archimate/cases.mjs';

const read = name => readFile(new URL('../'+name,import.meta.url),'utf8');
const json = async name => JSON.parse(await read(name));
for (const id of ['uaf','naf41-uaf','naf41-admbw','archimate-3.2','naf41-archimate'])
  arch.registerProfile(id,await json('profiles/'+id+'.json'));

test('the ADMBw profile preserves all NAFv4.1 fixtures and their projected node and edge sets', () => {
  const base=arch.getProfile('naf41-uaf'), admbw=arch.getProfile('naf41-admbw');
  assert.equal(Object.keys(nafCases).length,47);
  for (const id of Object.keys(nafCases)) {
    const input=nafDocument(id);
    const original=arch.layout(input,{profile:base.id,validation:'strict'});
    const extension=arch.layout(input,{profile:admbw.id,validation:'strict'});
    assert.deepEqual(extension.nodes.map(node=>node.id),original.nodes.map(node=>node.id),id);
    assert.deepEqual(extension.edges.map(edge=>edge.id),original.edges.map(edge=>edge.id),id);
    assert.deepEqual(admbw.viewpoints[id].requiredNodes,base.viewpoints[id].requiredNodes,id);
    assert.deepEqual(admbw.viewpoints[id].requiredRelations,base.viewpoints[id].requiredRelations,id);
    assert.deepEqual(admbw.viewpoints[id].connections,base.viewpoints[id].connections,id);
  }
});

test('the ADMBw audit accounts for all domain stereotypes and separates native endpoint semantics', async () => {
  const audit=await json('profiles/admbw/coverage.json');
  assert.equal(Object.keys(audit.stereotypes).length,318);
  assert.equal(Object.values(audit.counts).reduce((sum,count)=>sum+count,0),318);
  assert.ok(!Object.keys(arch.getProfile('naf41-uaf').viewpoints).includes('R8'));
  const input=await read('examples/naf41-admbw.arch');
  assert.equal(arch.validate(input).valid,true);
  assert.match(arch.renderToString(input,{view:'requirements'}),/data-edge="evaluation"/);
  const invalid=arch.validate(input.replace('measured -> target','target -> measured'));
  assert.equal(invalid.valid,false);
  assert.ok(invalid.diagnostics.some(issue=>issue.message.includes('FulfilmentCriterion')));
  const {nodeTypes,relationTypes:relation}=arch.getProfile('naf41-admbw');
  assert.equal(nodeTypes.ArchitecturalDescription.attributes.approvalDate.format,'date');
  assert.deepEqual(relation.ImplementsProtocol.from,['ProtocolImplementation']);
  assert.deepEqual(relation.ResourceImplementsProtocol.from,['ResourcePerformer']);
  assert.equal(relation.ViewsInArchitecturalDescription.aliasOf,'ContainsView');
  assert.equal(relation.OperationalMessage.sequenceMessage,true);
  assert.equal(relation.InteractionMessage.abstract,true);
});

test('the ArchiMate core applies each binary element pair from the pinned matrix', async () => {
  const {concepts,rows}=await json('profiles/naf41-archimate/matrix.json');
  const mapping={c:'Composition',g:'Aggregation',i:'Assignment',r:'Realization',v:'Serving',a:'Access',
    n:'Influence',o:'Association',t:'Triggering',f:'Flow',s:'Specialization'};
  const {nodeTypes,relationTypes}=arch.getProfile('archimate-3.2');
  assert.equal(Object.keys(nodeTypes).length,61);
  for (const [index,source] of concepts.entries()) {
    if (source==='Relationship') continue;
    const row=rows[index].split(' ');
    for (const [column,target] of concepts.entries()) {
      if (target==='Relationship') continue;
      for (const [code,type] of Object.entries(mapping)) {
        const valid=!relationshipEndpointIssues('edge',type,relationTypes[type],source,target,nodeTypes);
        assert.equal(valid,row[column].includes(code),`${source} → ${target} (${type})`);
      }
    }
  }
});

test('all 47 ArchiMate viewpoints accept an authored scenario and have an audited guide mapping', async () => {
  const report=await json('profiles/naf41-archimate/coverage.json');
  assert.deepEqual(new Set(Object.keys(report.viewpoints)),new Set(Object.keys(nafCases)));
  assert.deepEqual(new Set(Object.keys(cases)),new Set(Object.keys(report.viewpoints)));
  for (const id of Object.keys(cases)) {
    const source=document(id);
    const validated=arch.validate(source,{validation:'strict'});
    assert.deepEqual(validated.diagnostics,[],id);
    assert.equal(validated.valid,true,id);
    assert.match(arch.renderToString(source,{validation:'strict'}),/<svg\b/,id);
    const json=arch.translate(source,{format:'json'});
    assert.deepEqual(arch.validate(json,{validation:'strict'}).diagnostics,[],id);
  }
  const missingService=arch.validate(document('S3',['BusinessService svc "Service"']),{validation:'strict'});
  assert.match(missingService.diagnostics.map(issue=>issue.message).join('\n'),/Missing required node group .*Interface/);
  const groupOnly=arch.validate(document('C3',[
    'Capability cap "Rescue" CapabilityGroup first "First" CapabilityGroup second "Second"',
    'relation supports first -> second "" { type Serving }'
  ]),{validation:'strict'});
  assert.ok(groupOnly.diagnostics.some(issue=>issue.message.includes('Missing required relationship group (Serving, Capability → Capability)')));
  const wrongPair=arch.validate(document('P3',cases.P3.map(line=>line.replace('type Association','type Realization'))),{validation:'strict'});
  assert.ok(wrongPair.diagnostics.some(issue=>issue.message.includes('ResourceInteraction → Protocol')));
});

test('NAF ArchiMate flow attachments and grid work in normal views, JSON and dashboard output', async () => {
  const input=await read('examples/naf41-archimate.arch');
  const flow=arch.renderToString(input,{view:'exchange'});
  assert.match(flow,/data-reference-for="distress" data-reference-node="report"/);
  assert.match(flow,/filled-arrow/);
  const grid=arch.renderToString(arch.translate(input,{format:'json'}),{view:'grid'});
  assert.match(grid,/data-naf-cell="L3"[^>]+data-product-count="1"/);
  const dashboard=arch.renderDashboardToHTML(input);
  assert.match(dashboard,/ConveyingFlow/);
  const invalid=arch.validate(input.replace('controller, responder, report','controller, responder'));
  assert.ok(invalid.diagnostics.some(issue=>issue.message.includes('report, which must be visible')));
  const nativeAttachment=input.replace('type ConveyingFlow\n      conveyed [report]','type Flow')
    .replace('    ArchitectureDescription','    relation payload report -> distress "conveys" { type Association }\n\n    ArchitectureDescription');
  assert.ok(arch.validate(nativeAttachment).diagnostics.some(issue=>issue.message.includes('Unknown endpoint: distress')));
  const sequence=document('L6',cases.L6.map(line=>line.replace('type Association','type RepresentsParticipant')),
    'diagram sequence { showContext true orderAttribute order }');
  const rendered=arch.renderToString(sequence);
  assert.match(rendered,/data-node="centre"/);
  assert.match(rendered,/data-edge="message" data-message="1"/);
  assert.match(arch.help('viewpoints naf41-archimate L6'),/At least one element/);
});

test('ArchiMate junctions enforce one relationship type and validate the terminal path', () => {
  const model=(relation,target='BusinessProcess')=>`architecture "Junction" {
    config { profile archimate-3.2 }
    model {
      BusinessProcess start "Start" Junction fork "" { kind and } Junction option "" { kind or }
      ${target} result "Result"
      relation incoming start -> fork "" { type Flow }
      relation middle fork -> option "" { type Flow }
      relation outgoing option -> result "" { type ${relation} }
    }
    view diagram "Junction" {}
  }`;
  const svg=arch.renderToString(model('Flow'));
  assert.match(svg,/data-template="junction"/);
  assert.match(svg,/data-node="option"[^>]+>[\s\S]*?<circle cx="8" cy="8" r="7" fill="#fafbfe"/);
  assert.ok(arch.validate(model('Triggering')).diagnostics.some(issue=>issue.message.includes('one type')));
  // Branch endpoints are individually permitted on Junction, but the path
  // cannot create a Flow between a BusinessProcess and an Artifact.
  const invalid=arch.validate(model('Flow','Artifact'));
  assert.ok(invalid.diagnostics.some(issue=>issue.message.includes('Junction path')));
});

test('ArchiMate Access and aggregation preserve their markers in normal SVG', () => {
  const input=`architecture "Notation" {
    config { profile archimate-3.2 }
    model {
      BusinessProcess process "Process" BusinessObject data "Data" Grouping group "Grouping"
      relation read process -> data "" { type Access accessType read }
      relation write process -> data "" { type Access accessType write }
      relation groupLink group -> data "" { type Aggregation }
      relation peer process -> data "" { type Association directed true }
    }
    view notation "Notation" {}
  }`;
  const output=new DOMParser().parseFromString(arch.renderToString(input),'image/svg+xml');
  const path=id=>[...output.getElementsByTagName('g')].find(item=>item.getAttribute('data-edge')===id).toString();
  assert.match(path('read'),/stroke-dasharray="6 5".*marker-start=/);
  assert.doesNotMatch(path('read'),/marker-end=/);
  assert.match(path('write'),/marker-end=/);
  assert.match(path('groupLink'),/marker-start="url\(#[^)]*-open-diamond\)"/);
  assert.match(path('peer'),/marker-end=/);
});
