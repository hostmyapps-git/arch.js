import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as arch from '../src/arch.js';

const source = `architecture "Repeated views" {
  model {
    service actor "Actor"
    service recipient "Recipient"
    service note "Note"
    relation inside actor -> recipient "Internal"
    relation outside note -> actor "External"
  }
  view row "Row" {
    include [actor, recipient]
    style actor { width 280 }
    place actor at (0, 0)
    place recipient at (400, 0)
    route inside { curve straight }
  }
  view only "Unique" {
    embed row as one
  }
  view host "Host" {
    embed row as sub1
    embed row as sub2
    include [note]
    place sub1 at (0, 0)
    place sub2 at (0, sub1.bottom + 40)
    place note at (sub2.actor.right + 40, sub2.actor.y)
    style note { width sub2.actor.style.width + 20 }
    route outside { target sub2.actor from left to right via (sub2.actor.right + 10, sub2.actor.centerY) curve straight }
  }
}`;
const node = (graph, id) => graph.nodes.find(card => card.id === id);
const options = { view:'host', idPrefix:'repeat' };

test('overlapping embeds share model IDs while placement and routing address individual cards', () => {
  const parsed = arch.parse(source), snapshot = JSON.stringify(parsed);
  assert.equal(parsed.nodes.filter(element => element.id === 'actor').length, 1);
  const graph = arch.layout(parsed, options);
  assert.equal(JSON.stringify(parsed), snapshot);
  assert.deepEqual(graph.nodes.filter(card => card.modelId === 'actor').map(card => card.id), ['sub1.actor','sub2.actor']);
  assert.deepEqual(graph.embeddingGroups.map(group => group.bounds.y), [0, graph.embeddingGroups[0].bounds.height + 40]);
  assert.equal(node(graph, 'note').y, node(graph, 'sub2.actor').y);
  assert.equal(node(graph, 'note').x, node(graph, 'sub2.actor').x + node(graph, 'sub2.actor').width + 40);
  assert.equal(node(graph, 'note').width, 300);
  assert.deepEqual(graph.edges.map(edge => [edge.id,edge.source,edge.target]), [
    ['sub1.inside','sub1.actor','sub1.recipient'],
    ['sub2.inside','sub2.actor','sub2.recipient'],
    ['outside','note','sub2.actor']
  ]);
  assert.equal(graph.edges[2].points.at(-1).x, node(graph, 'sub2.actor').x + node(graph, 'sub2.actor').width);
  assert.deepEqual(graph.edges[2].points[1], {
    x:node(graph, 'sub2.actor').x + node(graph, 'sub2.actor').width + 10,
    y:node(graph, 'sub2.actor').y + node(graph, 'sub2.actor').height / 2
  });
  assert.ok(node(arch.layout(source,{view:'only'}), 'actor'));
  const svg = arch.renderToString(source, options);
  assert.match(svg, /data-node="sub2.actor" data-model-id="actor"/);
  assert.match(svg, /data-edge="sub1.inside" data-model-id="inside"/);
  const json = arch.translate(source, {format:'json'});
  assert.equal(JSON.parse(json).architecture.views.host.route.outside.target, 'sub2.actor');
  assert.equal(arch.renderToString(json, options), svg);
  assert.equal(arch.renderToString(arch.translate(json), options), svg);
});

test('ambiguous handles and mismatched routing endpoints fail during validation', () => {
  for (const [input, pattern] of [
    [source.replace('sub2.actor.right + 40', 'actor.right + 40'), /Ambiguous card reference: actor.*sub1.actor.*sub2.actor/],
    [source.replace('target sub2.actor ', ''), /Ambiguous card reference: actor.*sub1.actor.*sub2.actor/],
    [source.replace('target sub2.actor', 'target sub2.recipient'), /target card sub2.recipient must represent actor/],
    [source.replace('sub2.actor.style.width', 'actor.style.width'), /Ambiguous card reference: actor/],
    [source.replace('sub2.actor.right + 10', 'actor.right + 10'), /Ambiguous card reference: actor/],
    [source.replace('place sub1 at (0, 0)', 'place sub1 at (sub1.actor.x, 0)'), /Circular placement dependency/],
    [source.replace('service note', 'service sub2.actor "Collision" service note').replace('include [note]', 'include [note, sub2.actor]'), /Conflicting card address: sub2.actor/]
  ]) {
    const result = arch.validate(input);
    assert.equal(result.valid, false, input);
    assert.match(result.diagnostics[0].message, pattern);
  }
});

