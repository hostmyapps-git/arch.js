import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';
const source=await readFile('examples/diagrams.arch','utf8');
const model=arch.parse(source);
const invalid=source=>assert.equal(arch.validate(source).valid,false);
const xml=svg=>new DOMParser({onError:(level,message)=>{throw Error(message);}}).parseFromString(svg,'image/svg+xml');

test('seven independent diagram layouts export safe SVG in both themes and retain immutable model semantics',()=>{
  assert.equal(model.views.length,7);const before=JSON.stringify(model);
  for(const view of model.views) for(const theme of ['light','dark']) {
    const graph=arch.layout(model,{view:view.id}),svg=arch.renderToString(model,{view:view.id,theme,idPrefix:'diagram-test'});
    assert.equal(xml(svg).documentElement.getAttribute('data-diagram'),view.diagram.type);
    assert.ok(Number.isFinite(graph.bounds.width)&&graph.bounds.width>0);
    assert.ok(Number.isFinite(graph.bounds.height)&&graph.bounds.height>0);
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
  }
  assert.equal(JSON.stringify(model),before);
  assert.equal(arch.validate(JSON.parse(before)).valid,true);
  assert.match(arch.renderMarkdown('```arch\n'+source+'\n```'),/data-diagram="sequence"/);
  for(const type of ['sequence','state','activity','matrix','heatmap','timeline','class']) {
    const empty=`architecture "Empty" {model {} view v "V" {diagram ${type} ${type==='heatmap'?'{valueAttribute score}':''}}}`;
    xml(arch.renderToString(empty));
  }
});

