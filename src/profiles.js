import { ArchError } from './errors.js';
import { normalizeColor } from './colors.js';
import { naf41LegacyGrid } from '../profiles/naf41/viewpoint-grid.mjs';
import { DIAGRAMS, GRID_MODES, GRID_VISIBILITY, GRID_VISIBILITY_ERROR } from './diagram-types.js';

// These are drawing primitives, not framework/metamodel types.
export const TEMPLATES = Object.freeze(['person', 'system', 'application', 'service', 'component', 'database',
  'queue', 'interface', 'capability', 'process', 'artifact', 'node', 'package']);
export const EDGE_STYLES = Object.freeze(['flow', 'dependency', 'association', 'access', 'composition', 'realization', 'generalization']);
export const NODE_PROPERTIES = Object.freeze(['description', 'technology', 'icon', 'stereotype', 'tags', 'backgroundImage']);
export const EDGE_PROPERTIES = Object.freeze(['description', 'technology', 'tags', 'direction']);
const registry = new Map();
const revisions = new Map();
const lockedRevisions = new Set();
const compiledProfiles = new WeakSet();
const typeAncestry = new WeakMap();
const idPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const reservedTypes = new Set(['relation', 'model', 'view', 'config', 'architecture']);
const reservedAttributes = new Set(['id', 'type', 'title', 'parent', 'loc', 'attributes', 'attributeLocs', 'relation']);
const fail = message => { throw new ArchError(message, {}, 'ARCH_PROFILE'); };
const own = (object, key) => Object.hasOwn(object, key);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const documentationKeys = ['title', 'description', 'sources', 'limitations'];
function documentation(raw, label) {
  const result = {};
  for (const key of ['title', 'description']) if (raw[key] !== undefined) {
    if (typeof raw[key] !== 'string' || raw[key].length > 16000) fail(`${label}.${key}: expected text (at most 16000 characters)`);
    result[key] = raw[key];
  }
  for (const key of ['sources', 'limitations']) if (raw[key] !== undefined) {
    if (!Array.isArray(raw[key]) || raw[key].length > 128 || raw[key].some(s => typeof s !== 'string' || s.length > 4000)) fail(`${label}.${key}: expected a text list`);
    result[key] = [...raw[key]];
  }
  return result;
}
const copy = value => JSON.parse(JSON.stringify(value));
const stable = value => value && typeof value === 'object' ? Array.isArray(value) ? value.map(stable) : Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function keys(value, allowed, label) {
  if (!record(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unknown option ${key}`);
}
function identifier(value, label) {
  if (typeof value !== 'string' || !idPattern.test(value)) fail(`${label}: invalid identifier ${value}`);
}
function names(value, label, fallback = ['*'], allowEmpty = false) {
  const array = value === undefined ? fallback : typeof value === 'string' ? [value] : value;
  if (!Array.isArray(array) || !allowEmpty && !array.length || array.length > 512) fail(`${label}: invalid name list`);
  for (const item of array) if (item !== '*') identifier(item, label);
  return [...new Set(array)];
}
function cardinality(value, label) {
  if (value === undefined) return undefined;
  keys(value, ['min', 'max'], label);
  const result = { min: value.min ?? 0, max: value.max ?? null };
  if (!Number.isInteger(result.min) || result.min < 0 || result.min > 4000 ||
      (result.max !== null && (!Number.isInteger(result.max) || result.max < result.min || result.max > 4000))) fail(`${label}: invalid cardinality`);
  return result;
}
function attributes(value = {}, label) {
  if (!record(value) || Object.keys(value).length > 128) fail(`${label}: invalid attribute definitions`);
  const result = Object.create(null);
  for (const [name, rule] of Object.entries(value)) {
    identifier(name, label);
    if (reservedAttributes.has(name)) fail(`${label}: reserved attribute ${name}`);
    keys(rule, ['type', 'required', 'enum', 'min', 'max', 'minLength', 'maxLength', 'many', 'minItems', 'maxItems', 'uniqueItems', 'targets', 'format'], `${label}.${name}`);
    const type = rule.type ?? 'string';
    if (!['string', 'number', 'integer', 'boolean', 'reference'].includes(type)) fail(`${label}.${name}: unknown data type ${type}`);
    if (rule.required !== undefined && typeof rule.required !== 'boolean') fail(`${label}.${name}: required must be boolean`);
    const normalized = { type, required: rule.required ?? false };
    if (rule.many !== undefined && typeof rule.many !== 'boolean') fail(`${label}.${name}: many must be boolean`);
    if (rule.many) normalized.many = true;
    if (rule.uniqueItems !== undefined) {
      if (!rule.many || typeof rule.uniqueItems !== 'boolean') fail(`${label}.${name}: uniqueItems requires many`);
      normalized.uniqueItems = rule.uniqueItems;
    }
    for (const bound of ['minItems', 'maxItems']) if (rule[bound] !== undefined) {
      if (!rule.many || !Number.isInteger(rule[bound]) || rule[bound] < 0 || rule[bound] > 4000) fail(`${label}.${name}: invalid bound ${bound}`);
      normalized[bound] = rule[bound];
    }
    if ((normalized.minItems ?? 0) > (normalized.maxItems ?? 4000)) fail(`${label}.${name}: inconsistent list bounds`);
    if (type === 'reference') normalized.targets = names(rule.targets, `${label}.${name}.targets`);
    else if (rule.targets !== undefined) fail(`${label}.${name}: targets requires type reference`);
    if (rule.format !== undefined) {
      if (type !== 'string' || !['date', 'date-time', 'uri'].includes(rule.format)) fail(`${label}.${name}: invalid format`);
      normalized.format = rule.format;
    }
    for (const bound of ['min', 'max', 'minLength', 'maxLength']) if (rule[bound] !== undefined) {
      if (!Number.isFinite(rule[bound]) || (bound.includes('Length') ? type !== 'string' || !Number.isInteger(rule[bound]) || rule[bound] < 0 : !['number', 'integer'].includes(type)))
        fail(`${label}.${name}: invalid bound ${bound}`);
      normalized[bound] = rule[bound];
    }
    if ((normalized.min !== undefined && normalized.max !== undefined && normalized.min > normalized.max) ||
        (normalized.minLength !== undefined && normalized.maxLength !== undefined && normalized.minLength > normalized.maxLength)) fail(`${label}.${name}: inconsistent bounds`);
    if (rule.enum !== undefined) {
      if (!Array.isArray(rule.enum) || !rule.enum.length || rule.enum.length > 256 || rule.enum.some(v =>
        type === 'integer' ? !Number.isInteger(v) : typeof v !== (type === 'reference' ? 'string' : type) || (type === 'number' && !Number.isFinite(v)))) fail(`${label}.${name}: invalid enum values`);
      normalized.enum = [...new Set(rule.enum)];
    }
    if ([...NODE_PROPERTIES, ...EDGE_PROPERTIES].includes(name) && (type !== 'string' || rule.many)) fail(`${label}.${name}: Built-in attributes must remain scalar strings`);
    result[name] = normalized;
  }
  return result;
}

const bases = rule => typeof rule?.extends === 'string' ? [rule.extends] : rule?.extends ?? [];
// Alias entries are resolved lookup views, never additional inheritance nodes.
export const canonicalType = (name, definitions) => definitions[name]?.aliasOf ?? name;
const registered = selection => revisions.get(selection) ?? registry.get(selection);
export function getProfileVersions(name) {
  if (!registry.has(name)) fail(`Unknown profile: ${name}`);
  return [...revisions.values()].filter(p => p.id === name).map(p => p.version);
}
function mappingDefinitions(value = []) {
  if (!Array.isArray(value) || value.length > 512) fail('Profile.mappings: expected at most 512 mappings');
  return value.map(raw => {
    keys(raw, ['kind', 'source', 'target', 'relationship', ...documentationKeys], 'Mapping');
    if (!['node', 'relation'].includes(raw.kind)) fail('Mapping.kind must be node or relation');
    if (!['rename', 'equivalent', 'specialization', 'partial'].includes(raw.relationship)) fail('Mapping.relationship must be rename, equivalent, specialization or partial');
    const endpoint = (value, label) => {
      keys(value, ['framework', 'version', 'type'], label);
      for (const key of ['framework', 'version', 'type']) if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 256) fail(`${label}.${key}: expected nonempty text`);
      return { ...value };
    };
    return { ...documentation(raw, 'Mapping'), kind: raw.kind, source: endpoint(raw.source, 'Mapping.source'),
      target: endpoint(raw.target, 'Mapping.target'), relationship: raw.relationship };
  });
}
function parentNames(value, label) {
  if (value === undefined) return [];
  const values = names(value, label, [], true);
  if (values.includes('*')) fail(`${label}: A wildcard cannot be used as a base type`);
  return values;
}
function mergeAttributes(parents, local, label) {
  const result = Object.create(null);
  for (const parent of parents) for (const [key, value] of Object.entries(parent.attributes)) {
    if (own(result, key) && JSON.stringify(result[key]) !== JSON.stringify(value) && !own(local ?? {}, key))
      fail(`${label}.${key}: ambiguous inherited attribute rule; a local override is required`);
    result[key] = value;
  }
  return Object.assign(result, attributes(local, label));
}
function comparisons(value = [], label) {
  if (!Array.isArray(value) || value.length > 128) fail(`${label}: invalid comparisons`);
  return value.map(rule => {
    keys(rule, ['left', 'op', 'right'], label);
    identifier(rule.left, label); identifier(rule.right, label);
    if (!['<', '<=', '=', '!=', '>=', '>'].includes(rule.op)) fail(`${label}: unknown comparison`);
    return { left: rule.left, op: rule.op, right: rule.right };
  });
}

function gridLayout(raw, viewpoints, styleGroups, label) {
  keys(raw,['viewpoint','title','columns','rows','cells','products','diagrams','show'],label);
  const {viewpoint,title,columns,rows,cells,products,diagrams,show} = raw;
  const text = value => typeof value === 'string' && value.length <= 200;
  if (viewpoint!==undefined && !own(viewpoints,viewpoint) || !text(title) || !title) fail(`${label}: expected a title and an optional known viewpoint`);
  const checkModes = item => {
    for (const field of ['products','diagrams']) if (item[field]!==undefined && !GRID_MODES.includes(item[field]))
      fail(`${label}: ${field} must be count, list or none`);
  };
  checkModes(raw);
  if (show!==undefined && !GRID_VISIBILITY.includes(show)) fail(`${label}: ${GRID_VISIBILITY_ERROR}`);
  if (!Array.isArray(columns) || !columns.length || columns.length>16 || !columns.every(text)) fail(`${label}: invalid columns`);
  if (!Array.isArray(rows) || !rows.length || rows.length>16) fail(`${label}: invalid rows`);
  const palette = rows.map(row => {
    keys(row,['title','color','darkColor','styleGroup'],label);
    const {title,styleGroup} = row;
    if (!text(title)) fail(`${label}: invalid row title`);
    if (styleGroup!==undefined) {
      identifier(styleGroup,label);
      if (!own(styleGroups,styleGroup) || !styleGroups[styleGroup].backgroundColor)
        fail(`${label}: row styleGroup ${styleGroup} must define a backgroundColor`);
      if (row.color!==undefined || row.darkColor!==undefined)
        fail(`${label}: use styleGroup or explicit row colors`);
      return {title,styleGroup};
    }
    const color=normalizeColor(row.color), darkColor=normalizeColor(row.darkColor);
    if (!color || !darkColor) fail(`${label}: invalid row colors`);
    return {title,color,darkColor};
  });
  if (!Array.isArray(cells) || !cells.length || cells.length>128) fail(`${label}: invalid cells`);
  const ids = new Set(), positions = new Set();
  for (const cell of cells) {
    keys(cell,['id','row','col','bridge','vertical','products','diagrams'],label);
    checkModes(cell);
    const {id,row,col,bridge,vertical} = cell;
    const position = `${row},${col},${Boolean(bridge)}`;
    if (!own(viewpoints,id) || ids.has(id) || positions.has(position) ||
        !Number.isInteger(row) || row<0 || row>=rows.length || !Number.isInteger(col) || col<0 || col>=columns.length ||
        bridge!==undefined && typeof bridge!=='boolean' || vertical!==undefined && typeof vertical!=='boolean')
      fail(`${label}: invalid or duplicate cell ${id}`);
    ids.add(id); positions.add(position);
  }
  return {viewpoint,title,columns:[...columns],rows:palette,cells:copy(cells),products,diagrams,...(show!==undefined ? {show} : {})};
}

export function compileProfile(definition, fallbackId) {
  if (compiledProfiles.has(definition)) return definition;
  keys(definition, ['id', ...documentationKeys, 'version', 'extends', 'aliases', 'mappings', 'nodeTypes', 'relationTypes', 'viewpoints', 'viewpointGrid', 'diagrams', 'styleGroups', 'defaultRelation', 'requireViewpoint'], 'Profile');
  const id = definition.id ?? fallbackId;
  identifier(id, 'Profile ID');
  if (definition.extends !== undefined && (typeof definition.extends !== 'string' || !registered(definition.extends))) fail(`Unknown base profile: ${definition.extends}`);
  const base = definition.extends ? registered(definition.extends) : undefined;
  for (const key of ['title', 'version']) if (definition[key] !== undefined && typeof definition[key] !== 'string') fail(`Profile.${key} must be a string`);
  if (definition.version !== undefined && !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(definition.version)) fail('Profile.version must be an identifier-like version without @ or whitespace');
  if (definition.requireViewpoint !== undefined && typeof definition.requireViewpoint !== 'boolean') fail('requireViewpoint must be boolean');
  const merged = key => {
    const values = definition[key] ?? {};
    if (!record(values)) fail(`Profile.${key} must be an object`);
    return Object.assign(Object.create(null), base?.[key] ?? {}, values);
  };
  const rawNodes = merged('nodeTypes'), rawEdges = merged('relationTypes'), rawViews = merged('viewpoints');
  const aliases = {}, aliasTargets = {}, mirrors = [];
  if (definition.aliases !== undefined) keys(definition.aliases, ['nodeTypes', 'relationTypes'], 'Profile.aliases');
  for (const [kind, rawTypes] of [['nodeTypes', rawNodes], ['relationTypes', rawEdges]]) {
    const local = definition.aliases?.[kind] ?? {};
    if (!record(local)) fail(`Profile.aliases.${kind} must be an object`);
    const table = Object.assign(Object.create(null), base?.aliases?.[kind] ?? {}, local);
    if (Object.keys(table).length > 512) fail(`Too many ${kind} aliases`);
    for (const [name, raw] of Object.entries(table)) {
      identifier(name, 'Alias');
      if (reservedTypes.has(name)) fail(`Reserved alias: ${name}`);
      if (typeof raw !== 'string') keys(raw, ['target', ...documentationKeys], `Alias ${name}`);
      const target = typeof raw === 'string' ? raw : raw.target;
      identifier(target, `Alias ${name} target`);
      const previous = base?.aliases?.[kind]?.[name];
      if (previous !== undefined && (typeof previous === 'string' ? previous : previous.target) !== target) fail(`Alias ${name}: cannot change an inherited target`);
      table[name] = typeof raw === 'string' ? raw : { target, ...documentation(raw, `Alias ${name}`) };
      if (own(rawTypes, name)) {
        // Detached compiled profiles/parsed-model snapshots contain lookup entries.
        // Accept only exact generated mirrors; user-defined alias semantics fail.
        if (!rawTypes[name]?.aliasOf) fail(`Alias ${name}: conflicts with a ${kind} definition`);
        if (own(definition[kind] ?? {}, name)) mirrors.push({ kind, name, rule: rawTypes[name] });
        delete rawTypes[name];
      }
    }
    const targets = Object.create(null), visiting = new Set();
    const resolve = name => {
      if (own(targets, name)) return targets[name];
      if (visiting.has(name)) fail(`Cyclic ${kind} alias: ${name}`);
      visiting.add(name);
      const raw = table[name], next = typeof raw === 'string' ? raw : raw.target;
      const target = own(table, next) ? resolve(next) : next;
      if (!own(rawTypes, target)) fail(`Alias ${name}: unknown ${kind} target ${target}`);
      visiting.delete(name); return targets[name] = target;
    };
    for (const name of Object.keys(table)) resolve(name);
    aliases[kind] = table; aliasTargets[kind] = targets;
  }
  const styleGroups = merged('styleGroups');
  if (Object.keys(styleGroups).length > 512) fail('Too many style groups');
  for (const [name, group] of Object.entries(styleGroups)) {
    identifier(name, 'Style group'); keys(group, ['backgroundColor'], `Style group ${name}`);
    if (group.backgroundColor !== undefined && !normalizeColor(group.backgroundColor)) fail(`${name}: invalid backgroundColor`);
    styleGroups[name] = group.backgroundColor === undefined ? { ...group } : { backgroundColor: normalizeColor(group.backgroundColor) };
  }
  if (!Object.keys(rawNodes).length || Object.keys(rawNodes).length > 512 || Object.keys(rawEdges).length > 512 || Object.keys(rawViews).length > 128) fail('Profile requires 1–512 node types; at most 512 relation types and 128 viewpoints');
  const nodeTypes = Object.create(null), relationTypes = Object.create(null), viewpoints = Object.create(null);
  const compiling = new Set();
  const node = name => {
    if (own(nodeTypes, name)) return nodeTypes[name];
    if (own(aliasTargets.nodeTypes, name)) return nodeTypes[name] = { ...node(aliasTargets.nodeTypes[name]), aliasOf: aliasTargets.nodeTypes[name] };
    if (!own(rawNodes, name) || compiling.has(`n:${name}`)) fail(`Unknown or cyclic node type: ${name}`);
    identifier(name, 'node type');
    if (reservedTypes.has(name)) fail(`Reserved node type: ${name}`);
    const raw = rawNodes[name];
    keys(raw, ['extends', 'template', 'container', 'contains', 'abstract', 'attributes', 'icon', 'accent', 'backgroundColor', 'styleGroup', 'comparisons', ...documentationKeys], `node type ${name}`);
    compiling.add(`n:${name}`);
    const baseNames = parentNames(raw.extends, `Base type of ${name}`), parents = baseNames.map(node), parent = parents[0];
    const result = { ...documentation(raw, name), template: raw.template ?? parent?.template ?? 'node', container: raw.container,
      abstract: raw.abstract ?? false, attributes: mergeAttributes(parents, raw.attributes, name) };
    for (const key of ['icon', 'accent']) if (raw[key] !== undefined || parent?.[key] !== undefined) result[key] = raw[key] ?? parent[key];
    for (const key of ['styleGroup', 'backgroundColor']) if (raw[key] !== undefined || parent?.[key] !== undefined) result[key] = raw[key] ?? parent[key];
    if (result.styleGroup !== undefined && !own(styleGroups, result.styleGroup)) fail(`${name}: unknown style group ${result.styleGroup}`);
    if (result.backgroundColor !== undefined && !normalizeColor(result.backgroundColor)) fail(`${name}: invalid backgroundColor`);
    if (raw.extends !== undefined) result.extends = Array.isArray(raw.extends) ? baseNames : raw.extends;
    const checks = [...parents.flatMap(p => p.comparisons ?? []), ...comparisons(raw.comparisons, name)];
    if (checks.length) result.comparisons = [...new Map(checks.map(check => [JSON.stringify(check), check])).values()];
    for (const check of result.comparisons ?? []) {
      const a = result.attributes[check.left], b = result.attributes[check.right];
      if (!a || !b || a.many || b.many || a.type !== b.type || !['number', 'integer', 'string'].includes(a.type) || a.format !== b.format)
        fail(`${name}: Comparison requires two compatible scalar attributes`);
    }
    if (!TEMPLATES.includes(result.template)) fail(`Unknown template for ${name}: ${result.template}`);
    result.container ??= result.template === 'package';
    if (typeof result.abstract !== 'boolean' || typeof result.container !== 'boolean' || result.container !== (result.template === 'package')) fail(`${name}: Containers require template package`);
    if (raw.contains !== undefined && !result.container) fail(`${name}: contains is only allowed for containers`);
    if (result.container) result.contains = names(raw.contains ?? parent?.contains, `${name}.contains`, ['*'], true);
    if (result.icon !== undefined && (typeof result.icon !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(result.icon))) fail(`${name}: invalid icon reference`);
    if (result.accent !== undefined && !normalizeColor(result.accent)) fail(`${name}: invalid accent color`);
    for (const key of ['accent', 'backgroundColor']) if (result[key] !== undefined) result[key] = normalizeColor(result[key]);
    nodeTypes[name] = result; compiling.delete(`n:${name}`); return result;
  };
  for (const name of Object.keys(rawNodes)) node(name);
  for (const name of Object.keys(aliases.nodeTypes)) node(name);
  const knownNodes = (list, label) => { for (const name of list) if (name !== '*' && !own(nodeTypes, name)) fail(`${label}: unknown node type ${name}`); };
  const checkReferences = (rule, label) => { for (const [key, attr] of Object.entries(rule.attributes)) if (attr.type === 'reference') knownNodes(attr.targets, `${label}.${key}`); };
  for (const [name, rule] of Object.entries(nodeTypes)) {
    if (rule.container) knownNodes(rule.contains, `${name}.contains`);
    checkReferences(rule, name);
  }
  const relation = name => {
    if (own(relationTypes, name)) return relationTypes[name];
    if (own(aliasTargets.relationTypes, name)) return relationTypes[name] = { ...relation(aliasTargets.relationTypes[name]), aliasOf: aliasTargets.relationTypes[name] };
    if (!own(rawEdges, name) || compiling.has(`e:${name}`)) fail(`Unknown or cyclic relation type: ${name}`);
    identifier(name, 'relation type');
    const raw = rawEdges[name];
    keys(raw, ['extends', 'from', 'to', 'directions', 'style', 'abstract', 'allowSelf', 'attributes', 'outgoing', 'incoming', 'pairs', 'acyclic', 'sequenceMessage', 'sequenceContext', 'activityFlow', 'stateTrigger', 'referenceLabels', 'referenceConnectorLabels', 'referenceDisplay', 'referenceOccurrences', ...documentationKeys], `relation type ${name}`);
    compiling.add(`e:${name}`);
    const baseNames = parentNames(raw.extends, `Base relationship of ${name}`), parents = baseNames.map(relation), parent = parents[0];
    const result = { ...documentation(raw, name), from: names(raw.from ?? parent?.from, `${name}.from`), to: names(raw.to ?? parent?.to, `${name}.to`),
      style: raw.style ?? parent?.style ?? 'flow', abstract: raw.abstract ?? false, allowSelf: raw.allowSelf ?? parent?.allowSelf ?? true,
      attributes: mergeAttributes(parents, raw.attributes, name) };
    if (raw.extends !== undefined) result.extends = Array.isArray(raw.extends) ? baseNames : raw.extends;
    result.directions=names(raw.directions ?? parent?.directions, `${name}.directions`, ['forward']);
    if(result.directions.some(d=>!['forward','both'].includes(d)))fail(`${name}.directions must contain only forward or both`);
    if(result.directions.includes('both')&&['composition','generalization','realization'].includes(result.style))fail(`${name}: ${result.style} does not support bidirectional relationships`);
    const referenceLabels = raw.referenceLabels ?? parent?.referenceLabels;
    if (raw.sequenceMessage !== undefined || parent?.sequenceMessage !== undefined) {
      result.sequenceMessage = raw.sequenceMessage ?? parent.sequenceMessage;
      if (typeof result.sequenceMessage !== 'boolean') fail(`${name}.sequenceMessage must be boolean`);
    }
    const sequenceContext=raw.sequenceContext ?? parent?.sequenceContext;
    if (sequenceContext!==undefined) {
      if (!['above','side'].includes(sequenceContext)) fail(`${name}.sequenceContext must be above or side`);
      result.sequenceContext=sequenceContext;
    }
    const activityFlow = raw.activityFlow === undefined ? parents.find(rule=>rule.activityFlow !== undefined)?.activityFlow : raw.activityFlow;
    if (activityFlow !== undefined) {
      if (typeof activityFlow !== 'boolean') fail(`${name}.activityFlow must be boolean`);
      result.activityFlow = activityFlow;
    }
    const stateTrigger = raw.stateTrigger === undefined ? parents.find(rule => rule.stateTrigger !== undefined)?.stateTrigger : raw.stateTrigger;
    if (stateTrigger !== undefined) {
      identifier(stateTrigger, `${name}.stateTrigger`);
      if (result.attributes[stateTrigger]?.type !== 'reference') fail(`${name}.stateTrigger: ${stateTrigger} must be a reference attribute`);
      result.stateTrigger = stateTrigger;
    }
    if (raw.referenceConnectorLabels !== undefined || parent?.referenceConnectorLabels !== undefined) {
      result.referenceConnectorLabels = raw.referenceConnectorLabels ?? parent.referenceConnectorLabels;
      if (typeof result.referenceConnectorLabels !== 'boolean') fail(`${name}.referenceConnectorLabels must be boolean`);
    }
    if (raw.referenceDisplay !== undefined || parent?.referenceDisplay !== undefined) {
      result.referenceDisplay = raw.referenceDisplay ?? parent.referenceDisplay;
      if (!['labels', 'nodes', 'both'].includes(result.referenceDisplay)) fail(`${name}.referenceDisplay must be labels, nodes or both`);
    }
    if (raw.referenceOccurrences !== undefined || parent?.referenceOccurrences !== undefined) {
      result.referenceOccurrences = raw.referenceOccurrences ?? parent.referenceOccurrences;
      if (!['shared', 'perEdge'].includes(result.referenceOccurrences)) fail(`${name}.referenceOccurrences must be shared or perEdge`);
    }
    if (referenceLabels !== undefined) {
      if (!record(referenceLabels) || Object.keys(referenceLabels).length > 128) fail(`${name}.referenceLabels: expected an attribute-to-label map`);
      result.referenceLabels = Object.create(null);
      for (const [attribute, label] of Object.entries(referenceLabels)) {
        if (!own(result.attributes, attribute) || result.attributes[attribute].type !== 'reference') fail(`${name}.referenceLabels: ${attribute} must be a reference attribute`);
        if (typeof label !== 'string' || !label.trim() || label.length > 80) fail(`${name}.referenceLabels: expected a nonempty label of at most 80 characters`);
        result.referenceLabels[attribute] = label;
      }
    }
    if (raw.acyclic !== undefined && typeof raw.acyclic !== 'boolean') fail(`${name}.acyclic must be boolean`);
    if (raw.acyclic ?? parent?.acyclic) result.acyclic = true;
    const pairs = raw.pairs ?? parent?.pairs;
    if (pairs !== undefined) {
      if (!Array.isArray(pairs) || !pairs.length || pairs.length > 512) fail(`${name}: invalid pairs`);
      result.pairs = pairs.map(pair => {
        keys(pair, ['from', 'to', 'fromExclude', 'toExclude'], `${name}.pairs`);
        const normalized = { from: names(pair.from, name), to: names(pair.to, name) };
        for (const key of ['fromExclude', 'toExclude']) if (pair[key] !== undefined) normalized[key] = names(pair[key], name, [], true);
        for (const [key, values] of Object.entries(normalized)) knownNodes(values, `${name}.${key}`);
        return normalized;
      });
    }
    if (!EDGE_STYLES.includes(result.style)) fail(`Unknown edge style for ${name}: ${result.style}`);
    if (typeof result.abstract !== 'boolean' || typeof result.allowSelf !== 'boolean') fail(`${name}: abstract/allowSelf must be boolean`);
    for (const key of ['outgoing', 'incoming']) {
      const value = cardinality(raw[key] ?? parent?.[key], `${name}.${key}`);
      if (value) result[key] = value;
    }
    knownNodes(result.from, `${name}.from`); knownNodes(result.to, `${name}.to`);
    checkReferences(result, name);
    relationTypes[name] = result; compiling.delete(`e:${name}`); return result;
  };
  for (const name of Object.keys(rawEdges)) relation(name);
  for (const name of Object.keys(aliases.relationTypes)) relation(name);
  for (const mirror of mirrors) if (JSON.stringify(stable(mirror.rule)) !== JSON.stringify(stable((mirror.kind === 'nodeTypes' ? nodeTypes : relationTypes)[mirror.name]))) fail(`Alias ${mirror.name}: resolved lookup entry cannot override target rules`);
  const knownEdges = (list, label) => { for (const name of list) if (name !== '*' && !own(relationTypes, name)) fail(`${label}: unknown relation type ${name}`); };
  for (const [name, raw] of Object.entries(rawViews)) {
    identifier(name, 'Viewpoint');
    keys(raw, ['nodes', 'relations', 'requiredNodes', 'requiredRelations', 'connections', 'references', 'objectifications', 'representations', ...documentationKeys], `Viewpoint ${name}`);
    const result = { ...documentation(raw, name), nodes: names(raw.nodes, `${name}.nodes`, ['*'], true), relations: names(raw.relations, `${name}.relations`, ['*'], true),
      requiredNodes: raw.requiredNodes === undefined ? [] : names(raw.requiredNodes, `${name}.requiredNodes`, [], true),
      requiredRelations: raw.requiredRelations === undefined ? [] : names(raw.requiredRelations, `${name}.requiredRelations`, [], true) };
    if (raw.representations !== undefined) {
      if (!Array.isArray(raw.representations) || raw.representations.length > 32 || raw.representations.some(value => typeof value !== 'string' || value.length > 4000)) fail(`${name}.representations: expected a text list`);
      result.representations = [...raw.representations];
    }
    knownNodes(result.nodes, name); knownNodes(result.requiredNodes, name); knownEdges(result.relations, name); knownEdges(result.requiredRelations, name);
    if (result.requiredNodes.includes('*') || result.requiredRelations.includes('*')) fail(`${name}: Required type lists cannot contain a wildcard`);
    if(raw.objectifications!==undefined) {
      if(!Array.isArray(raw.objectifications)||raw.objectifications.length>128)fail(`${name}: invalid objectifications`);
      result.objectifications=raw.objectifications.map(check=>{
        keys(check,['nodes','relations','attribute','endpoints','allowLegacy','required','payload','stateEventRelations'],`${name}.objectifications`);
        const value={nodes:names(check.nodes,name),relations:names(check.relations,name),attribute:check.attribute,allowLegacy:check.allowLegacy??false,required:check.required??false};
        if(value.nodes.includes('*')||value.relations.includes('*'))fail(`${name}: objectifications require explicit node and relationship types`);
        knownNodes(value.nodes,name);knownEdges(value.relations,name);identifier(value.attribute,`${name}.objectifications.attribute`);
        if(typeof value.allowLegacy!=='boolean'||typeof value.required!=='boolean')fail(`${name}: objectification allowLegacy/required must be boolean`);
        for(const type of value.relations) {
          const attr=relationTypes[type].attributes[value.attribute];
          if(attr?.type!=='reference'||attr.many||value.nodes.some(n=>!matches(n,attr.targets,nodeTypes)))fail(`${name}: ${type}.${value.attribute} must be a scalar reference to the object types`);
        }
        if (check.payload !== undefined) {
          keys(check.payload,['attribute','relations'],`${name}.objectifications.payload`);
          const {attribute} = check.payload, relations = names(check.payload.relations,name);
          identifier(attribute,`${name}.objectifications.payload.attribute`);
          knownEdges(relations,name);
          if (relations.includes('*')) fail(`${name}: object payload requires explicit relationship types`);
          for (const type of value.relations) {
            if (relationTypes[type].attributes[attribute]?.type !== 'reference') fail(`${name}: ${type}.${attribute} must be a reference attribute`);
          }
          value.payload = {attribute,relations};
        }
        if (check.stateEventRelations !== undefined) {
          const events = names(check.stateEventRelations,name);
          knownEdges(events,name);
          if (events.includes('*') || value.relations.some(type => !relationTypes[type].stateTrigger)) fail(`${name}: stateEventRelations requires explicit trigger and state transition types`);
          for (const type of events) if (value.nodes.some(node => !matches(node,relationTypes[type].to,nodeTypes)))
            fail(`${name}: ${type} must target the transition object`);
          value.stateEventRelations = events;
        }
        if(check.endpoints!==undefined) {
          keys(check.endpoints,['source','target'],`${name}.objectifications.endpoints`);
          value.endpoints={...check.endpoints};
          for(const end of ['source','target']) {
            identifier(value.endpoints[end],`${name}.objectifications.endpoints.${end}`);
            for(const type of value.nodes) {
              const attr=nodeTypes[type].attributes[value.endpoints[end]];
              if(attr?.type!=='reference'||attr.many)fail(`${name}: ${type}.${value.endpoints[end]} must be a scalar endpoint reference`);
            }
          }
          if(value.endpoints.source===value.endpoints.target)fail(`${name}: objectification source and target attributes must differ`);
        }
        if(value.allowLegacy&&!value.endpoints)fail(`${name}: legacy objectifications require endpoint attributes`);
        return value;
      });
    }
    if (raw.connections !== undefined) {
      if (!Array.isArray(raw.connections) || raw.connections.length > 128) fail(`${name}: invalid connections`);
      result.connections = raw.connections.map(check => {
        keys(check, ['nodes', 'nodesExclude', 'relations', 'counterparts', 'referenceAttributes', 'referencedByAttributes', 'through', 'direction', 'min', 'max', 'visibility', 'distinctCounterparts'], `${name}.connections`);
        const value = { nodes: names(check.nodes, name), relations: names(check.relations, name), direction: check.direction ?? 'either',
          ...cardinality({ min: check.min ?? (check.visibility?0:1), max: check.max }, `${name}.connections`) };
        if(check.visibility!==undefined){if(!['may','shall'].includes(check.visibility)||value.min!==0||value.max!==null||check.through||check.referencedByAttributes)fail(`${name}: visibility requires may/shall, min 0, no max/through/referencedByAttributes`);value.visibility=check.visibility;}
        if (!['incoming', 'outgoing', 'either'].includes(value.direction)) fail(`${name}: invalid connection direction`);
        if (check.distinctCounterparts !== undefined) {
          if (typeof check.distinctCounterparts!=='boolean' || check.referencedByAttributes || check.visibility) fail(`${name}: distinctCounterparts requires ordinary endpoint checks`);
          value.distinctCounterparts=check.distinctCounterparts;
        }
        if (check.counterparts !== undefined) { value.counterparts = names(check.counterparts, name); knownNodes(value.counterparts, name); }
        if (check.nodesExclude !== undefined) { value.nodesExclude = names(check.nodesExclude, `${name}.nodesExclude`, [], true); knownNodes(value.nodesExclude, name); }
        if (check.referencedByAttributes !== undefined) {
          value.referencedByAttributes = names(check.referencedByAttributes, `${name}.referencedByAttributes`);
          if (value.relations.includes('*') || value.referencedByAttributes.includes('*') || value.direction !== 'either' || check.counterparts || check.referenceAttributes || check.through)
            fail(`${name}: referencedByAttributes requires explicit relations/attributes, direction either, and no counterparts/referenceAttributes/through`);
          for (const type of value.relations) {
            knownEdges([type], name);
            for (const attr of value.referencedByAttributes) if (relationTypes[type].attributes[attr]?.type !== 'reference') fail(`${name}: ${type}.${attr} must be a reference attribute`);
          }
        }
        if (check.through !== undefined) {
          const normalizeStep = step => {
            keys(step, ['relations', 'direction'], `${name}.through`);
            const relations = names(step.relations, `${name}.through.relations`), direction = step.direction ?? 'incoming';
            knownEdges(relations, name);
            if (relations.includes('*') || !['incoming','outgoing'].includes(direction)) fail(`${name}: through requires explicit relationship types and incoming or outgoing direction`);
            return {relations, direction};
          };
          if (Array.isArray(check.through) && !check.through.length) fail(`${name}: through requires at least one relationship step`);
          value.through = Array.isArray(check.through) ? check.through.map(normalizeStep) : normalizeStep(check.through);
        }
        if (check.referenceAttributes !== undefined) {
          value.referenceAttributes = names(check.referenceAttributes, `${name}.referenceAttributes`);
          if (value.nodes.includes('*') || value.referenceAttributes.includes('*')) fail(`${name}: referenceAttributes require explicit node and attribute names`);
          for (const type of value.nodes) {
            knownNodes([type], name);
            for (const attr of value.referenceAttributes) if (nodeTypes[type].attributes[attr]?.type !== 'reference') fail(`${name}: ${type}.${attr} must be a reference attribute`);
          }
        }
        knownNodes(value.nodes, name); knownEdges(value.relations, name); return value;
      });
    }
    if (raw.references !== undefined) {
      if (!Array.isArray(raw.references) || raw.references.length > 128) fail(`${name}: invalid references`);
      result.references = raw.references.map(check => {
        keys(check, ['nodes', 'relations', 'attributes'], `${name}.references`);
        if ((check.nodes === undefined) === (check.relations === undefined)) fail(`${name}: reference checks require nodes or relations`);
        const key = check.nodes === undefined ? 'relations' : 'nodes';
        const value = { [key]: names(check[key], name), attributes: names(check.attributes, name) };
        (key === 'nodes' ? knownNodes : knownEdges)(value[key], name);
        if (value[key].includes('*') || value.attributes.includes('*')) fail(`${name}: reference checks require explicit names`);
        for (const type of value[key]) for (const attr of value.attributes) if ((key === 'nodes' ? nodeTypes : relationTypes)[type].attributes[attr]?.type !== 'reference') fail(`${name}: ${type}.${attr} is not a reference attribute`);
        return value;
      });
    }
    viewpoints[name] = result;
  }
  const defaultRelation = own(definition, 'defaultRelation') ? definition.defaultRelation : base ? base.defaultRelation : (own(relationTypes, 'flow') ? 'flow' : null);
  if (defaultRelation !== null && (!own(relationTypes, defaultRelation) || relationTypes[defaultRelation].abstract)) fail(`Invalid default relationship type: ${defaultRelation}`);
  // Archived NAF revisions predate the profile-owned drawing configuration.
  const legacyGrid = id==='naf41-uaf' && /^4\.1\.0-arch\.(?:3[3-9]|4[01])$/.test(definition.version) ? naf41LegacyGrid : undefined;
  const grid = definition.viewpointGrid === undefined ? base?.viewpointGrid ?? legacyGrid : definition.viewpointGrid;
  const diagrams = Object.fromEntries(Object.entries(merged('diagrams')).map(([name,rule]) => {
    const label = `Profile.diagrams.${name}`;
    identifier(name,label);
    if (DIAGRAMS.includes(name)) fail(`${label}: reserved diagram name`);
    keys(rule,['renderer','layout'],label);
    if (rule.renderer!=='viewpointGrid') fail(`${label}: renderer must be viewpointGrid`);
    return [name, rule.layout===undefined ? {renderer:rule.renderer} :
      {renderer:rule.renderer,layout:gridLayout(rule.layout,viewpoints,styleGroups,`${label}.layout`)}];
  }));
  const compiled = freeze({ ...documentation(definition, 'Profile'), id, title: definition.title ?? base?.title ?? id, version: definition.version ?? base?.version ?? '1',
    ...(Object.values(aliases).some(table => Object.keys(table).length) ? { aliases: copy(aliases) } : {}),
    ...((definition.mappings ?? base?.mappings) ? { mappings: mappingDefinitions(definition.mappings ?? base.mappings) } : {}),
    ...(grid!==undefined ? {viewpointGrid:gridLayout(grid,viewpoints,styleGroups,'Profile.viewpointGrid')} : {}),
    ...(Object.keys(diagrams).length ? {diagrams} : {}),
    nodeTypes, relationTypes, viewpoints, styleGroups: copy(styleGroups), defaultRelation, requireViewpoint: definition.requireViewpoint ?? base?.requireViewpoint ?? false });
  compiledProfiles.add(compiled);
  typeAncestry.set(compiled.nodeTypes, new Map());
  typeAncestry.set(compiled.relationTypes, new Map());
  return compiled;
}

export function registerProfile(name, definition) {
  identifier(name, 'Profile name');
  if (definition?.id !== undefined && definition.id !== name) fail('Profile name and profile ID must match');
  const profile = compileProfile(definition, name);
  const key = `${name}@${profile.version}`, previous = revisions.get(key);
  if (previous && (definition.version !== undefined || lockedRevisions.has(key)) && JSON.stringify(stable(previous)) !== JSON.stringify(stable(profile))) fail(`Profile revision already registered with different contents: ${key}`);
  // Unversioned registrations retain the existing replace-by-ID API behavior.
  revisions.set(key, profile);
  if (definition.version !== undefined) lockedRevisions.add(key);
  registry.set(name, profile);
  return copy(profile);
}
export function getProfiles() { return [...registry.keys()]; }
export const isCurrentProfile = profile => registry.get(profile.id) === profile;
export const isRegisteredProfileRevision = profile => revisions.get(`${profile.id}@${profile.version}`) === profile;
export function registeredProfile(name) {
  const profile = registered(name);
  if (!profile) fail(`Unknown profile: ${name}`);
  return profile;
}
export function getProfile(name) {
  return copy(registeredProfile(name));
}

export function resolveProfile(model, options = {}) {
  let selection = options.profile;
  if (selection === undefined && model.profile) return compileProfile(model.profile);
  if (selection === undefined) selection = model.config?.profile;
  if (selection !== undefined) {
    if (typeof selection === 'string') {
      if (!registered(selection)) throw new ArchError(`Unknown profile: ${selection}`, model.config?.loc, 'ARCH_PROFILE');
      return registered(selection);
    }
    return compileProfile(selection, 'parameter');
  }
  if (model.config?.definition) {
    try { return compileProfile(model.config.definition, 'inline'); }
    catch (error) { throw new ArchError(error.message, model.config.loc, 'ARCH_PROFILE'); }
  }
  return registry.get('default');
}

function ancestors(type, definitions) {
  const visited = new Set(), pending = [type];
  while (pending.length) {
    const next = canonicalType(pending.pop(), definitions);
    if (!next || visited.has(next)) continue;
    visited.add(next);
    pending.push(...bases(definitions[next]));
  }
  return visited;
}

// Iterate this read-only set to classify an edge under all its canonical
// supertypes. Only the compiler's deeply frozen definitions are cache keys.
export function lineageOf(type, definitions) {
  type = canonicalType(type, definitions);
  const cache = typeAncestry.get(definitions);
  let lineage = cache?.get(type);
  if (!lineage) {
    lineage = ancestors(type, definitions);
    // Do not retain arbitrary unknown type names submitted by callers.
    if (Object.hasOwn(definitions, type)) cache?.set(type, lineage);
  }
  return lineage;
}

export function matches(type, allowed, definitions) {
  if (!allowed.length) return false;
  if (allowed.includes('*')) return true;
  if (!type) return false;
  const lineage = lineageOf(type, definitions);
  for (const name of allowed) if (lineage.has(canonicalType(name, definitions))) return true;
  return false;
}

// Inheritance and abstract flags are part of every compiled profile. This is
// independent of framework names and includes indirect/multiple inheritance.
export function concreteSubtypes(type, definitions) {
  return Object.keys(definitions).filter(name => canonicalType(name, definitions) !== canonicalType(type, definitions) && !definitions[name].abstract && matches(name, [type], definitions)).sort();
}

export function matchesPair(source, target, pair, definitions) {
  return matches(source, pair.from, definitions) && matches(target, pair.to, definitions) &&
    !matches(source, pair.fromExclude ?? [], definitions) && !matches(target, pair.toExclude ?? [], definitions);
}

// Type compatibility only: self-links, attributes, cardinalities, cycles and
// view-local rules still need a concrete model. Counterparts are instantiable.
export function typeConnections(type, profile) {
  if (!own(profile.nodeTypes, type)) fail(`Unknown node type in profile ${profile.id}: ${type}`);
  const concrete = Object.keys(profile.nodeTypes).filter(name => !profile.nodeTypes[name].abstract).sort();
  const outgoing = [], incoming = [];
  for (const name of Object.keys(profile.relationTypes).sort()) {
    const rule = profile.relationTypes[name];
    if (rule.abstract) continue;
    const acceptsPair = (source, target) => !rule.pairs || rule.pairs.some(pair => matchesPair(source, target, pair, profile.nodeTypes));
    // The requested type is constant for this entire list, so test its side
    // once before enumerating the possible counterpart types.
    const targets = matches(type, rule.from, profile.nodeTypes)
      ? concrete.filter(other => matches(other, rule.to, profile.nodeTypes) && acceptsPair(type, other)) : [];
    const sources = matches(type, rule.to, profile.nodeTypes)
      ? concrete.filter(other => matches(other, rule.from, profile.nodeTypes) && acceptsPair(other, type)) : [];
    const summary = { type: name, allowSelf: rule.allowSelf, acyclic: !!rule.acyclic, directions: rule.directions ?? ['forward'] };
    if (targets.length) outgoing.push({ ...summary, counterparts: targets });
    if (sources.length) incoming.push({ ...summary, counterparts: sources });
  }
  return { type, abstract: profile.nodeTypes[type].abstract, outgoing, incoming };
}

registerProfile('default', {
  title: 'arch.js standard', version: '1',
  nodeTypes: Object.fromEntries(TEMPLATES.map(template => [template, { template }])),
  relationTypes: Object.fromEntries(EDGE_STYLES.map(style => [style, { style, directions:['composition','generalization','realization'].includes(style)?['forward']:['forward','both'] }])),
  defaultRelation: 'flow',
});
