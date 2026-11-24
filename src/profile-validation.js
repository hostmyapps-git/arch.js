import { concreteSubtypes, matches, matchesPair, NODE_PROPERTIES, EDGE_PROPERTIES } from './profiles.js';
import { profileHelp } from './diagnostic-help.js';
import { checkConnections } from './connection-rules.js';
import { checkRelationshipConstraints } from './relationship-constraints.js';
import { objectificationDiagnostics } from './objectifications.js';
import { isGridDiagram } from './diagram-types.js';

function validFormat(value, format) {
  if (typeof value !== 'string') return false;
  if (format === 'uri') return /^[A-Za-z][A-Za-z0-9+.-]*:\S+$/.test(value);
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (!date) return false;
  const year = Number(date[1]), month = Number(date[2]), day = Number(date[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return false;
  if (format === 'date') return date[4] === '';
  const time = date[4].match(/^T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/);
  return !!time && Number(time[1]) < 24 && Number(time[2]) < 60 && Number(time[3]) < 60 &&
    (!time[4] || Number(time[5]) < 24 && Number(time[6]) < 60) && Number.isFinite(Date.parse(value));
}

export function viewpointRelationshipMessage(view, edge, type) {
  const action = view._embeddedEdges?.get(edge.id)?.semantic
    ? 'Adjust the embedded source view or the host viewpoint.'
    : `Use exclude ${edge.id} to omit it from this view.`;
  return `${view.id}: Relationship type ${type} is not allowed. ${action}`;
}

export function relationshipEndpointIssues(id, type, rule, source, target, nodeTypes) {
  const wrongSource = source !== undefined && !matches(source, rule.from, nodeTypes);
  const wrongTarget = target !== undefined && !matches(target, rule.to, nodeTypes);
  const wrongPair = rule.pairs && !rule.pairs.some(pair => source && target && matchesPair(source, target, pair, nodeTypes));
  if (!wrongSource && !wrongTarget && !wrongPair) return;

  const issues = [];
  if (wrongSource) issues.push({message:`${id}: source of type ${source} is not allowed for ${type}`, side:'source', allowed:rule.from});
  if (wrongTarget) issues.push({message:`${id}: target of type ${target} is not allowed for ${type}`, side:'target', allowed:rule.to});
  if (wrongPair) issues.push({message:`${id}: Type combination ${source} → ${target} is not allowed for ${type}`});
  return issues;
}

function checkModelRules(model, profile, nodes, add) {
  const abstractType = (type, kind, definitions, item) => {
    const candidates = concreteSubtypes(type, definitions), topic = kind === 'node' ? 'types' : 'relations';
    const help = profileHelp(profile, topic, type);
    const detail = candidates.length ? `Concrete subtypes: ${candidates.slice(0, 12).join(', ')}${candidates.length > 12 ? ` (+${candidates.length - 12} more)` : ''}.`
      : `No concrete subtypes are defined in profile ${profile.id}.`;
    add(`Abstract ${kind} type cannot be instantiated: ${type}. ${detail} See ${help}`, item, { elementId: item.id, candidates, help });
  };
  const checkAttributes = (item, rule, builtins) => {
    const values = Object.create(null);
    for (const key of builtins) if (Object.hasOwn(item,key)) values[key] = item[key];
    Object.assign(values,item.attributes);
    for (const [name, value] of Object.entries(values)) {
      const schema = rule.attributes[name];
      const location = { loc: item.attributeLocs?.[name] ?? item.loc };
      const extra = { elementId: item.id, attribute: name };
      if (!schema && !builtins.includes(name)) { add(`Unknown attribute for ${item.type}: ${name}`, location, extra); continue; }
      const type = schema?.type ?? 'string', many = !!schema?.many;
      if (many !== Array.isArray(value)) { add(`${item.id}.${name}: expected ${many ? 'list' : type}`, location, extra); continue; }
      const entries = many ? value : [value];
      if (many && (entries.length < (schema.minItems ?? 0) || entries.length > (schema.maxItems ?? 4000))) add(`${item.id}.${name}: invalid list length`, location, extra);
      if (many && schema.uniqueItems && new Set(entries).size !== entries.length) add(`${item.id}.${name}: Duplicate list entries are not allowed`, location, extra);
      for (const entry of entries) {
        if (type === 'integer' ? !Number.isInteger(entry) : typeof entry !== (type === 'reference' ? 'string' : type) || (type === 'number' && !Number.isFinite(entry))) {
          add(`${item.id}.${name}: expected ${type}`, location, extra); continue;
        }
        if (!schema) continue;
        if (schema.enum && !schema.enum.includes(entry)) add(`${item.id}.${name}: Value must be one of ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`, location, extra);
        if ((schema.min !== undefined && entry < schema.min) || (schema.max !== undefined && entry > schema.max)) add(`${item.id}.${name}: Number outside the allowed range`, location, extra);
        if ((schema.minLength !== undefined && [...entry].length < schema.minLength) || (schema.maxLength !== undefined && [...entry].length > schema.maxLength)) add(`${item.id}.${name}: invalid text length`, location, extra);
        if (schema.format && !validFormat(entry, schema.format)) add(`${item.id}.${name}: invalid format ${schema.format}`, location, extra);
        if (type === 'reference') {
          const target = nodes.get(entry);
          if (!target) add(`${item.id}.${name}: unknown reference ${entry}`, location, extra);
          else if (!matches(target.type, schema.targets, profile.nodeTypes)) add(`${item.id}.${name}: Reference type ${target.type} is not allowed`, location, extra);
        }
      }
    }
    for (const [name, schema] of Object.entries(rule.attributes)) if (schema.required && !Object.hasOwn(values, name)) add(`${item.id}: Missing required attribute ${name}`, item, { elementId: item.id, attribute: name, incomplete:true });
    for (const check of rule.comparisons ?? []) {
      const a = rule.attributes[check.left], b = rule.attributes[check.right];
      let left = values[check.left], right = values[check.right];
      if (left === undefined || right === undefined || typeof left !== typeof right) continue;
      if (a.format && (!validFormat(left, a.format) || !validFormat(right, b.format))) continue;
      if (a.format === 'date' || a.format === 'date-time') { left = Date.parse(left); right = Date.parse(right); }
      const ok = { '<': left < right, '<=': left <= right, '=': left === right, '!=': left !== right, '>=': left >= right, '>': left > right }[check.op];
      if (!ok) add(`${item.id}: ${check.left} ${check.op} ${check.right} is not satisfied`, item, { elementId: item.id });
    }
  };
  for (const node of model.nodes) {
    const rule = profile.nodeTypes[node.type];
    if (!rule) { add(`Unknown element type in profile ${profile.id}: ${node.type}`, node, { elementId: node.id }); continue; }
    if (rule.abstract) abstractType(node.type, 'node', profile.nodeTypes, node);
    if (node.parent) {
      const parent = nodes.get(node.parent), parentRule = profile.nodeTypes[parent?.type];
      if (parentRule && !parentRule.container) add(`${node.parent} is not a container`, node, { elementId: node.id });
      else if (parentRule && !matches(node.type, parentRule.contains, profile.nodeTypes)) add(`${node.type} is not allowed in ${parent.type}`, node, { elementId: node.id });
    }
    checkAttributes(node, rule, NODE_PROPERTIES);
  }
  for (const edge of model.edges) {
    const type = edge.type ?? profile.defaultRelation, rule = profile.relationTypes[type];
    if (!rule) { add(type ? `Unknown relationship type in profile ${profile.id}: ${type}` : `Relationship ${edge.id} requires an explicit type`, edge, { elementId: edge.id }); continue; }
    if (rule.abstract) abstractType(type, 'relationship', profile.relationTypes, edge);
    const direction=edge.direction??'forward';
    if(!['forward','both'].includes(direction))add(`${edge.id}: direction must be forward or both`,edge,{elementId:edge.id,attribute:'direction'});
    else if(!(rule.directions??['forward']).includes(direction))add(`${edge.id}: ${type} does not allow direction ${direction}; allowed directions: ${(rule.directions??['forward']).join(', ')}`,edge,{elementId:edge.id,attribute:'direction'});
    if (!rule.allowSelf && edge.source === edge.target) add(`${type}: Self-relationships are not allowed`, edge, { elementId: edge.id });
    const issues = relationshipEndpointIssues(edge.id, type, rule, nodes.get(edge.source)?.type, nodes.get(edge.target)?.type, profile.nodeTypes);
    if (issues) for (const {message} of issues) add(message, edge, {elementId:edge.id});
    checkAttributes({ ...edge, type }, rule, EDGE_PROPERTIES);
  }
  checkRelationshipConstraints(model, profile, add);
}

export function profileDiagnostics(model, profile, graph, sharedChecks) {
  const result = sharedChecks?.modelDiagnostics?.slice() ?? [];
  const { nodesById: nodes, edgesById: edges } = graph;
  const viewpoints = new Map(model.views.map(view => [view.id, view.viewpoint]));
  const helpFor = ({viewId, elementId}) => {
    if (viewId !== undefined) {
      const name = viewpoints.get(viewId);
      return profileHelp(profile, 'viewpoints', Object.hasOwn(profile.viewpoints, name) ? name : undefined);
    }
    const edge = edges.get(elementId);
    const topic = edge ? 'relations' : 'types';
    const name = edge ? edge.type ?? profile.defaultRelation : nodes.get(elementId)?.type;
    const types = edge ? profile.relationTypes : profile.nodeTypes;
    return profileHelp(profile, topic, Object.hasOwn(types, name) ? name : undefined);
  };
  const add = (message, item, extra = {}) => result.push({ severity: 'error', code: profile.id === 'default' ? 'ARCH_VALIDATION' : 'ARCH_SEMANTIC', message,
    line: item?.loc?.line ?? null, column: item?.loc?.column ?? null, ...(item?.loc?.path !== undefined ? {path: item.loc.path} : {}),
    help: extra.help ?? helpFor(extra), ...extra });
  if (!sharedChecks?.modelDiagnostics) {
    checkModelRules(model, profile, nodes, add);
    if (sharedChecks) sharedChecks.modelDiagnostics = result.slice();
  }
  let objectifications = sharedChecks?.objectifications;
  for (const view of model.views) {
    if(view.meta!==undefined)continue; // Source views do not project domain elements into a viewpoint.
    if (!view.viewpoint) { if (profile.requireViewpoint) add(`View ${view.id} requires a viewpoint`, view, { viewId: view.id,incomplete:true }); continue; }
    const rule = profile.viewpoints[view.viewpoint];
    if (!rule) { add(`Unknown viewpoint: ${view.viewpoint}`, view, { viewId: view.id }); continue; }
    // An explicitly element-free grid is a diagram catalogue. Its tiles
    // can refer to validated views without importing their model elements.
    if (view.include?.length===0 && isGridDiagram(view.diagram?.type,profile)) continue;
    const selection = graph.project(view, false);
    const { ids: visible, nodes: selectedNodes, edges: selectedEdges } = selection;
    if (rule.objectifications?.length) {
      objectifications ??= new Map();
      if (sharedChecks) sharedChecks.objectifications = objectifications;
      objectificationDiagnostics(model,profile,view,rule.objectifications,graph,selection,objectifications,add);
    }
    for (const node of selectedNodes) if (!matches(node.type, rule.nodes, profile.nodeTypes)) add(`${view.id}: node type ${node.type} is not allowed in viewpoint ${view.viewpoint}`, node, { elementId: node.id, viewId: view.id });
    for (const edge of selectedEdges) {
      const type = edge.type ?? profile.defaultRelation;
      if (!matches(type, rule.relations, profile.relationTypes)) add(viewpointRelationshipMessage(view, edge, type), edge, { elementId: edge.id, viewId: view.id });
    }
    for (const type of rule.requiredNodes) if (!selectedNodes.some(node => matches(node.type, [type], profile.nodeTypes))) add(`${view.id}: Missing required node type ${type}`, view, { viewId: view.id,incomplete:true });
    for (const type of rule.requiredRelations) if (!selectedEdges.some(edge => matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes))) add(`${view.id}: Missing required relationship type ${type}`, view, { viewId: view.id,incomplete:true });
    checkConnections(rule.connections, profile, view, graph, selection, add);
    for (const check of rule.references ?? []) for (const item of check.nodes ? selectedNodes : selectedEdges) if (matches(item.type, check.nodes ?? check.relations, check.nodes ? profile.nodeTypes : profile.relationTypes)) {
      for (const attr of check.attributes) for (const id of [item.attributes?.[attr]].flat().filter(v => typeof v === 'string')) if (!visible.has(id))
        add(`${view.id}: ${item.id}.${attr} references ${id}, which must be visible in viewpoint ${view.viewpoint}`, item, { elementId: item.id, attribute: attr, viewId: view.id });
    }
  }
  return result;
}