test('class property fields display real scalar/list/reference values, preserve zero/false and escape text',()=>{
  const profile={nodeTypes:{item:{attributes:{count:{type:'integer'},enabled:{type:'boolean'},note:{},links:{type:'reference',many:true,targets:['item']}}}}};
  const source='architecture "Values" {model {item a "A" {count 0 enabled false note "<script>&" links [b]} item b "B"} view v "V" {diagram class {propertyFields [count, enabled, note, links]}}}';
  for(const theme of ['light','dark']) {
    const svg=arch.renderToString(source,{profile,theme});
    const d=xml(svg), text=d.documentElement.textContent;
    for(const value of ['count: 0','enabled: false','note: <script>&','links: [b]']) assert.ok(text.includes(value),value);
    assert.equal(d.getElementsByTagName('script').length,0);
    const cards=[...d.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-class-card'));
    assert.equal(cards.length,2);
    assert.ok(!cards[1].textContent.includes('PROPERTIES'),'missing optional values do not produce empty rows');
  }
  for(const fields of ['count, count','missing','loc']) assert.equal(arch.validate(source.replace('count, enabled, note, links',fields),{profile}).valid,false);
});

test('sequence honors ordered messages, explicit participants, return/async styles and self messages',()=>{
  const doc=xml(arch.renderToString(model,{view:'interaction'}));
  const messages=[...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-message'));
  assert.deepEqual(messages.map(g=>g.getAttribute('data-edge')),['request','save','ack','audit','response']);
  assert.deepEqual(messages.map(g=>g.getAttribute('data-message-kind')),['sync','sync','return','async','return']);
  invalid(source.replace('participants [client, api, store]','participants [client, api]'));
  invalid(source.replace('returns [ack, response]','returns [ack, response, audit]'));
  invalid(source.replace('messages [request, save, ack, audit, response]','messages [request, request]'));
});

test('state and activity validate initial/final flow, decision degrees and ownership of swimlanes',()=>{
  invalid(source.replace('initial ready','initial closed'));
  invalid(source.replace('owner crew','owner mission'));
  invalid(source.replace('decisions [decision]','decisions [assess]'));
  invalid(source.replace('decisions [decision]','decisions [decision] forks [decision]'));
  assert.match(arch.renderToString(model,{view:'workflow'}),/data-state="decision"/);
  assert.match(arch.renderToString(source.replace('decisions [decision]','forks [decision]'),{view:'workflow'}),/data-state="decision"/);
  const d=xml(arch.renderToString(model,{view:'states'}));
  const states=[...d.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-state-kind'));
  assert.deepEqual(states.map(g=>g.getAttribute('data-state-kind')),['initial','state','final']);
  assert.deepEqual(states.map(g=>g.getElementsByTagName('circle').length),[1,0,2]);
  const path=id=>[...d.getElementsByTagName('g')].find(g=>g.getAttribute('data-edge')===id)
    .getElementsByTagName('path')[0].getAttribute('d').match(/[\d.]+/g).map(Number);
  const circle=(group,edge)=>{
    const point=group.getElementsByTagName('circle')[0];
    return [+point.getAttribute('cx'),+point.getAttribute('cy')+edge*+point.getAttribute('r')];
  };
  assert.deepEqual(path('activate').slice(0,2),circle(states[0],1));
  assert.deepEqual(path('finish').slice(-2),circle(states[2],-1));

  const sideEntry=source.replace('item closed "Closed"','item suspended "Suspended" item closed "Closed"')
    .replace('include ready, active, closed','include ready, active, suspended, closed');
  const sideDoc=xml(arch.renderToString(sideEntry,{view:'states'}));
  const finish=[...sideDoc.getElementsByTagName('g')].find(g=>g.getAttribute('data-state-kind')==='final');
  const outer=finish.getElementsByTagName('circle')[0], title=finish.getElementsByTagName('text')[0];
  assert.equal(title.getAttribute('text-anchor'),'end');
  assert.ok(+title.getAttribute('x')<+outer.getAttribute('cx')-+outer.getAttribute('r'));
});

test('final accepts both list forms in state and activity and normalizes legacy inputs',()=>{
  for (const type of ['state','activity']) {
    const doc=options=>`architecture "End nodes" {
      model {application start "Start" application running "Running" application done "Done" application cancelled "Cancelled"
        relation begin start -> running "" relation accept running -> done "Accept" relation cancel running -> cancelled "Cancel"}
      view v "V" { diagram ${type} { initial start ${options} } }
    }`;
    const opts={idPrefix:'final'}, canonical=doc('final done, cancelled');
    const expected=arch.renderToString(canonical,opts);
    const rendered=[...xml(expected).getElementsByTagName('g')].filter(g=>g.hasAttribute('data-state'));
    assert.deepEqual(rendered.map(g=>g.getElementsByTagName('circle').length),[1,0,2,2]);
    for (const spelling of ['final [done, cancelled]','finals [done, cancelled]']) {
      assert.equal(arch.renderToString(doc(spelling),opts),expected);
      assert.equal(arch.translate(doc(spelling)),arch.translate(canonical));
    }
    assert.deepEqual(arch.parse(doc('final done')).views[0].diagram.final,['done']);
    assert.deepEqual(arch.parse(doc('final []')).views[0].diagram.final,[]);
    const legacyJSON=JSON.parse(arch.translate(canonical));
    const legacy=legacyJSON.architecture.views.v.diagram;
    legacy.finals=legacy.final; delete legacy.final;
    assert.match(arch.translate(legacyJSON),/\bfinal \[done, cancelled\]/);
    assert.equal(arch.renderToString(legacyJSON,opts),expected);
    const legacyModel=arch.parse(canonical);
    const diagram=legacyModel.views[0].diagram;
    diagram.finals=diagram.final; delete diagram.final;
    assert.equal(arch.renderToString(legacyModel,opts),expected);
    assert.equal(Object.hasOwn(diagram,'final'),false);
    assert.match(arch.validate(doc('final done finals [cancelled]')).diagnostics[0].message,/Duplicate diagram option: final/);
    assert.match(arch.validate(doc('final [done, done]')).diagnostics[0].message,/final requires a list of unique values/);
    assert.match(arch.validate(doc('final running')).diagnostics[0].message,/Final nodes cannot have outgoing transitions/);
  }
});

test('virtual state points stay in their view and can be placed relative to states and each other',()=>{
  const input=`architecture "Boundaries" {
    model {application waiting "Waiting" application active "Active" application stop "Stop"
      relation work waiting -> active "Go"}
    view v "V" {
      diagram state {
        initial virtual "start" "Begin" -> waiting
        final waiting -> virtual end { event stop }
        final active -> virtual another
      }
      place virtual start at (-90, waiting.y - 20)
      place virtual end at (start.x + 660, 320)
    }
    view modelOnly "Model" { include waiting, active }
  }`;
  const model=arch.parse(input), before=JSON.stringify(model), graph=arch.layout(model,{view:'v'});
  const find=id=>graph.nodes.find(node=>node.id===id);
  assert.equal(find('start').x,-90);
  assert.equal(find('start').y,find('waiting').y-20);
  assert.equal(find('end').x,570);
  assert.equal(find('end').y,320);
  assert.equal(find('another').virtual,'final');
  assert.equal(find('stop'),undefined);
  assert.equal(graph.edges.find(edge=>edge.target==='end').stateEvent,'Stop');
  assert.equal(graph.edges.find(edge=>edge.source==='start').target,'waiting');
  assert.ok(graph.bounds.x<-90);
  assert.deepEqual(arch.layout(model,{view:'modelOnly'}).nodes.map(node=>node.id),['waiting','active']);
  assert.equal(JSON.stringify(model),before);
  const options={view:'v',idPrefix:'virtual'}, json=arch.translate(input);
  assert.equal(arch.renderToString(json,options),arch.renderToString(input,options));
  assert.match(arch.translate(json),/place virtual start at \(-90, waiting\.y - 20\)/);
  for (const [old,replacement,message] of [
    ['event stop','event absent',/Unknown virtual transition event/],
    ['-> waiting','-> absent',/Unknown or hidden state/],
    ['virtual another','virtual end',/Duplicate virtual point ID/],
    ['place virtual end','place virtual absent',/Unknown virtual point/],
    ['at (-90, waiting.y - 20)','at (end.x, 0)',/Circular placement dependency/],
    ['initial virtual "start"','initial waiting initial virtual "start"',/Duplicate diagram option: initial/],
  ]) assert.match(arch.validate(input.replace(old,replacement)).diagnostics[0].message,message);
});

test('positioned states share placement expressions with virtual points and keep labels and loops',()=>{
  const input=`architecture "Placed states" {
    model {application waiting "Waiting" application active "Active" application free "Unplaced"
      relation go waiting -> active "Start work" relation again active -> active "Retry"}
    view v "V" {
      diagram state {initial virtual start -> waiting final active -> virtual end}
      place waiting at (36, 42)
      place active at (waiting.right + 300, start.y + 200)
      place virtual start at (waiting.centerX - 10, waiting.y - 100)
      place virtual end at (active.right + 80, active.y)
    }
  }`;
  const graph=arch.layout(input), node=id=>graph.nodes.find(n=>n.id===id);
  assert.deepEqual([node('waiting').x,node('waiting').y],[36,42]);
  assert.deepEqual([node('active').x,node('active').y],[556,142]);
  assert.ok(node('free').x>=node('waiting').x+node('waiting').width);
  assert.ok(graph.bounds.y<-58);
  const options={idPrefix:'placed-state'}, svg=arch.renderToString(input,options), rendered=xml(svg);
  const edges=[...rendered.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-edge'));
  assert.equal(edges.find(e=>e.getAttribute('data-edge')==='go').getElementsByTagName('tspan')[0].textContent,'Start work');
  const loop=edges.find(e=>e.getAttribute('data-edge')==='again').getElementsByTagName('path')[0].getAttribute('d').split(' ');
  assert.notEqual(loop[2],loop.at(-1));
  assert.equal(arch.renderToString(arch.translate(input),options),svg);
  assert.match(arch.validate(input.replace('36, 42','active.x, 42')).diagnostics[0].message,/Circular placement dependency/);
  assert.match(arch.validate(input.replace('place waiting','style waiting {display none} place waiting')).diagnostics[0].message,/Unknown or hidden state/);
  const isolated=arch.layout('architecture "Alone" {model {application a "A"} view v "V" {diagram state place a at (10000,-2000)}}');
  assert.deepEqual(isolated.bounds,{x:9980,y:-2020,width:260,height:108});
});

test('state routes honor virtual and modeled ports, formulas and ordered waypoints',()=>{
  const input=`architecture "Routes" {
    model {application waiting "Waiting" application active "Active" application stop "Stop"
      relation virtual waiting -> active "Start work"}
    view v "V" {
      diagram state {initial virtual start -> waiting final active -> virtual end {event stop}}
      place waiting at (0, 70)
      place active at (300, 230)
      place virtual start at (-120, -50)
      place virtual end at (610, 248)
      route virtual "start" {
        curve orthogonal
        from bottom to top 1/4
        via (start.centerX, waiting.y - 60), (waiting.x + waiting.width/4, waiting.y - 60)
      }
      route virtual {
        curve orthogonal
        from (waiting.right, waiting.centerY) to top (waiting.width/active.width)/2
        via (active.centerX, waiting.centerY)
      }
      route virtual end { from right to left 3/4 }
    }
    view inherited "Inherited" {
      extends v
      route virtual start { to top 1/2 }
    }
  }`;
  const options={view:'v',idPrefix:'state-routes'};
  const svg=arch.renderToString(input,options);
  const path=(markup,id)=>{
    const group=[...xml(markup).getElementsByTagName('g')].find(g=>g.getAttribute('data-edge')===id);
    const commands=group.getElementsByTagName('path')[0].getAttribute('d');
    return [...commands.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(([,x,y])=>[+x,+y]);
  };
  const start=path(svg,'@virtual:start');
  assert.deepEqual(start, [[-110,-30],[-110,10],[55,10],[55,70]]);
  const transition=path(svg,'virtual');
  assert.deepEqual(transition[0],[220,104]);
  assert.deepEqual(transition.at(-1),[410,230]);
  assert.ok(transition.some(([x,y])=>x===410&&y===104));
  const end=path(svg,'@virtual:end');
  assert.deepEqual(end[0],[520,264]);
  assert.deepEqual(end.at(-1),[612.144,272]);
  assert.match(svg,/aria-label="Event: Stop"/);
  const inherited=path(arch.renderToString(input,{...options,view:'inherited'}),'@virtual:start');
  assert.deepEqual(inherited.at(-1),[110,70]);
  assert.ok(inherited.some(([x,y])=>x===55&&y===10));
  assert.equal(arch.renderToString(arch.translate(input),options),svg);
  assert.match(arch.translate(arch.translate(input)),/route virtual start \{/);
  for (const [from,to,error] of [
    ['route virtual "start"','route virtual absent',/Unknown virtual point: absent/],
    ['start.centerX, waiting.y','missing.centerX, waiting.y',/Unknown via reference: missing/],
    ['from right to left 3/4','from right to left 3/4 color red',/State routes support from, to, via and curve/],
    ['from bottom to top 1/4','from bottom to top waiting.width/2',/must be between 0 and 1/],
  ]) assert.throws(()=>arch.renderToString(input.replace(from,to),options),error);
});

test('state routing can extend the frame without manual placements',()=>{
  const input=`architecture "Frame" {
    model {application a "A" application b "B"}
    view v "V" {
      diagram state {initial virtual start -> a}
      route virtual start {from left to top via (-500, -200)}
    }
  }`;
  const {bounds}=arch.layout(input);
  assert.ok(bounds.x < -500 && bounds.y < -200);
  assert.match(arch.renderToString(input),/Q -500 -200/);
  assert.match(arch.validate(input.replace('diagram state {initial virtual start -> a}','diagram connected')).diagnostics[0].message,
    /Virtual routes require a state diagram/);
});

test('state curve variants distinguish lines, elbows and cubic controls for modeled and virtual transitions',()=>{
  const input=`architecture "Curves" {
    model {application a "A" application b "B" application stop "Stop"
      relation next a -> b "Next" relation again b -> b "Try again"}
    view v "V" {
      diagram state {initial virtual start -> a final b -> virtual end {event stop}}
      place a at (0, 0)
      place b at (320, 180)
      place virtual start at (-120, -80)
      place virtual end at (620, 200)
      route virtual start {from right to top curve straight}
      route next {from right to left curve straight via (a.right + 50, 140)}
      route again {curve rounded}
      route virtual end {from right to left curve bezier via (b.right + 30, -600), (end.x - 25, -600)}
    }
  }`;
  const options={idPrefix:'state-curves'}, svg=arch.renderToString(input,options);
  assert.match(svg,/data-edge="@virtual:start"[^>]*><path d="M -100 -70 L 110 0"/);
  assert.match(svg,/data-edge="next"><path d="M 220 34 L 270 140 L 320 214"/);
  assert.match(svg,/data-edge="again"><path d="M [^"]* Q [^"]*"/);
  assert.match(svg,/data-edge="@virtual:end"[^>]*><path d="M 540 214 C 570 -600 595 -600 620 216"/);
  assert.match(svg,/aria-label="Event: Stop"/);
  const {y}=arch.layout(input).bounds;
  assert.ok(y < -400 && y > -500);
  assert.equal(arch.renderToString(arch.translate(input),options),svg);
  assert.equal(arch.renderToString(input.replace('route again {curve rounded}', ''),options),svg);
  const automatic=input.replace('via (b.right + 30, -600), (end.x - 25, -600)','')
    .replace('route again {curve rounded}','route again {curve bezier}');
  const automaticSVG=arch.renderToString(automatic,options);
  assert.match(automaticSVG,/data-edge="@virtual:end"[^>]*><path d="M 540 214 C [^"]* 620 216"/);
  assert.match(automaticSVG,/data-edge="again"><path d="M [^"]* C [^"]*"/);
  const orthogonal=arch.renderToString(input.replace('curve straight via','curve orthogonal via'),options);
  assert.doesNotMatch(orthogonal,/data-edge="next"><path d="M 220 34 L 270 140 L 320 214"/);
  assert.match(arch.validate(input.replace(', (end.x - 25, -600)','')).diagnostics[0].message,/exactly two control points/);
  assert.match(arch.validate(input.replace('curve straight via (a.right','curve bezier via (a.right')).diagnostics[0].message,/exactly two control points/);
});

test('another profile can name its own state trigger attribute and keep an isolated state',()=>{
  const input=`architecture "Events" {
    config {
      type state {}
      type signal {}
      relation step {from state to state stateTrigger signal attribute signal {type reference targets signal}}
      relation advance {extends step}
    }
    model {
      state a "Open" state b "Closed" state c "Paused" signal close "Close"
      relation closeDoor a -> b "" {type advance signal close}
    }
    view states "States" { diagram state }
  }`;
  const graph=arch.layout(input);
  assert.deepEqual(graph.nodes.map(node=>node.id),['a','b','c']);
  assert.equal(graph.edges[0].stateCaption,'Close');
  const svg=arch.renderToString(arch.translate(input));
  assert.match(svg,/data-state-event="true" aria-label="Event: Close"/);
  assert.match(svg,/<tspan[^>]*>Close<\/tspan>/);
  const hidden=arch.layout(input.replace('diagram state','diagram state style closeDoor {display none}'));
  assert.deepEqual(hidden.nodes.map(node=>node.id),['a','b','c']);
  assert.equal(hidden.edges.length,0);
  assert.match(arch.validate(input.replace('stateTrigger signal','stateTrigger missing')).diagnostics[0].message,/must be a reference attribute/);
});

test('activity flow rows follow typed control edges, align branches across lanes and group cycles',()=>{
  const input = `architecture "Flow ranks" {
    config {
      type item { attribute owner { type reference targets item } }
      relation control { activityFlow true }
      relation step { extends control }
      relation context { extends control activityFlow false }
      defaultRelation step
    }
    model {
      item left "Left" item right "Right"
      item alone "Context" { owner left }
      item branchA "Branch A" { owner left }
      item branchB "Branch B" { owner right }
      item branchC "Branch C" { owner right }
      item cycleA "Cycle A" { owner left }
      item cycleB "Cycle B" { owner right }
      item join "Join" { owner left }
      item start "Start" { owner left }
      relation toA start -> branchA ""
      relation toB start -> branchB ""
      relation toC start -> branchC ""
      relation direct branchA -> join ""
      relation enter branchB -> cycleB ""
      relation retry cycleB -> cycleA ""
      relation loop cycleA -> cycleB ""
      relation finish cycleA -> join ""
      relation another branchC -> join ""
      relation note join -> branchA "Context" { type context }
      relation across branchB -> branchA "Same level" { type context }
    }
    view lanes "Ranks" { diagram activity { lanes [left,right] } }
  }`;
  const options = {idPrefix:'flow'};
  const positions = input => Object.fromEntries(arch.layout(input).nodes.filter(n=>n.attributes?.owner).map(n=>[n.id,n.y]));
  const rows = positions(input);
  assert.deepEqual(rows,{alone:965,branchA:240,branchB:240,branchC:385,cycleA:530,cycleB:675,join:820,start:95});
  const explicit = input.replace('lanes [left,right]','lanes [left,right] layout flow');
  assert.deepEqual(positions(explicit),rows);
  assert.equal(arch.renderToString(arch.translate(explicit),options),arch.renderToString(input,options));
  const legacy = input.replace('lanes [left,right]','lanes [left,right] layout model');
  assert.deepEqual(positions(legacy),{alone:95,branchA:240,branchB:385,branchC:530,cycleA:675,cycleB:820,join:965,start:1110});
  assert.deepEqual(positions(input.replace('activityFlow true','activityFlow false')),positions(legacy));
  const hidden = input.replace('view lanes "Ranks" {','view lanes "Ranks" { style toC { display none }');
  assert.equal(positions(hidden).branchC,rows.start);
  assert.match(arch.renderToString(input,options),/data-edge="across"><path d="M 395 280 L 340 280 L 285 280"/);
  assert.match(arch.validate(input.replace('lanes [left,right]','lanes [left,right] layout random')).diagnostics[0].message,/auto, flow or model/);
  assert.match(arch.validate(input.replace('activityFlow true','activityFlow "yes"')).diagnostics[0].message,/activityFlow must be boolean/);
});

test('swimlanes restore automatic forward, return and loop paths and accept view-local waypoints',()=>{
  const view = 'decisions [decision] }';
  const input = source.replace('relation cancelled cancel -> end ""', `relation cancelled cancel -> end ""
    relation retryDispatch dispatch -> assess "Return"
    relation auditDispatch dispatch -> dispatch "Retry"`);
  const options = {view:'workflow',idPrefix:'swimlane'};
  const edgePath = (svg,id) => [...xml(svg).getElementsByTagName('g')]
    .find(group => group.getAttribute('data-edge') === id).getElementsByTagName('path')[0].getAttribute('d');
  const automatic = arch.renderToString(input,options);
  assert.equal(edgePath(automatic,'rejected'),'M 175 465 L 175 570 L 175 675');
  assert.equal(edgePath(automatic,'retryDispatch'),'M 395 570 L 25 570 L 25 280 L 65 280');
  assert.equal(edgePath(automatic,'auditDispatch'),'M 615 550 L 660 550 L 660 600 L 615 600');

  const routed = input.replace(view,`${view}
    route approved { via (ops.right + 30, decision.bottom + 24), (dispatch.centerX, decision.bottom + 24) }
    route retryDispatch { via (-80, dispatch.centerY), (-80, assess.centerY) }`);
  const svg = arch.renderToString(routed,options);
  assert.equal(edgePath(svg,'approved'),'M 175 465 L 175 489 L 385 489 L 505 489 L 505 530');
  assert.equal(edgePath(svg,'retryDispatch'),'M 395 570 L -80 570 L -80 280 L 65 280');
  assert.equal(edgePath(svg,'rejected'),edgePath(automatic,'rejected'));
  assert.equal(arch.layout(routed,options).bounds.x,-100);
  assert.equal(arch.renderToString(arch.translate(routed),options),svg);
  assert.match(arch.validate(routed.replace('ops.right','missing.right')).diagnostics[0].message,/Unknown via reference: missing/);
  assert.match(arch.validate(routed.replace('route approved { via','route approved { curve straight via')).diagnostics[0].message,/Swimlane routes support from, to and via/);

  const ports = input.replace(view,`${view}
    route approved { from right 1/4 to top (dispatch.right - dispatch.x) / dispatch.width * 0.75 }
    route retryDispatch { from (dispatch.x, dispatch.centerY) to left (assess.centerY - assess.y) / assess.height
      via (-80, dispatch.centerY), (-80, assess.centerY) }
    route rejected { from (decision.centerX, decision.bottom) to auto }`);
  const portSvg = arch.renderToString(ports,options);
  assert.match(edgePath(portSvg,'approved'),/^M 225 405 L [\d.]+ 405 .*L 560 530$/);
  assert.equal(edgePath(portSvg,'retryDispatch'),'M 395 570 L -80 570 L -80 280 L 65 280');
  assert.match(edgePath(portSvg,'rejected'),/^M 175 465 .*L 175 675$/);
  assert.equal(arch.renderToString(arch.translate(ports),options),portSvg);
  assert.throws(()=>arch.layout(ports.replace('* 0.75','* 1.25'),options),/Port position for to top must be between 0 and 1/);
});

test('matrix counts directed and parallel edges and filters relationship types',()=>{
  const doc=xml(arch.renderToString(model,{view:'mapping'}));
  const cells=[...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-cell'));
  assert.equal(cells.length,6);
  assert.match(cells.find(g=>g.getAttribute('data-cell')==='api:rescue').textContent,/Enables/);
  invalid(source.replace('rows [api, store]','rows [missing]'));
  const parallel=source.replace('relation enables api -> rescue "Enables"','relation enables api -> rescue "Enables" relation extra api -> rescue "More"');
  const d=xml(arch.renderToString(parallel,{view:'mapping'}));
  const cell=[...d.getElementsByTagName('g')].find(g=>g.getAttribute('data-cell')==='api:rescue');
  assert.equal(cell.getElementsByTagName('tspan')[0].textContent,'2');
});

test('heatmap has a real hierarchy, numeric scale, missing values, and rejects cycles and invalid ranges',()=>{
  const doc=xml(arch.renderToString(model,{view:'assessment'}));
  assert.equal([...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-tile')).length,5);
  assert.match(doc.documentElement.textContent,/No value/);
  invalid(source.replace('maturity 3','maturity 8'));
  invalid(source.replace('parentCapability rescue maturity 4','parentCapability maritime maturity 4'));
  invalid(source.replace('min 0 max 5','min 5 max 0'));
  invalid(source.replace('valueAttribute maturity','valueAttribute title'));
});

test('timeline preserves dates, draws milestones and dependencies, and rejects missing/reversed periods',()=>{
  const doc=xml(arch.renderToString(model,{view:'delivery'}));
  const groups=[...doc.getElementsByTagName('g')];
  const rows=groups.filter(g=>g.hasAttribute('data-bar'));
  assert.deepEqual(rows.map(g=>g.getAttribute('data-bar')),['phase1','phase2','milestone']);
  assert.equal(rows[0].getElementsByTagName('rect')[0].getAttribute('rx'),'5');
  assert.match(rows[2].getElementsByTagName('path')[0].getAttribute('d'),/Z$/);
  assert.deepEqual(groups.filter(g=>g.hasAttribute('data-edge')).map(g=>g.getAttribute('data-edge')),['rollout','operational']);
  const labels=[...doc.getElementsByTagName('text')].map(t=>t.textContent);
  assert.ok(labels.includes('Jan')&&labels.includes('Mar')&&labels.includes('Sep'));
  assert.ok(labels.includes('1 Jan – 1 Apr 2026'));
  assert.match(doc.documentElement.textContent,/2026-10-01/);
  invalid(source.replace('start "2026-01-01"','start "2027-01-01"'));
  invalid(source.replace('start "2026-01-01"',''));
});

test('timeline fits short ranges, a single milestone and multi-year dates without degenerate axes',()=>{
  const chart=(start,end)=>arch.renderToString(`architecture "Dates" {
    config { type item { attribute start { type string } attribute end { type string } } }
    model { item row "Plan" { start "${start}" end "${end}" } }
    view v "Schedule" { diagram timeline }
  }`);
  const labels=svg=>[...xml(svg).getElementsByTagName('text')].map(t=>t.textContent);
  const point=chart('2030-06-01','2030-06-01');
  assert.ok(labels(point).includes('1 Jun 2030'));
  assert.ok(labels(point).includes('30 May')&&labels(point).includes('3 Jun'));
  const clock=chart('2030-06-01T12:00:00Z','2030-06-01T12:00:04Z');
  assert.ok(labels(clock).includes('12:00:04'));
  assert.ok(labels(clock).includes('1 Jun 2030 · 12:00:00–12:00:04 UTC'));
  const long=chart('2026-01-01','2034-01-01');
  assert.ok(labels(long).includes('2028')&&labels(long).includes('2032'));
  for(const svg of [point,clock,long])assert.doesNotMatch(svg,/NaN|Infinity/);
});

test('class compartments, signatures, owned parameters and visible interface ports are explicit and validated',()=>{
  const svg=arch.renderToString(model,{view:'details'});
  for(const heading of ['ATTRIBUTES','METHODS','FUNCTIONS','INTERFACES','PORTS']) assert.match(svg,new RegExp(heading));
  assert.match(svg,/target: Location/);
  invalid(source.replace('owner launch','owner repository'));
  invalid(source.replace('attributes [identifier, status]','attributes [identifier, status, launch]'));
});

test('diagram options reject unknown fields, unsafe colors, manual routing, and invisible references without weakening profiles',()=>{
  invalid(source.replace('diagram sequence','diagram unknown'));
  invalid(source.replace('participants [client, api, store]','anything true'));
  invalid(source.replace('diagram sequence {','place client at (0,0) diagram sequence {'));
  invalid(source.replace('min 0 max 5','min 0 max 5 colorLow "url(x)"'));
  invalid(source.replace('methods [launch]','methods [invisible]'));
  assert.equal(arch.validate(source,{profile:'default'}).valid,false);
  const hostile=source.replace('Rescue operator','Operator & <script>alert(1)</script>');
  const svg=arch.renderToString(hostile);assert.ok(!svg.includes('<script>'));xml(svg);
});

test('both shipped bundles expose all seven renderers identically',async()=>{
  const expected=model.views.map(v=>arch.renderToString(source,{view:v.id,idPrefix:'stable'}));
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    const output=model.views.map(v=>context.arch.renderToString(source,{view:v.id,idPrefix:'stable'}));
    assert.deepEqual(output,expected);
  }
});

test('table renders typed custom values and guards against unknown columns',()=>{
  const profile={nodeTypes:{item:{attributes:{value:{type:'number'},enabled:{type:'boolean'},note:{}}}}};
  const input='architecture "Values" {model {item a "A" {value 0 enabled false note "<note>"}} view data "Data" {diagram table {fields [title, value, enabled, note]}}}';
  const svg=arch.renderToString(input,{profile});
  for(const text of ['0','false','<note>']) assert.ok(xml(svg).documentElement.textContent.includes(text));
  assert.match(svg,/data-diagram="table"/);
  assert.throws(()=>arch.renderToString(input.replace('enabled, note]','enabled, typo]'),{profile}),/Unknown table field typo/);
});

test('Sankey uses consistent weights, supports rank skips and diagnoses cycles',()=>{
  const profile={nodeTypes:{item:{}},relationTypes:{flow:{attributes:{amount:{type:'number',required:true}}}}};
  const nodes='item a "A" item b "B" item c "C"';
  const link=(id,a,b,w)=>`relation ${id} ${a} -> ${b} "" {type flow amount ${w}}`;
  const model=(...edges)=>`architecture "Flow" {model {${nodes} ${edges.join(' ')}} view v "Flow" {diagram sankey {weightAttribute amount}}}`;
  const input=model(link('ab','a','b',2),link('bc','b','c',2),link('ac','a','c',1));
  const svg=arch.renderToString(input,{profile,idPrefix:'flow'});
  assert.equal(arch.renderToString(arch.translate(input,{profile}),{profile,idPrefix:'flow'}),svg);
  const widths=Object.fromEntries([...svg.matchAll(/data-edge="([^"]+)"[^>]+stroke-width="([^"]+)"/g)].map(([,id,w])=>[id,+w]));
  assert.ok(Math.abs(widths.ab-2*widths.ac)<0.02);
  assert.throws(()=>arch.renderToString(model(link('ab','a','b',2),link('ba','b','a',1)),{profile}),/acyclic/);
  assert.throws(()=>arch.renderToString(model(link('ab','a','b',0)),{profile}),/positive numeric weight/);
});
