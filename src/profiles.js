import { ArchError } from './errors.js';
import { normalizeColor } from './colors.js';

// These are drawing primitives, not framework/metamodel types.
export const TEMPLATES = Object.freeze(['person', 'system', 'application', 'service', 'component', 'database',
  'queue', 'interface', 'capability', 'process', 'artifact', 'node', 'package']);
export const EDGE_STYLES = Object.freeze(['flow', 'dependency', 'association', 'access', 'composition', 'realization', 'generalization']);
export const NODE_PROPERTIES = Object.freeze(['description', 'technology', 'icon', 'stereotype', 'tags']);
export const EDGE_PROPERTIES = Object.freeze(['description', 'technology', 'tags', 'direction']);
const registry = new Map();
const revisions = new Map();
const lockedRevisions = new Set();
const compiledProfiles = new WeakSet();
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
const canonicalEntries = definitions => Object.entries(definitions).filter(([, rule]) => !rule.aliasOf);
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

export function compileProfile(definition, fallbackId) {
  if (compiledProfiles.has(definition)) return definition;
  keys(definition, ['id', ...documentationKeys, 'version', 'extends', 'aliases', 'mappings', 'nodeTypes', 'relationTypes', 'viewpoints', 'styleGroups', 'defaultRelation', 'requireViewpoint'], 'Profile');
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
    keys(raw, ['extends', 'from', 'to', 'directions', 'style', 'abstract', 'allowSelf', 'attributes', 'outgoing', 'incoming', 'pairs', 'acyclic', 'referenceLabels', 'referenceDisplay', 'referenceOccurrences', ...documentationKeys], `relation type ${name}`);
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
    keys(raw, ['nodes', 'relations', 'requiredNodes', 'requiredRelations', 'connections', 'references', ...documentationKeys], `Viewpoint ${name}`);
    const result = { ...documentation(raw, name), nodes: names(raw.nodes, `${name}.nodes`, ['*'], true), relations: names(raw.relations, `${name}.relations`, ['*'], true),
      requiredNodes: raw.requiredNodes === undefined ? [] : names(raw.requiredNodes, `${name}.requiredNodes`, [], true),
      requiredRelations: raw.requiredRelations === undefined ? [] : names(raw.requiredRelations, `${name}.requiredRelations`, [], true) };
    knownNodes(result.nodes, name); knownNodes(result.requiredNodes, name); knownEdges(result.relations, name); knownEdges(result.requiredRelations, name);
    if (result.requiredNodes.includes('*') || result.requiredRelations.includes('*')) fail(`${name}: Required type lists cannot contain a wildcard`);
    if (raw.connections !== undefined) {
      if (!Array.isArray(raw.connections) || raw.connections.length > 128) fail(`${name}: invalid connections`);
      result.connections = raw.connections.map(check => {
        keys(check, ['nodes', 'nodesExclude', 'relations', 'counterparts', 'direction', 'min', 'max'], `${name}.connections`);
        const value = { nodes: names(check.nodes, name), relations: names(check.relations, name), direction: check.direction ?? 'either',
          ...cardinality({ min: check.min ?? 1, max: check.max }, `${name}.connections`) };
        if (!['incoming', 'outgoing', 'either'].includes(value.direction)) fail(`${name}: invalid connection direction`);
        if (check.counterparts !== undefined) { value.counterparts = names(check.counterparts, name); knownNodes(value.counterparts, name); }
        if (check.nodesExclude !== undefined) { value.nodesExclude = names(check.nodesExclude, `${name}.nodesExclude`, [], true); knownNodes(value.nodesExclude, name); }
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
  const compiled = freeze({ ...documentation(definition, 'Profile'), id, title: definition.title ?? base?.title ?? id, version: definition.version ?? base?.version ?? '1',
    ...(Object.values(aliases).some(table => Object.keys(table).length) ? { aliases: copy(aliases) } : {}),
    ...((definition.mappings ?? base?.mappings) ? { mappings: mappingDefinitions(definition.mappings ?? base.mappings) } : {}),
    nodeTypes, relationTypes, viewpoints, styleGroups: copy(styleGroups), defaultRelation, requireViewpoint: definition.requireViewpoint ?? base?.requireViewpoint ?? false });
  compiledProfiles.add(compiled);
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
export function getProfile(name) {
  const profile = registered(name);
  if (!profile) fail(`Unknown profile: ${name}`);
  return copy(profile);
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

export function matches(type, allowed, definitions) {
  if (allowed.includes('*')) return true;
  const accepted = new Set(allowed.map(name => canonicalType(name, definitions)));
  const visited = new Set(), pending = [canonicalType(type, definitions)];
  while (pending.length) {
    const next = canonicalType(pending.pop(), definitions);
    if (!next || visited.has(next)) continue;
    if (accepted.has(next)) return true;
    visited.add(next); pending.push(...bases(definitions[next]));
  }
  return false;
}

// Inheritance and abstract flags are part of every compiled profile. This is
// independent of framework names and includes indirect/multiple inheritance.
export function concreteSubtypes(type, definitions) {
  return Object.keys(definitions).filter(name => canonicalType(name, definitions) !== canonicalType(type, definitions) && !definitions[name].abstract && matches(name, [type], definitions)).sort();
}

function matchesPair(source, target, pair, definitions) {
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
    const accepts = (source, target) => matches(source, rule.from, profile.nodeTypes) && matches(target, rule.to, profile.nodeTypes) &&
      (!rule.pairs || rule.pairs.some(pair => matchesPair(source, target, pair, profile.nodeTypes)));
    const targets = concrete.filter(other => accepts(type, other)), sources = concrete.filter(other => accepts(other, type));
    const summary = { type: name, allowSelf: rule.allowSelf, acyclic: !!rule.acyclic, directions: rule.directions ?? ['forward'] };
    if (targets.length) outgoing.push({ ...summary, counterparts: targets });
    if (sources.length) incoming.push({ ...summary, counterparts: sources });
  }
  return { type, abstract: profile.nodeTypes[type].abstract, outgoing, incoming };
}

export function visibleNodeIds(model, view, respectDisplay = true) {
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  const children = new Map();
  for (const node of model.nodes) {
    if (!children.has(node.parent)) children.set(node.parent, []);
    children.get(node.parent).push(node.id);
  }
  const descendants = roots => {
    const ids = new Set(roots), pending = [...ids];
    while (pending.length) for (const child of children.get(pending.pop()) ?? [])
      if (!ids.has(child)) { ids.add(child); pending.push(child); }
    return ids;
  };
  const visible = view.include ? descendants(view.include) : new Set(nodes.keys());
  // Exclusions always win, including when a descendant was explicitly included.
  const hidden=respectDisplay?Object.keys(view.styles??{}).filter(id=>nodes.has(id)&&view.styles[id].display==='none'):[];
  for (const id of descendants([...(view.exclude ?? []),...hidden])) visible.delete(id);
  // Add only the ancestors needed by surviving selections, avoiding empty ghosts.
  if (view.include) for (const id of [...visible]) {
    const seen = new Set(); let parent = nodes.get(id)?.parent;
    while (parent && !seen.has(parent)) { seen.add(parent); visible.add(parent); parent = nodes.get(parent)?.parent; }
  }
  return visible;
}

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

export function profileDiagnostics(model, profile) {
  const result = [], nodes = new Map(model.nodes.map(node => [node.id, node]));
  const add = (message, item, extra = {}) => result.push({ severity: 'error', code: profile.id === 'default' ? 'ARCH_VALIDATION' : 'ARCH_SEMANTIC', message,
    line: item?.loc?.line ?? null, column: item?.loc?.column ?? null, ...(item?.loc?.path !== undefined ? {path: item.loc.path} : {}), ...extra });
  const abstractType = (type, kind, definitions, item) => {
    const candidates = concreteSubtypes(type, definitions), topic = kind === 'node' ? 'types' : 'relations';
    const help = `@help ${topic} ${registry.get(profile.id) === profile ? profile.id : '.'} ${type}`;
    const detail = candidates.length ? `Concrete subtypes: ${candidates.slice(0, 12).join(', ')}${candidates.length > 12 ? ` (+${candidates.length - 12} more)` : ''}.`
      : `No concrete subtypes are defined in profile ${profile.id}.`;
    add(`Abstract ${kind} type cannot be instantiated: ${type}. ${detail} See ${help}`, item, { elementId: item.id, candidates, help });
  };
  const checkAttributes = (item, rule, builtins) => {
    const values = { ...Object.fromEntries(builtins.filter(key => own(item, key)).map(key => [key, item[key]])), ...item.attributes };
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
    for (const [name, schema] of Object.entries(rule.attributes)) if (schema.required && !own(values, name)) add(`${item.id}: Missing required attribute ${name}`, item, { elementId: item.id, attribute: name, incomplete:true });
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
    for (const [endpoint, types] of [['source', rule.from], ['target', rule.to]]) {
      const node = nodes.get(edge[endpoint]);
      if (node && !matches(node.type, types, profile.nodeTypes)) add(`${edge.id}: ${endpoint} of type ${node.type} is not allowed for ${type}`, edge, { elementId: edge.id });
    }
    if (rule.pairs && !rule.pairs.some(pair => {
      const source = nodes.get(edge.source), target = nodes.get(edge.target);
      return source && target && matchesPair(source.type, target.type, pair, profile.nodeTypes);
    })) add(`${edge.id}: Type combination ${nodes.get(edge.source)?.type} → ${nodes.get(edge.target)?.type} is not allowed for ${type}`, edge, { elementId: edge.id });
    checkAttributes({ ...edge, type }, rule, EDGE_PROPERTIES);
  }
  const counts = new Map();
  for (const edge of model.edges) {
    const pending = [edge.type ?? profile.defaultRelation];
    const visited = new Set();
    while (pending.length) {
      const type = canonicalType(pending.pop(), profile.relationTypes);
      if (!type || visited.has(type)) continue;
      visited.add(type);
      if (!counts.has(type)) counts.set(type, { source: new Map(), target: new Map() });
      for (const endpoint of ['source', 'target']) {
        const map = counts.get(type)[endpoint];
        for(const id of new Set(edge.direction==='both'?[edge.source,edge.target]:[edge[endpoint]]))map.set(id,(map.get(id)??0)+1);
      }
      pending.push(...bases(profile.relationTypes[type]));
    }
  }
  for (const [type, rule] of canonicalEntries(profile.relationTypes)) if (rule.acyclic) {
    const adjacency = new Map(), state = new Map();
    for (const edge of model.edges) if (matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes)) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source).push(edge);
      if(edge.direction==='both') {
        if(!adjacency.has(edge.target))adjacency.set(edge.target,[]);
        adjacency.get(edge.target).push({...edge,source:edge.target,target:edge.source});
      }
    }
    let cycle;
    const visit = id => {
      state.set(id, 1);
      for (const edge of adjacency.get(id) ?? []) {
        if (state.get(edge.target) === 1) { cycle = edge; return; }
        if (!state.has(edge.target)) visit(edge.target);
        if (cycle) return;
      }
      state.set(id, 2);
    };
    for (const id of adjacency.keys()) { if (!state.has(id)) visit(id); if (cycle) break; }
    if (cycle) add(`${type}: Cycles are not allowed`, cycle, { elementId: cycle.id });
  }
  for (const [name, rule] of canonicalEntries(profile.relationTypes)) for (const key of ['outgoing', 'incoming']) if (rule[key]) {
    const endpoint = key === 'outgoing' ? 'source' : 'target', applicable = key === 'outgoing' ? rule.from : rule.to;
    for (const node of model.nodes) if (matches(node.type, applicable, profile.nodeTypes) || counts.get(name)?.[endpoint].has(node.id)) {
      const count = counts.get(name)?.[endpoint].get(node.id) ?? 0;
      if (count < rule[key].min || (rule[key].max !== null && count > rule[key].max)) add(`${node.id}: ${name}.${key} expected ${rule[key].min}–${rule[key].max ?? '∞'} relationships, found ${count}`, node, { elementId: node.id, ...(count<rule[key].min?{incomplete:true}:{}) });
    }
  }
  for (const view of model.views) {
    if(view.meta!==undefined)continue; // Source views do not project domain elements into a viewpoint.
    if (!view.viewpoint) { if (profile.requireViewpoint) add(`View ${view.id} requires a viewpoint`, view, { viewId: view.id,incomplete:true }); continue; }
    const rule = profile.viewpoints[view.viewpoint];
    if (!rule) { add(`Unknown viewpoint: ${view.viewpoint}`, view, { viewId: view.id }); continue; }
    const visible = visibleNodeIds(model, view, false), selectedNodes = model.nodes.filter(node => visible.has(node.id));
    const selectedEdges = model.edges.filter(edge => visible.has(edge.source) && visible.has(edge.target));
    for (const node of selectedNodes) if (!matches(node.type, rule.nodes, profile.nodeTypes)) add(`${view.id}: node type ${node.type} is not allowed in viewpoint ${view.viewpoint}`, node, { elementId: node.id, viewId: view.id });
    for (const edge of selectedEdges) if (!matches(edge.type ?? profile.defaultRelation, rule.relations, profile.relationTypes)) add(`${view.id}: Relationship type ${edge.type ?? profile.defaultRelation} is not allowed`, edge, { elementId: edge.id, viewId: view.id });
    for (const type of rule.requiredNodes) if (!selectedNodes.some(node => matches(node.type, [type], profile.nodeTypes))) add(`${view.id}: Missing required node type ${type}`, view, { viewId: view.id,incomplete:true });
    for (const type of rule.requiredRelations) if (!selectedEdges.some(edge => matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes))) add(`${view.id}: Missing required relationship type ${type}`, view, { viewId: view.id,incomplete:true });
    for (const check of rule.connections ?? []) for (const node of selectedNodes) if (matches(node.type, check.nodes, profile.nodeTypes)&&!matches(node.type,check.nodesExclude??[],profile.nodeTypes)) {
      const count = selectedEdges.filter(edge => matches(edge.type ?? profile.defaultRelation, check.relations, profile.relationTypes) &&
        (((check.direction !== 'incoming'||edge.direction==='both') && edge.source === node.id && (!check.counterparts || matches(nodes.get(edge.target)?.type, check.counterparts, profile.nodeTypes))) ||
         ((check.direction !== 'outgoing'||edge.direction==='both') && edge.target === node.id && (!check.counterparts || matches(nodes.get(edge.source)?.type, check.counterparts, profile.nodeTypes))))).length;
      if (count < check.min || check.max !== null && count > check.max) add(`${view.id}: ${node.id} requires ${check.min}–${check.max ?? '∞'} ${check.direction} connections (${check.relations.join(', ')}${check.counterparts ? `; counterpart: ${check.counterparts.join(', ')}` : ''}); found ${count}`, node, { elementId: node.id, viewId: view.id,...(count<check.min?{incomplete:true}:{}) });
    }
    for (const check of rule.references ?? []) for (const item of check.nodes ? selectedNodes : selectedEdges) if (matches(item.type, check.nodes ?? check.relations, check.nodes ? profile.nodeTypes : profile.relationTypes)) {
      for (const attr of check.attributes) for (const id of [item.attributes?.[attr]].flat().filter(v => typeof v === 'string')) if (!visible.has(id))
        add(`${view.id}: ${item.id}.${attr} references ${id}, which must be visible in viewpoint ${view.viewpoint}`, item, { elementId: item.id, attribute: attr, viewId: view.id });
    }
  }
  return result;
}

registerProfile('default', {
  title: 'arch.js standard', version: '1',
  nodeTypes: Object.fromEntries(TEMPLATES.map(template => [template, { template }])),
  relationTypes: Object.fromEntries(EDGE_STYLES.map(style => [style, { style, directions:['composition','generalization','realization'].includes(style)?['forward']:['forward','both'] }])),
  defaultRelation: 'flow',
});
