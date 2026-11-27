import { escape as esc } from './svg-values.js';
import { ArchError } from './errors.js';
import { matches } from './profiles.js';
import { composite, contrast, foreground, normalizeColor, DEFAULT_BACKGROUND_OPACITY } from './colors.js';
import {treeStructure,validateTreeOptions,TREE_OPTIONS} from './tree.js';
import {validatePropertyFields,nodeProperties} from './property-fields.js';
import {positionClassCards} from './class-placement.js';
import {sequenceProjection,drawSequence} from './sequence.js';
import {stateProjection,stateObjectEvents,stateTransitionLabels,validateStatePlacement,appendVirtualStates,drawState} from './state.js';
import { backgroundImageMarkup, nodeBackgroundMarkup } from './background-images.js';
import { laneLeft, laneWidth, laneTop, laneHeader, swimlaneRoutes, swimlaneFrame } from './activity-routing.js';
import { flowActivityRows } from './activity-layout.js';
import { drawTimeline } from './timeline.js';
import { polyPath } from './svg-path.js';
import { rememberGeometry } from './draft-geometry.js';
import { tableFieldNames, tableLayout, drawTable } from './table.js';
import { sankeyFlow, sankeyRanks, sankeyLayout, drawSankey } from './sankey.js';
import { gridProjection, drawNafGrid } from './naf-grid.js';
import { DIAGRAMS, GRID_MODES, GRID_OPTIONS, GRID_VISIBILITY, GRID_VISIBILITY_ERROR, gridDefinition, isGridDiagram } from './diagram-types.js';

export { DIAGRAMS };
export const DIAGRAM_OPTIONS = {
  connected: ['propertyFields'], sequence: ['participants','messages','asyncMessages','returns','showContext','orderAttribute'],
  tree:[...TREE_OPTIONS,'propertyFields'],
  state: ['initial','final'], activity: ['lanes','laneAttribute','layout','initial','final','decisions','forks','joins'],
  matrix: ['rows','columns','relations'], heatmap: ['valueAttribute','parentAttribute','min','max','colorLow','colorHigh'],
  timeline: ['startAttribute','endAttribute','datedOnly'],
  table: ['fields','mode'],
  sankey: ['relations','weightAttribute'],
  nafgrid: GRID_OPTIONS, viewpointGrid: GRID_OPTIONS,
  class: ['attributes','methods','functions','interfaces','ports','parameters','ownerAttribute','signatureAttribute','propertyFields']
};
const fields = DIAGRAM_OPTIONS;
const lists = new Set(['participants','messages','asyncMessages','returns','final','lanes','decisions','forks','joins','rows','columns','relations','attributes','methods','functions','interfaces','ports','parameters']);
export const diagramOptionName = (type,name) => name==='finals' && (type==='state' || type==='activity') ? 'final' : name;
const members = ['attributes','methods','functions','interfaces','ports','parameters'];
const fail = (message, view) => {
  const type = view.diagram?.type ?? 'connected';
  const help = DIAGRAMS.includes(type) ? `@help diagrams ${type}` : '@help diagrams';
  throw new ArchError(`View ${view.id}: ${message}`, {...view.loc, help}, 'ARCH_VALIDATION');
};
const value = (node, name) => node.attributes?.[name] ?? node[name];

function timelineRows(nodes, options) {
  if (!options.datedOnly) return nodes;
  const {startAttribute = 'start', endAttribute = 'end'} = options;
  return nodes.filter(node => value(node, startAttribute) != null || value(node, endAttribute) != null);
}

function activityProjection(profile, view, edges, semanticEdges) {
  const options = view.diagram, lanes = new Set(options.lanes);
  const assignments = new Map(), context = new Set();
  for (const edge of semanticEdges) {
    if (!lanes.has(edge.source)) continue;
    const type = edge.type ?? profile.defaultRelation;
    if (lanes.has(edge.target)) {
      if (matches(type, ['HoldsRole'], profile.relationTypes)) context.add(edge.id);
    } else if (matches(type, ['PerformsOperationalActivity','IsCapableToPerform'], profile.relationTypes)) {
      context.add(edge.id);
      if (!assignments.has(edge.target)) assignments.set(edge.target, new Set());
      assignments.get(edge.target).add(edge.source);
    }
  }
  return {
    edges: edges.filter(edge => !context.has(edge.id)),
    flowEdges: semanticEdges.filter(edge => !context.has(edge.id)),
    lane(node) {
      const declared = value(node, options.laneAttribute ?? 'owner');
      if (options.laneAttribute || declared != null) return declared;
      const candidates = assignments.get(node.id);
      if (candidates?.size > 1) fail(`${node.id}: Multiple performers match lanes (${[...candidates].join(', ')}); set laneAttribute to choose a lane`,view);
      return candidates?.values().next().value;
    }
  };
}

export function diagramMembership(profile,view,display,semantic) {
  const options = view.diagram;
  if (options?.type==='timeline' && options.datedOnly) {
    const nodes = timelineRows(display.nodes,options), ids = new Set(nodes.map(node=>node.id));
    return {nodes,edges:display.edges.filter(edge=>ids.has(edge.source) && ids.has(edge.target))};
  }
  if (options?.type==='activity' && options.lanes) {
    const {edges} = activityProjection(profile,view,display.edges,semantic.edges);
    return {...display,edges};
  }
  if (options?.type==='state') return stateProjection(display.nodes,display.edges,view,profile,semantic.edges);
  return display;
}