test('nested embeds qualify full paths, and only children that show a relation contribute paths', () => {
  const nested = source
    .replace('view host "Host" {', 'view quiet "Quiet" { extends row exclude [inside] }\n  view host "Host" {')
    .replace('embed row as sub1', 'embed quiet as sub1')
    .replace('embed row as sub2', 'embed only as sub2')
    .replaceAll('sub2.actor', 'sub2.one.actor');
  const graph = arch.layout(nested, options);
  assert.ok(node(graph, 'sub2.one.actor'));
  assert.equal(node(graph, 'note').width, 300);
  assert.deepEqual(graph.edges.map(edge => [edge.id,edge.source,edge.target]), [
    ['inside','sub2.one.actor','sub2.one.recipient'],
    ['outside','note','sub2.one.actor']
  ]);
});

test('L3 copies preserve information product cards and independently routed connectors', () => {
  for (const id of ['uaf','naf41-uaf']) arch.registerProfile(id, JSON.parse(readFileSync(`profiles/${id}.json`, 'utf8')));
  const l3 = `architecture "L3" {
    config { profile naf41-uaf views host }
    model {
      LogicalActor unit "Casualty Affected Unit"
      LogicalActor medevac "MEDEVAC"
      InformationProduct report "Situation Report"
      relation flow unit -> medevac "Report" { type LogicalInteraction conveyed [report] }
    }
    view row "Row" { viewpoint L3 route report -> flow { from bottom to 0.5 } }
    view host "Host" {
      viewpoint L3
      embed row as sub1
      embed row as sub2
      place sub1 at (100, 20)
      place sub2 at (100, sub1.bottom + 80)
    }
  }`;
  assert.deepEqual(arch.validate(l3).diagnostics, []);
  const graph = arch.layout(l3);
  assert.deepEqual(graph.referenceNodes.map(ref => [ref.nodeId,ref.edgeId]), [
    ['sub1.report','sub1.flow'],
    ['sub2.report','sub2.flow']
  ]);
  const svg = arch.renderToString(l3);
  assert.match(svg, /data-reference-for="sub2.flow" data-reference-node="sub2.report"/);
  assert.match(svg, /data-node="sub2.report" data-model-id="report"/);
});

test('host edges can choose both endpoint cards and a qualified graphical attachment', () => {
  const profile = {
    nodeTypes: { actor:{}, data:{} },
    relationTypes: { flow:{ attributes:{payload:{type:'reference',targets:['data']}},
      referenceLabels:{payload:'Payload'}, referenceDisplay:'nodes' } }
  };
  const input = `architecture "Cross-embed routing" {
    model {
      actor sender "Sender"
      actor receiver "Receiver"
      data report "Report"
      relation flow sender -> receiver "Flow" { type flow payload report }
    }
    view outgoing "Outgoing" { include [sender, report] }
    view incoming "Incoming" { include [receiver, report] }
    view host "Host" {
      embed outgoing as send1
      embed outgoing as send2
      embed incoming as receive1
      embed incoming as receive2
      route flow { source send2.sender target receive1.receiver from right to left }
      route receive2.report -> flow { from bottom to 1/2 }
    }
  }`;
  const options = { profile, view:'host' };
  const graph = arch.layout(input, options);
  assert.deepEqual(graph.edges.map(edge => [edge.source,edge.target]), [['send2.sender','receive1.receiver']]);
  assert.equal(graph.referenceNodes[0].nodeId, 'receive2.report');
  assert.equal(graph.referenceNodes[0].explicit, true);
  assert.match(arch.validate(input.replace('receive2.report ->', 'report ->'), options).diagnostics[0].message,
    /Ambiguous card reference: report.*send1.report.*receive2.report/);
});