export function validateDiagramView(profile, view, graph) {
  const c=view.diagram ?? {type:'connected'}, type=c.type;
  const grid = isGridDiagram(type,profile);
  const gridLayout = grid ? gridDefinition(type,profile) : undefined;
  if(!DIAGRAMS.includes(type) && !grid) fail(`Unknown diagram type ${type}`,view);
  if(grid) {
    if (type==='nafgrid' && !gridLayout) fail('nafgrid requires a profile with a viewpointGrid definition',view);
    if (gridLayout?.viewpoint && view.viewpoint!==gridLayout.viewpoint)
      fail(`${type} requires viewpoint ${gridLayout.viewpoint}`,view);
  }
  const { ids, nodes, edges } = graph.project(view, false);
  const display = graph.project(view);
  const displayedState = type==='state' ? stateProjection(display.nodes,display.edges,view,profile,edges) : null;
  if (type!=='state' && Object.keys(view.virtualPlaces??{}).length) fail('Virtual placements require a state diagram',view);
  if (type!=='state' && Object.keys(view.virtualRoutes??{}).length) fail('Virtual routes require a state diagram',view);
  let edgeIds;
  const propertiesSupported=['connected','tree','class'].includes(type);
  if(view.propertyFields!==undefined&&!propertiesSupported)fail('propertyFields requires the connected, tree or class renderer',view);
  validatePropertyFields(view.propertyFields,nodes,profile,view.loc);
  for(const [id,style]of Object.entries(view.styles))if(style.propertyFields!==undefined) {
    if(!propertiesSupported)fail('propertyFields requires the connected, tree or class renderer',view);
    validatePropertyFields(style.propertyFields,[graph.nodesById.get(id)],profile,style.loc);
  }
  const activity = type === 'activity' ? activityProjection(profile, view, display.edges, edges) : null;
  const datedIds = type === 'timeline' && c.datedOnly ? new Set(timelineRows(display.nodes, c).map(node => node.id)) : null;
  const renderedEdges = displayedState?.edges ?? activity?.edges ??
    (datedIds ? display.edges.filter(edge => datedIds.has(edge.source) && datedIds.has(edge.target)) : display.edges);
  if(['sequence','state','activity','timeline'].includes(type)&&renderedEdges.some(e=>e.direction==='both'))fail(`Bidirectional relationships are not supported in ${type} views; use two directed relationships`,view);
  if(type!=='connected' && (view.referenceDisplay==='nodes'||view.referenceDisplay==='both')) fail('graphical referenceDisplay requires the connected renderer',view);
  if(type!=='connected' && view.routeDefaults!==undefined) fail('routes defaults require the connected renderer',view);
  if(type!=='connected' && view.referenceOccurrences!==undefined) fail('referenceOccurrences requires the connected renderer',view);
  if(!['connected','tree'].includes(type) && Object.values(view.styles).some(style=>['showIcon','showLabel','showStereotype','showDescription','showTechnology'].some(key=>style[key]!==undefined))) fail('node visibility style overrides require the connected or tree renderer',view);
  if(!['connected','tree'].includes(type) && Object.values(view.styles).some(style=>style.iconPosition!==undefined)) fail('iconPosition style overrides require the connected or tree renderer',view);
  if(!['connected','tree'].includes(type) && Object.values(view.styles).some(style=>style.display==='logo')) fail('logo display requires the connected or tree renderer',view);
  if(!['connected','tree'].includes(type) && Object.values(view.styles).some(style=>['fontSize','width','height'].some(field=>style[field]!==undefined))) fail('fontSize/width/height style overrides require the connected or tree renderer',view);
  for(const [key,v] of Object.entries(c)) {
    if(key==='type' || type==='state' && ['virtualInitial','virtualFinal'].includes(key)) continue;
    if(!(grid ? GRID_OPTIONS : fields[type]).includes(key)) {
      const hint = type==='timeline' && key==='dated' ? '. Use datedOnly true to show only dated elements' : '';
      fail(`Option ${key} does not apply to ${type}${hint}`,view);
    }
    if (grid) {
      if (key==='show') {
        if (!GRID_VISIBILITY.includes(v)) fail(GRID_VISIBILITY_ERROR,view);
      } else if (key==='viewpoints') {
        if (!Array.isArray(v) || v.some(id=>typeof id!=='string')) fail('viewpoints requires a list of viewpoint codes',view);
        const requested = v.map(id=>id.toLowerCase());
        if (new Set(requested).size!==requested.length) fail('viewpoints requires unique viewpoint codes',view);
        const cells = gridLayout?.cells.map(cell=>cell.id) ?? Object.keys(profile.viewpoints);
        const codes = new Set(cells.map(id=>id.toLowerCase()));
        const unknown = v.find((id,i)=>!codes.has(requested[i]));
        if (unknown!==undefined) fail(`viewpoints: ${unknown} has no cell in this grid`,view);
      } else if (!GRID_MODES.includes(v)) fail(`${key} must be count, list or none`,view);
      continue;
    }
    if (type === 'tree' && key === 'padding') continue; // Shared tree option validation accepts numbers and tuples.
    if(type==='table' && key==='fields') {
      if (!Array.isArray(v) || !v.length || v.length > 16 || new Set(v).size !== v.length) fail('fields requires 1–16 unique column names',view);
      const known = tableFieldNames(c.mode,c.mode==='relationships'?edges:nodes,profile);
      for (const field of v) if (!known.has(field)) fail(`Unknown table field ${field}; choose from ${[...known].join(', ')}`,view);
    } else if(type==='table' && key==='mode') {
      if (!['elements','relationships'].includes(v)) fail('Table mode must be elements or relationships',view);
    } else if(key==='propertyFields') {
      validatePropertyFields(v,nodes,profile,view.loc);
    } else if(lists.has(key)) {
      if(!Array.isArray(v)||v.some(x=>typeof x!=='string')||new Set(v).size!==v.length) fail(`${key} requires a list of unique values`,view);
      const allowed = ['messages','asyncMessages','returns'].includes(key)
        ? (edgeIds ??= new Set(edges.map(edge => edge.id))) : ids;
      for (const id of v) {
        if (key === 'relations' ? !Object.hasOwn(profile.relationTypes, id) : !allowed.has(id))
          fail(`${key}: unknown or invisible reference ${id}`,view);
      }
    } else if(key==='layout') {if(!['auto','flow','model'].includes(v))fail('Activity layout must be auto, flow or model',view);}
    else if(['showLabels','showStereotype','showContext','datedOnly'].includes(key)) {if(typeof v!=='boolean')fail(`${key} must be true or false`,view);}
    else if(['levelGap','siblingGap'].includes(key)) {if(!Number.isFinite(v)||v<16||v>800)fail(`${key} must be between 16 and 800`,view);}
    else if(['min','max'].includes(key)) { if(!Number.isFinite(v)) fail(`${key} must be finite`,view); }
    else if(typeof v!=='string') fail(`${key} must be a string`,view);
    if(key.startsWith('color')&&!normalizeColor(v)) fail(`Invalid color ${key}`,view);
  }
  if(Object.keys(view.places).length&& !['connected','class','state'].includes(type))fail('place requires a connected, class or state view',view);
  if (type !== 'connected') {
    if (view.referenceRoutes?.length) fail('Reference connector routing is only supported for connected views',view);
    const routes = [...Object.values(view.routes), ...Object.values(view.virtualRoutes ?? {})];
    if (routes.length && type === 'activity' && !c.lanes?.length)
      fail('Activity routing requires lanes',view);
    if (routes.length && !['activity','state'].includes(type))
      fail(type === 'class' ? 'route is only supported for connected; use place to position class cards' :
        'place/route are only supported for connected; this renderer determines the layout',view);
    const fields = type === 'state' ? ['from','to','via','curve'] : ['from','to','via'];
    for (const route of routes) {
      for (const key of Object.keys(route)) {
        if (key !== 'loc' && !fields.includes(key)) {
          const supported = type === 'state' ? 'State routes support from, to, via and curve' : 'Swimlane routes support from, to and via';
          throw new ArchError(`View ${view.id}: ${supported}; unsupported option: ${key}`,route.loc ?? view.loc,'ARCH_VALIDATION');
        }
      }
    }
  }
  if(type==='tree') {
    validateTreeOptions(c,profile,view);
    treeStructure(display.nodes, display.edges, profile, view);
  }
  if(c.initial&&!ids.has(c.initial)) fail('initial is not visible',view);
  if(type==='sequence') {
    const projection=sequenceProjection(nodes,edges,c,profile,view);
    const participants = new Set(projection.participants.map(n => n.id));
    const messages = new Set(projection.messages.map(e => e.id));
    for (const edge of projection.messages) {
      if (!participants.has(edge.source) || !participants.has(edge.target)) fail(`Message ${edge.id} requires both participants`,view);
    }
    for (const id of [...(c.returns ?? []), ...(c.asyncMessages ?? [])]) {
      if (!messages.has(id)) fail(`Message ${id} is not included in messages`,view);
    }
    const asyncIds = new Set(c.asyncMessages);
    if ((c.returns ?? []).some(id => asyncIds.has(id))) fail('A message cannot be both return and async',view);
  }
  if(type==='matrix'&&((c.rows??nodes).length>100||(c.columns??nodes).length>100)) fail('Matrix supports at most 100 rows/columns',view);
  if (type==='sankey') {
    const flows = sankeyFlow(display.edges,c,profile);
    if (flows.some(edge => edge.direction==='both')) fail('Sankey requires directed relationships',view);
    if (flows.length>256) fail('Sankey supports at most 256 displayed flows',view);
    const ranks = sankeyRanks(flows);
    if (!ranks) fail('Sankey requires an acyclic flow. Filter its relations or use a connected diagram.',view);
    if ([...ranks.values()].some(rank => rank>=48)) fail('Sankey supports at most 48 flow levels',view);
    if (c.weightAttribute) for (const edge of flows) {
      const weight = edge.attributes?.[c.weightAttribute];
      if (!Number.isFinite(weight) || weight<=0) fail(`${edge.id}: ${c.weightAttribute} must be a positive numeric weight`,view);
    }
  }
  if(type==='activity') {
    const lanes=new Set(c.lanes??[]), tasks=display.nodes.filter(n=>!lanes.has(n.id));
    const {flowEdges:edges, lane} = activity;
    for(const n of tasks) if(lanes.size&&!lanes.has(lane(n))) fail(`${n.id}: Missing valid lane assignment`,view);
    const kinds=[...(c.decisions??[]),...(c.forks??[]),...(c.joins??[])];
    if(new Set(kinds).size!==kinds.length) fail('Activity has multiple control node kinds',view);
    for(const id of c.decisions??[]) if(edges.filter(e=>e.source===id).length<2) fail(`${id}: Decision requires at least two outgoing edges`,view);
    for(const id of c.forks??[]) if(edges.filter(e=>e.source===id).length<2) fail(`${id}: Fork requires at least two outgoing edges`,view);
    for(const id of c.joins??[]) if(edges.filter(e=>e.target===id).length<2) fail(`${id}: Join requires at least two incoming edges`,view);
    for(const e of edges) if(lanes.has(e.source)||lanes.has(e.target)) fail('Lane elements cannot be flow nodes',view);
  }
  if(['state','activity'].includes(type)) {
    const transitions = type === 'state' ? stateProjection(nodes,edges,view,profile).edges : activity.flowEdges;
    const finals=new Set(c.final);
    if(c.initial&&finals.has(c.initial)) fail('Initial and final nodes must be different',view);
    if(c.initial&&transitions.some(e=>e.target===c.initial)) fail('Initial node cannot have incoming transitions',view);
    if(finals.size&&transitions.some(e=>finals.has(e.source))) fail('Final nodes cannot have outgoing transitions',view);
  }
  if(type==='heatmap') {
    const min=c.min??0,max=c.max??5; if(min>=max) fail('Heatmap requires min < max',view);
    if(!c.valueAttribute) fail('Missing valueAttribute',view);
    const parents=new Map();
    for(const n of nodes) {
      const v=value(n,c.valueAttribute); if(v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)) fail(`${n.id}: Heatmap value outside ${min}–${max}`,view);
      const parent=c.parentAttribute?value(n,c.parentAttribute):n.parent;
      if(parent!==undefined&&parent!==null) { if(!ids.has(parent)) fail(`${n.id}: Heatmap parent is not visible`,view); parents.set(n.id,parent); }
    }
    for(const n of nodes) { const seen=new Set(); let p=n.id; while(parents.has(p)) { if(seen.has(p)||seen.size>=32) fail('Heatmap hierarchy is cyclic or too deep',view); seen.add(p);p=parents.get(p); } }
  }
  if (type === 'timeline') {
    const { startAttribute = 'start', endAttribute = 'end' } = c;
    // Only rendered rows need dates. The NAF viewpoint still validates the
    // full semantic selection, including context hidden with display none.
    for (const node of timelineRows(display.nodes,c)) {
      const start = value(node, startAttribute), end = value(node, endAttribute);
      for (const [attribute, date] of [[startAttribute, start], [endAttribute, end]]) {
        const match = typeof date === 'string' && date.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/);
        if (!match || !Number.isFinite(Date.parse(date)) || new Date(Date.parse(match[1])).toISOString().slice(0,10) !== match[1])
          fail(`${node.id}: Attribute ${attribute} requires a valid ISO date or timestamp`, view);
      }
      if (Date.parse(start) > Date.parse(end)) fail(`${node.id}: start is after end`, view);
    }
  }
  if(type==='class') {
    const all=members.flatMap(k=>c[k]??[]), memberIds=new Set(all), byId=new Map(nodes.map(n=>[n.id,n]));
    if(memberIds.size!==all.length) fail('A detail belongs to multiple compartments',view);
    for(const id of all)if(view.styles[id]?.propertyFields!==undefined)fail(`Class detail ${id}: propertyFields styles apply to class cards`,view);
    for(const id of all) {
      const owner=value(byId.get(id),c.ownerAttribute??'owner');
      if(!byId.has(owner)||id===owner||memberIds.has(owner)&&!(c.parameters??[]).includes(id)) fail(`${id}: Missing valid owner`,view);
      if((c.parameters??[]).includes(id)&&![...(c.methods??[]),...(c.functions??[])].includes(owner)) fail(`${id}: Parameter requires a method/function as its owner`,view);
    }
  }
  if (displayedState) return validateStatePlacement(view,graph,displayedState);
}

// Independent layouts and SVG primitives; no DOM, CSS dependency or executable profile rules.
function scene(graph, theme, prefix, classPlacement, measureOnly = false) {
  const {nodes,edges,view,profileRules}=graph, c={...view.diagram,colorLow:normalizeColor(view.diagram.colorLow),colorHigh:normalizeColor(view.diagram.colorHigh)}, type=c.type;
  const dark=theme==='dark', bg=dark?'#111827':'#fafbfe', text=dark?'#f1f5f9':'#1e293b', border=dark?'#8b9ab2':'#64748b', muted=dark?'#b4bfd0':'#52627a';
  const byId = new Map(nodes.map(n => [n.id,n]));
  // The measurement pass still computes positions for cards and sequence
  // references. Only labels that affect bounds are wrapped in this pass.
  const out = measureOnly ? { push() {} } : [];
  let width=900,height=300,explicitBounds;
  if (type==='table') {
    const plan = tablePlans.get(nodes) ?? tableLayout(nodes,edges,c);
    if (measureOnly) tablePlans.set(nodes, plan);
    return {width:plan.width,height:plan.height,body:measureOnly?'':drawTable(plan,dark)};
  }
  if (type==='sankey') {
    const plan = sankeyPlans.get(nodes) ?? sankeyLayout(nodes,sankeyFlow(edges,c,profileRules),c);
    if (measureOnly) sankeyPlans.set(nodes,plan);
    return {width:plan.width,height:plan.height,body:measureOnly?'':drawSankey(plan,dark)};
  }
  if (isGridDiagram(type,profileRules)) {
    const plan = gridPlans.get(nodes);
    return {width:plan.width,height:plan.height,body:measureOnly?'':drawNafGrid(plan,dark,prefix,bg)};
  }
  if(!nodes.length && !(type==='timeline' && c.datedOnly))return {body:'',width:300,height:180};
  const wrap=(s,limit)=> {
    const measure=s=>[...s].reduce((sum,c)=>sum+(/[MW@%]/.test(c)?1.6:/[ilI.,:! ]/.test(c)?0.5:1),0);
    const lines=[];for(const paragraph of String(s??'').split('\n')) {let line='';for(const word of paragraph.split(/\s+/)) {
      if(line&&measure(line+' '+word)>limit){lines.push(line);line='';}
      let part='';for(const ch of word){if(part&&measure(part+ch)>limit){lines.push(part);part='';}part+=ch;}
      line+=(line?' ':'')+part;
    }lines.push(line);}return lines;
  };
  const labelLines = (value, lines, x, y, size, color, anchor) => {
    const spans = lines.map((line, i) => `<tspan x="${x}" dy="${i ? size * 1.4 : 0}">${esc(line)}</tspan>`).join('');
    out.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}"><title>${esc(value)}</title>${spans}</text>`);
  };
  const label = (value, x, y, width = 200, size = 13, color = text, anchor = 'start') => {
    if (measureOnly) return;
    const all = wrap(value, Math.max(1, Math.floor(width / (size * .65))));
    const lines = all.slice(0, 2);
    if (all.length > 2) lines[1] = lines[1].slice(0, -1) + '…';
    labelLines(value,lines,x,y,size,color,anchor);
  };
  const rect=(x,y,w,h,fill=bg,opacity=1,rx=6)=>{if(!measureOnly)out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" fill-opacity="${opacity}" stroke="${border}"/>`);};
  const path=(d,arrow=false,dashed=false,both=false)=>{if(!measureOnly)out.push(`<path d="${d}" fill="none" stroke="${border}" stroke-width="1.5"${both?` marker-start="url(#${prefix}-arrow)"`:''}${arrow?` marker-end="url(#${prefix}-${typeof arrow==='string'?arrow:'arrow'})"`:''}${dashed?' stroke-dasharray="6 5"':''}/>`);};
  const cardBackground = (n, w, h, radius) => nodeBackgroundMarkup(n, `${prefix}-background-${n.id}`, w, h, `<rect width="${w}" height="${h}" rx="${radius}"/>`);
  const card=(n,x,y,w=220,h=90,body)=> {
    Object.assign(n,{x,y,width:w,height:h});
    if (measureOnly) return { x,y,width:w,height:h };
    const fill=n.backgroundColor??(dark?'#1e293b':'#ffffff'), opacity=n.opacity??(n.backgroundColor?DEFAULT_BACKGROUND_OPACITY:1), fg=foreground(composite(fill,bg,opacity));
    out.push(`<g data-node="${esc(n.id)}" data-type="${esc(n.type)}" transform="translate(${x} ${y})"><title>${esc(n.title)}</title>`);
    rect(0,0,w,h,fill,opacity);out.push(cardBackground(n,w,h,6));
    label(n.type,14,22,w-28,10,fg);label(n.title,14,45,w-28,14,fg); if(body) body(fg); out.push('</g>');
    return {x,y,width:w,height:h};
  };
  const edgeLabel=(e,x,y)=> {rect(x-80,y-14,160,20,bg,1,3);label(e.title,x,y,150,11,muted,'middle');};
  if(type==='sequence') {
    ({width,height}=drawSequence({nodes,edges,c,profile:profileRules,view,out,card,path,label,rect,esc,bg,muted,text,dark,measureOnly}));
  } else if(type==='state') {
    ({width,height,bounds:explicitBounds}=drawState({nodes,edges,view,c,out,path,rect,cardBackground,labelLines,esc,bg,muted,text,dark,
      measureOnly,placement:statePlacementPlans.get(nodes)}));
  } else if(type==='matrix') {
    const rows=(c.rows??nodes.map(n=>n.id)).map(id=>byId.get(id)),cols=(c.columns??nodes.map(n=>n.id)).map(id=>byId.get(id));
    const cell=132,left=214,top=73,rowHeight=55;
    width=left+cols.length*cell;height=top+rows.length*rowHeight+48;
    if (measureOnly) return { width, height };
    // Index directed cells once. A bidirectional edge contributes to the
    // mirrored cell, except self-loops which still count once.
    const cells = new Map();
    const put = (source, target, edge) => {
      const key = `${source}\0${target}`;
      let entries = cells.get(key);
      if (!entries) cells.set(key, entries = []);
      entries.push(edge);
    };
    for (const edge of edges) {
      if (c.relations && !matches(edge.type, c.relations, profileRules.relationTypes)) continue;
      put(edge.source, edge.target, edge);
      if (edge.direction === 'both' && edge.source !== edge.target) put(edge.target, edge.source, edge);
    }
    const surface=dark?'#172238':'#fff', header=dark?'#24344d':'#eef2fa', stripe=dark?'#1d2a40':'#f6f8fc', grid=dark?'#344662':'#dae3f0';
    const active=dark?'#32436d':'#e4eaff', accent=dark?'#d0daff':'#393f9d';
    out.push(`<rect width="${width}" height="${height}" rx="12" fill="${surface}"/><path d="M0 ${top}V12Q0 0 12 0H${width-12}Q${width} 0 ${width} 12V${top}Z" fill="${header}"/>`);
    label('Source → Target',16,28,left-32,12,muted);
    cols.forEach((n,i)=>{
      out.push(`<g data-node="${esc(n.id)}">`);label(n.title,left+i*cell+cell/2,28,cell-14,12,text,'middle');out.push('</g>');
    });
    rows.forEach((node, row) => {
      const y = top + row * rowHeight, fill=row%2?stripe:surface;
      out.push(`<rect y="${y}" width="${width}" height="${rowHeight}" fill="${fill}"/><path d="M0 ${y}H${width}" stroke="${grid}"/><g data-node="${esc(node.id)}">`);
      label(node.title,16,y+24,left-32,12);out.push('</g>');
      cols.forEach((target, column) => {
        const matching = cells.get(`${node.id}\0${target.id}`) ?? [];
        const x = left + column * cell;
        const title = matching.map(e => `${e.type}: ${e.title}`).join('\n') || 'No relationship';
        out.push(`<g data-cell="${esc(node.id)}:${esc(target.id)}"><title>${esc(title)}</title><path d="M${x} ${y}v${rowHeight}" stroke="${grid}"/>`);
        if(matching.length)out.push(`<rect x="${x+cell/2-21}" y="${y+13}" width="42" height="29" rx="7" fill="${active}"/>`);
        label(matching.length || '·',x+cell/2,y+33,cell,matching.length?15:13,matching.length?accent:muted,'middle');
        out.push('</g>');
      });
    });
    out.push(`<path d="M0 ${height-48}H${width}" stroke="${grid}"/><rect width="${width}" height="${height}" rx="12" fill="none" stroke="${grid}"/>`);
    label('Number of directed relationships per cell',16,height-18,width-32,12,muted);
  } else if(type==='heatmap') {
    const groups = new Map(), metrics = new Map();
    for (const node of nodes) {
      const parent = (c.parentAttribute ? value(node, c.parentAttribute) : node.parent) ?? null;
      let siblings = groups.get(parent);
      if (!siblings) groups.set(parent, siblings = []);
      siblings.push(node);
    }
    const children = id => groups.get(id) ?? [];
    function measure(node) {
      let leaves = 0, levels = 0;
      for (const child of children(node.id)) {
        const result = measure(child);
        leaves += result.leaves;
        levels = Math.max(levels, result.levels);
      }
      const result = { leaves:Math.max(1, leaves), levels:levels+1 };
      metrics.set(node.id, result);
      return result;
    }
    const roots = children(null), rootMetrics = roots.map(measure);
    width = Math.max(600, rootMetrics.reduce((sum, item) => sum + item.leaves * 250, 0) + 40);
    height = Math.max(270, ...rootMetrics.map(item => item.levels * 110 + 140));
    if (measureOnly) return { width, height };
    const leaves = node => metrics.get(node.id).leaves;
    const mix=(a,b,t)=>composite(b,a,t),min=c.min??0,max=c.max??5;
    const tile=(n,x,y,w,h,backdrop=bg)=>{const v=value(n,c.valueAttribute),fill=v===undefined?(dark?'#64748b':'#94a3b8'):mix(c.colorLow??'#fee2e2',c.colorHigh??'#16a34a',(v-min)/(max-min)),fg=foreground(composite(fill,backdrop,n.opacity??0.2));out.push(`<g data-tile="${esc(n.id)}"><title>${esc(n.title)}: ${esc(v??'No value')}</title>`);rect(x,y,w,h,fill,n.opacity??0.2);label(`${n.title} · ${v??'—'}`,x+12,y+25,w-24,13,fg);out.push('</g>');let cx=x+12;for(const k of children(n.id)){const kw=(w-24)*leaves(k)/leaves(n);tile(k,cx,y+45,kw-8,h-57,composite(fill,backdrop,n.opacity??0.2));cx+=kw;}};
    let x=20;for(const n of roots){const w=leaves(n)*250;tile(n,x,20,w-15,height-105);x+=w;}
    for(let i=0;i<=10;i++)rect(25+i*28,height-55,28,18,mix(c.colorLow??'#fee2e2',c.colorHigh??'#16a34a',i/10),0.2,0);
    label(`${min} → ${max} · — = no value`,25,height-12,450,12,muted);
  } else if(type==='timeline') {
    ({width,height}=drawTimeline({nodes,edges,options:c,isDark:dark,prefix,out,measureOnly}));
  } else if(type==='class') {
    const memberIds=new Set(members.flatMap(k=>c[k]??[])),classes=nodes.filter(n=>!memberIds.has(n.id)),pos=new Map(),portPositions=new Map();
    const owner=n=>value(n,c.ownerAttribute??'owner'),signature=n=>value(n,c.signatureAttribute??'signature')??n.title;
    const byKind = new Map();
    for (const kind of members) {
      const byOwner = new Map();
      for (const id of c[kind] ?? []) {
        const item = byId.get(id), key = owner(item);
        let siblings = byOwner.get(key);
        if (!siblings) byOwner.set(key, siblings = []);
        siblings.push(item);
      }
      byKind.set(kind, byOwner);
    }
    const memberText = member => {
      const params = (byKind.get('parameters').get(member.id) ?? []).map(signature).join(', ');
      const full = String(signature(member));
      return params ? full.includes('()') ? full.replace('()', `(${params})`) : `${full} (${params})` : full;
    };
    const cardBorder=dark?'#37465d':'#dce3ed',cards=[];
    const sectionColor=dark?'#a9b6cc':'#66758c';
    const symbols={properties:'·',attributes:'−',methods:'ƒ',functions:'ƒ',interfaces:'◇',ports:'□'};
    let x=30; height=220;
    for(const n of classes) {
      const cardWidth=Math.max(380,view.places[n.id]?.size?.x??0);
      const lines = [];
      for (const [kind, byOwner] of byKind) {
        const items = byOwner.get(n.id);
        if (kind === 'parameters' || !items?.length) continue;
        const rows = items.map(member => {
          const full = memberText(member);
          return { id:member.id, full, lines:wrap(full,32) };
        });
        lines.push({ kind, rows });
      }
      const properties=nodeProperties(n,view).map(row=>({id:`${n.id}.${row.key}`,full:row.full,lines:wrap(row.full,32)}));
      if(properties.length) lines.unshift({kind:'properties',rows:properties});
      const ownPorts = byKind.get('ports').get(n.id) ?? [];
      const h=Math.max(148,view.places[n.id]?.size?.y??0,90+ownPorts.length*24,110+lines.reduce((sum,s)=>sum+50+s.rows.reduce((count,r)=>count+r.lines.length*21,0),0));
      Object.assign(n,{x,y:40,width:cardWidth,height:h});cards.push({n,lines,h,ownPorts});
      x+=cardWidth+90;height=Math.max(height,h+120);
    }
    const positioned=positionClassCards(view,cards,classPlacement),extents=[];
    for(const box of positioned.values())extents.push({x:box.x,y:box.y},{x:box.x+box.width,y:box.y+box.height});
    for(const card of cards) {
      const {n,lines,h,ownPorts}=card,cardWidth=n.width,x=n.x,cardY=n.y;
      const fill=n.backgroundColor??(dark?'#1e293b':'#ffffff'), opacity=n.opacity??(n.backgroundColor?DEFAULT_BACKGROUND_OPACITY:1);
      const visible=composite(fill,bg,opacity), fg=n.backgroundColor||n.opacity!==undefined?foreground(visible):text;
      const subdued=n.backgroundColor?fg:sectionColor;
      const accent=n.accent&&contrast(n.accent,visible)>=4.5?n.accent:(n.backgroundColor?fg:dark?'#a5b4fc':'#6366f1');
      pos.set(n.id,{x,y:cardY,width:cardWidth,height:h});
      out.push(`<g data-node="${esc(n.id)}" data-type="${esc(n.type)}" data-class-card="true" transform="translate(${x} ${cardY})"><title>${esc(n.title)}</title>`);
      out.push(`<rect width="${cardWidth}" height="${h}" rx="16" fill="${fill}" fill-opacity="${opacity}" stroke="${cardBorder}" filter="url(#${prefix}-class-shadow)"/>`);
      out.push(cardBackground(n,cardWidth,h,16));
      out.push(`<path d="M16 1 H${cardWidth-16} Q${cardWidth-1} 1 ${cardWidth-1} 16 V95 H1 V16 Q1 1 16 1Z" fill="${accent}" fill-opacity="0.055"/>`);
      out.push(`<rect x="20" y="18" width="26" height="26" rx="7" fill="${accent}" fill-opacity="0.1"/><g font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-weight="600">`);
      label('{}',33,36,24,12,accent,'middle');out.push('</g><g font-weight="600" letter-spacing="1">');
      label(String(n.stereotype??n.type).toUpperCase(),58,35,cardWidth-80,10,subdued);out.push('</g><g font-weight="650">');
      label(n.title,20,65,cardWidth-40,18,fg);out.push('</g>');
      let y=116;
      for(const s of lines) {
        out.push(`<g data-compartment="${s.kind}"><title>${esc(s.rows.map(row=>row.full).join('\n'))}</title>`);
        out.push(`<path d="M20 ${y-16} H${cardWidth-20}" fill="none" stroke="${cardBorder}" stroke-width="0.8"/>`);
        out.push('<g font-weight="600" letter-spacing="1.2">');label(s.kind.toUpperCase(),22,y,cardWidth-85,9.5,subdued);out.push('</g>');
        out.push(`<rect x="${cardWidth-47}" y="${y-12}" width="25" height="17" rx="8.5" fill="${subdued}" fill-opacity="0.08"/>`);
        label(s.rows.length,cardWidth-34.5,y,22,9,subdued,'middle');y+=30;
        for(const row of s.rows) {
          out.push(`<g data-member="${esc(row.id)}"><title>${esc(row.full)}</title>`);
          label(symbols[s.kind],24,y,16,12,accent);
          out.push('<g font-family="ui-monospace,SFMono-Regular,Consolas,monospace">');
          for(const line of row.lines){label(line,46,y,cardWidth-68,12.5,fg);y+=21;}
          out.push('</g></g>');
        }
        y+=20;out.push('</g>');
      }
      out.push('</g>');
      ownPorts.forEach(p=>{
        const box=positioned.get(p.id),py=box.y+6;Object.assign(p,box);
        out.push(`<g data-port="${esc(p.id)}"><title>${esc(p.title)}</title><rect x="${x+cardWidth-6}" y="${py-6}" width="12" height="12" rx="3" fill="${dark?'#1e293b':'#ffffff'}" stroke="${accent}" stroke-width="1.5"/><circle cx="${x+cardWidth}" cy="${py}" r="2" fill="${accent}"/></g>`);
        portPositions.set(p.id,{x:x+cardWidth,y:py});
      });
    }
    for(const e of edges){const a=pos.get(e.source),b=pos.get(e.target),pa=portPositions.get(e.source),pb=portPositions.get(e.target);
      if((a||pa)&&(b||pb)){
        const anchor=(box,other)=>{
          const ox=other.x+(other.width??0)/2,oy=other.y+(other.height??0)/2,dx=ox-box.x-box.width/2,dy=oy-box.y-box.height/2;
          return Math.abs(dx)>=Math.abs(dy)?{x:box.x+(dx>=0?box.width:0),y:box.y+56}:{x:box.x+box.width/2,y:box.y+(dy>=0?box.height:0)};
        };
        const start=pa??anchor(a,b??pb),end=pb??anchor(b,a??pa),lx=(start.x+end.x)/2,ly=(start.y+end.y)/2-31;
        out.push(`<g data-edge="${esc(e.id)}">`);
        path(`M${start.x} ${start.y} L${end.x} ${end.y}`,e.direction==='both'||(['generalization','realization'].includes(e.style)?'triangle':!['association','composition'].includes(e.style)),['dependency','realization'].includes(e.style),e.direction==='both');
        edgeLabel(e,lx,ly);out.push('</g>');extents.push({x:lx-100,y:ly-30},{x:lx+100,y:ly+30});}}
    // Class cards can be moved into a narrower grid or to negative
    // coordinates. Fit the resulting drawing rather than the default row.
    if(extents.length) {
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(const {x,y} of extents){ left=Math.min(left,x); top=Math.min(top,y); right=Math.max(right,x); bottom=Math.max(bottom,y); }
      explicitBounds={x:left-20,y:top-20,width:right-left+40,height:bottom-top+40};
    }

  } else {
    // Activity views use independent control-node notation and row/lane layout.
    const laneIds=c.lanes??[], laneIndices=new Map(laneIds.map((id,i)=>[id,i]));
    const tasks=nodes.filter(n=>!laneIndices.has(n.id)), pos=new Map();
    const laneAssignments = activityLanes.get(nodes);
    const lanes=tasks.map(n=>laneIds.length?laneIndices.get(laneAssignments?.get(n.id)):0);
    if (type==='activity' && c.layout!=='model' && !activityRowPlans.has(nodes))
      activityRowPlans.set(nodes,flowActivityRows(tasks,edges,profileRules,lanes));
    const plan=type==='activity' && c.layout!=='model' ? activityRowPlans.get(nodes) : null;
    const finals=new Set(c.final), decisions=new Set(c.decisions), bars=new Set([...(c.forks??[]),...(c.joins??[])]);
    width=Math.max(850,(laneIds.length||1)*laneWidth+160);
    height=130+(plan?.rowCount??tasks.length)*145;
    tasks.forEach((n,i)=>{
      const lane=lanes[i], row=plan?.rows[i]??i;
      const x=laneIds.length?laneLeft+40+lane*laneWidth:Math.max(80,width/2-110), y=95+row*145;
      const initial=n.id===c.initial, final=finals.has(n.id), bar=bars.has(n.id);
      pos.set(n.id,{x,y,lane,width:220,height:80,
        control:initial?'initial':final?'final':bar?'bar':decisions.has(n.id)?'decision':undefined,
        inY:y+(initial?29:final?20:bar?30:0), outY:y+(initial?51:final?60:bar?42:80)});
    });
    let laneFlow;
    if (laneIds.length) {
      const laneBottom=height-25;
      const laneBoxes=new Map(laneIds.map((id,i)=>[id,{x:laneLeft+i*laneWidth,y:laneTop,width:laneWidth,height:laneBottom-laneTop}]));
      laneFlow=swimlaneRoutes(edges,pos,view.routes,laneBoxes);
      let minX=-20,minY=-20,maxX=width+20,maxY=height+20;
      for (const {edge,points,route,resolved,caption} of laneFlow) {
        if (measureOnly && resolved) rememberGeometry(edge,{route,resolvedRoute:resolved});
        for (const {x,y} of points) {
          minX=Math.min(minX,x-20); minY=Math.min(minY,y-20);
          maxX=Math.max(maxX,x+20); maxY=Math.max(maxY,y+20);
        }
        if (caption) {
          minX=Math.min(minX,caption.x-20); minY=Math.min(minY,caption.y-20);
          maxX=Math.max(maxX,caption.x+caption.width+20); maxY=Math.max(maxY,caption.y+caption.height+20);
        }
      }
      explicitBounds={x:minX,y:minY,width:maxX-minX,height:maxY-minY};
      if (!measureOnly) {
        const frame=swimlaneFrame(laneFlow,laneIds.length,laneBottom);
        for (const [id,box] of laneBoxes) {
          out.push(`<g data-node="${esc(id)}">`);
          out.push(`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${bg}"/>`);
          label(byId.get(id).title,box.x+15,laneHeader-17,box.width-30,14);
          out.push('</g>');
        }
        if (frame.rails.trim()) path(frame.rails);
        out.push('<g data-swimlane-dividers="true">');
        for (const divider of frame.dividers) if (divider) path(divider);
        out.push('</g>');
      }
    }
    tasks.forEach(n=>{
      const {x,y}=pos.get(n.id);
      out.push(`<g data-state="${esc(n.id)}">`);
      if(n.id===c.initial||finals.has(n.id)){out.push(`<circle cx="${x+110}" cy="${y+40}" r="${n.id===c.initial?11:15}" fill="${text}"/>`);if(n.id!==c.initial)out.push(`<circle cx="${x+110}" cy="${y+40}" r="20" fill="none" stroke="${text}"/>`);label(n.title,x+140,y+44,110,11);}
      else if(decisions.has(n.id)){out.push(`<path d="M${x+110} ${y} l100 40 -100 40 -100 -40Z" fill="${bg}" stroke="${border}"/>`);label(n.title,x+110,y+44,150,12,text,'middle');}
      else if(bars.has(n.id)){rect(x,y+30,220,12,text,1,0);label(n.title,x,y+70,220,11);}
      else card(n,x,y,220,80);out.push('</g>');
    });
    if (measureOnly && laneFlow) return {width,height,bounds:explicitBounds};
    if (laneFlow) {
      for (const {edge,points,caption} of laneFlow) {
        out.push(`<g data-edge="${esc(edge.id)}">`);
        path(polyPath(points,false),true);
        if (caption) {
          const {x,y,width,height,lines,fontSize}=caption;
          rect(x,y,width,height,bg,1,3);
          labelLines(edge.title,lines,x+width/2,y+15,fontSize,muted,'middle');
        }
        out.push('</g>');
      }
    } else {
      edges.forEach((e,index)=>{const a=pos.get(e.source),b=pos.get(e.target);if(!a||!b)return;out.push(`<g data-edge="${esc(e.id)}">`);if(e.source===e.target){path(`M${a.x+220} ${a.y+20} h45 v50 h-45`,true);edgeLabel(e,a.x+300,a.y+45);}else if(b.y>a.y){const y=(a.outY+b.inY)/2;path(`M${a.x+110} ${a.outY} V${y} H${b.x+110} V${b.inY}`,true);if(e.title)edgeLabel(e,(a.x+b.x)/2+110,y-4);}else{const x=25+(index%3)*14;path(`M${a.x} ${a.y+40} H${x} V${b.y+40} H${b.x}`,true);if(e.title)edgeLabel(e,Math.max(110,a.x-90),(a.y+b.y)/2+40);}out.push('</g>');});
    }
  }
  return {body:measureOnly?'':out.join(''),width:Math.max(300,width),height:Math.max(180,height),bounds:explicitBounds};
}
export function layoutDiagram(model,profile,view,nodes,edges,classPlacement,semanticEdges,statePlacement,{viewCatalogue=model.views}={}) {
  const diagram={...view.diagram}, ids=new Set(nodes.map(n=>n.id));
  let laneAssignments;
  // Presentation hides do not invalidate configured participant/member lists.
  // Lane/heatmap children follow a hidden logical container as well.
  if(diagram.type==='activity'&&diagram.lanes) {
    const hiddenLanes=new Set(diagram.lanes.filter(id=>!ids.has(id)));
    const activity = activityProjection(profile, view, edges, semanticEdges);
    const laneIds = new Set(diagram.lanes);
    laneAssignments = new Map(nodes.filter(n=>!laneIds.has(n.id)).map(n=>[n.id,activity.lane(n)]));
    nodes=nodes.filter(n=>!hiddenLanes.has(laneAssignments.get(n.id)));
    edges=activity.edges;
  }
  if (diagram.type==='timeline') nodes=timelineRows(nodes,diagram);
  if(diagram.type==='heatmap'&&diagram.parentAttribute) {
    let remaining=new Set(nodes.map(n=>n.id)),changed=true;
    while(changed){changed=false;nodes=nodes.filter(n=>{const parent=value(n,diagram.parentAttribute);if(parent!==undefined&&parent!==null&&!remaining.has(parent)){remaining.delete(n.id);changed=true;return false;}return true;});}
  }
  const visible=new Set(nodes.map(n=>n.id));edges=edges.filter(e=>visible.has(e.source)&&visible.has(e.target));
  const shownEdges=new Set(edges.map(e=>e.id));
  for(const key of lists)if(diagram[key]&&key!=='relations')diagram[key]=diagram[key].filter(id=>(['messages','asyncMessages','returns'].includes(key)?shownEdges:visible).has(id));
  if(diagram.initial&&!visible.has(diagram.initial))delete diagram.initial;
  view={...view,diagram};
  if (diagram.type==='state') {
    const objectEvents = stateObjectEvents(edges,profile,view);
    ({nodes,edges}=stateProjection(nodes,edges,view,profile,semanticEdges));
    const modelNodes=new Map(model.nodes.map(node=>[node.id,node]));
    edges=edges.map(edge=>({...edge,...stateTransitionLabels(edge,profile,modelNodes,objectEvents)}));
    ({nodes,edges}=appendVirtualStates(view,modelNodes,nodes,edges));
    if (statePlacement) statePlacementPlans.set(nodes,statePlacement);
  }
  const graph={title:model.title,description:model.description,profile:{id:profile.id,version:profile.version},profileRules:profile,view,nodes,edges};
  if (laneAssignments) activityLanes.set(nodes,laneAssignments);
  if (classPlacement) classPlacementPlans.set(nodes, classPlacement);
  if (isGridDiagram(diagram.type,profile))
    gridPlans.set(nodes,gridProjection(nodes,edges,profile,viewCatalogue,diagram,view._gridIncludes));
  const result=scene(graph,view.theme,'measure',classPlacement,true);graph.bounds=result.bounds??{x:-20,y:-20,width:result.width+40,height:result.height+40};return graph;
}
// Placement expressions have already been checked against the projection.
// The validation-notice wrapper copies graph objects but keeps their node
// arrays. Key on that array to reuse the plan without exposing it in snapshots.
const classPlacementPlans = new WeakMap();
const statePlacementPlans = new WeakMap();
// Measure and paint share each view's projected node array, including draft
// output. Reuse the flow ranks and lane slots between both passes.
const activityRowPlans = new WeakMap();
const activityLanes = new WeakMap();
const tablePlans = new WeakMap();
const sankeyPlans = new WeakMap();
const gridPlans = new WeakMap();
export function toDiagramSVG(graph,{theme,idPrefix}) {
  const result=scene(graph,theme,idPrefix,classPlacementPlans.get(graph.nodes)),bg=theme==='dark'?'#111827':'#fafbfe',stroke=theme==='dark'?'#8b9ab2':'#64748b',b=result.bounds??{x:-20,y:-20,width:result.width+40,height:result.height+40};
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${idPrefix}-diagram" data-arch-svg="${theme}" data-diagram="${graph.view.diagram.type}" role="img" aria-labelledby="${idPrefix}-title" width="${b.width}" height="${b.height}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:${bg}"><title id="${idPrefix}-title">${esc(graph.title)} — ${esc(graph.view.title)}</title><defs><filter id="${idPrefix}-class-shadow" x="-15%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#0f172a" flood-opacity="${theme==='dark'?0.22:0.07}"/></filter><marker id="${idPrefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9Z" fill="${stroke}"/></marker><marker id="${idPrefix}-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 L11 6 L1 11Z" fill="${bg}" stroke="${stroke}"/></marker></defs><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="${bg}"/>${backgroundImageMarkup(graph.view.backgroundImage,b,'view')}${result.body}</svg>`;
}
