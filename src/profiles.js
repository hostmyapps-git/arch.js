import { ArchError } from './errors.js';

// These are drawing primitives, not framework/metamodel types.
export const TEMPLATES = Object.freeze(['person', 'system', 'application', 'service', 'component', 'database',
  'queue', 'interface', 'capability', 'process', 'artifact', 'node', 'package']);
export const EDGE_STYLES = Object.freeze(['flow', 'dependency', 'association', 'access', 'composition', 'realization', 'generalization']);
export const NODE_PROPERTIES = Object.freeze(['description', 'technology', 'icon', 'stereotype', 'tags']);
export const EDGE_PROPERTIES = Object.freeze(['description', 'technology', 'tags']);
const registry = new Map();
const compiledProfiles = new WeakSet();
const idPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const reservedTypes = new Set(['relation', 'model', 'view', 'config', 'architecture']);
const reservedAttributes = new Set(['id', 'type', 'title', 'parent', 'loc', 'attributes', 'attributeLocs', 'relation']);
const fail = message => { throw new ArchError(message, {}, 'ARCH_PROFILE'); };
const own = (object, key) => Object.hasOwn(object, key);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const copy = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function keys(value, allowed, label) {
  if (!record(value)) fail(`${label} muss ein Objekt sein`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unbekannte Einstellung ${key}`);
}
function identifier(value, label) {
  if (typeof value !== 'string' || !idPattern.test(value)) fail(`${label}: ungültiger Bezeichner ${value}`);
}
function names(value, label, fallback = ['*'], allowEmpty = false) {
  const array = value === undefined ? fallback : typeof value === 'string' ? [value] : value;
  if (!Array.isArray(array) || !allowEmpty && !array.length || array.length > 512) fail(`${label}: ungültige Namensliste`);
  for (const item of array) if (item !== '*') identifier(item, label);
  return [...new Set(array)];
}
function cardinality(value, label) {
  if (value === undefined) return undefined;
  keys(value, ['min', 'max'], label);
  const result = { min: value.min ?? 0, max: value.max ?? null };
  if (!Number.isInteger(result.min) || result.min < 0 || result.min > 4000 ||
      (result.max !== null && (!Number.isInteger(result.max) || result.max < result.min || result.max > 4000))) fail(`${label}: ungültige Kardinalität`);
  return result;
}
function attributes(value = {}, label) {
  if (!record(value) || Object.keys(value).length > 128) fail(`${label}: ungültige Attributdefinitionen`);
  const result = Object.create(null);
  for (const [name, rule] of Object.entries(value)) {
    identifier(name, label);
    if (reservedAttributes.has(name)) fail(`${label}: reserviertes Attribut ${name}`);
    keys(rule, ['type', 'required', 'enum', 'min', 'max', 'minLength', 'maxLength', 'many', 'minItems', 'maxItems', 'uniqueItems', 'targets', 'format'], `${label}.${name}`);
    const type = rule.type ?? 'string';
    if (!['string', 'number', 'integer', 'boolean', 'reference'].includes(type)) fail(`${label}.${name}: unbekannter Datentyp ${type}`);
    if (rule.required !== undefined && typeof rule.required !== 'boolean') fail(`${label}.${name}: required muss boolean sein`);
    const normalized = { type, required: rule.required ?? false };
    if (rule.many !== undefined && typeof rule.many !== 'boolean') fail(`${label}.${name}: many muss boolean sein`);
    if (rule.many) normalized.many = true;
    if (rule.uniqueItems !== undefined) {
      if (!rule.many || typeof rule.uniqueItems !== 'boolean') fail(`${label}.${name}: uniqueItems benötigt many`);
      normalized.uniqueItems = rule.uniqueItems;
    }
    for (const bound of ['minItems', 'maxItems']) if (rule[bound] !== undefined) {
      if (!rule.many || !Number.isInteger(rule[bound]) || rule[bound] < 0 || rule[bound] > 4000) fail(`${label}.${name}: ungültige Grenze ${bound}`);
      normalized[bound] = rule[bound];
    }
    if ((normalized.minItems ?? 0) > (normalized.maxItems ?? 4000)) fail(`${label}.${name}: widersprüchliche Listengrenzen`);
    if (type === 'reference') normalized.targets = names(rule.targets, `${label}.${name}.targets`);
    else if (rule.targets !== undefined) fail(`${label}.${name}: targets benötigt type reference`);
    if (rule.format !== undefined) {
      if (type !== 'string' || !['date', 'date-time', 'uri'].includes(rule.format)) fail(`${label}.${name}: ungültiges format`);
      normalized.format = rule.format;
    }
    for (const bound of ['min', 'max', 'minLength', 'maxLength']) if (rule[bound] !== undefined) {
      if (!Number.isFinite(rule[bound]) || (bound.includes('Length') ? type !== 'string' || !Number.isInteger(rule[bound]) || rule[bound] < 0 : !['number', 'integer'].includes(type)))
        fail(`${label}.${name}: ungültige Grenze ${bound}`);
      normalized[bound] = rule[bound];
    }
    if ((normalized.min !== undefined && normalized.max !== undefined && normalized.min > normalized.max) ||
        (normalized.minLength !== undefined && normalized.maxLength !== undefined && normalized.minLength > normalized.maxLength)) fail(`${label}.${name}: widersprüchliche Grenzen`);
    if (rule.enum !== undefined) {
      if (!Array.isArray(rule.enum) || !rule.enum.length || rule.enum.length > 256 || rule.enum.some(v =>
        type === 'integer' ? !Number.isInteger(v) : typeof v !== (type === 'reference' ? 'string' : type) || (type === 'number' && !Number.isFinite(v)))) fail(`${label}.${name}: ungültige enum-Werte`);
      normalized.enum = [...new Set(rule.enum)];
    }
    if ([...NODE_PROPERTIES, ...EDGE_PROPERTIES].includes(name) && (type !== 'string' || rule.many)) fail(`${label}.${name}: Standardattribute müssen skalare Strings bleiben`);
    result[name] = normalized;
  }
  return result;
}

const bases = rule => typeof rule?.extends === 'string' ? [rule.extends] : rule?.extends ?? [];
function parentNames(value, label) {
  if (value === undefined) return [];
  const values = names(value, label, [], true);
  if (values.includes('*')) fail(`${label}: Wildcard als Basistyp ist nicht erlaubt`);
  return values;
}
function mergeAttributes(parents, local, label) {
  const result = Object.create(null);
  for (const parent of parents) for (const [key, value] of Object.entries(parent.attributes)) {
    if (own(result, key) && JSON.stringify(result[key]) !== JSON.stringify(value) && !own(local ?? {}, key))
      fail(`${label}.${key}: mehrdeutige geerbte Attributregel; lokale Regel erforderlich`);
    result[key] = value;
  }
  return Object.assign(result, attributes(local, label));
}
function comparisons(value = [], label) {
  if (!Array.isArray(value) || value.length > 128) fail(`${label}: ungültige comparisons`);
  return value.map(rule => {
    keys(rule, ['left', 'op', 'right'], label);
    identifier(rule.left, label); identifier(rule.right, label);
    if (!['<', '<=', '=', '!=', '>=', '>'].includes(rule.op)) fail(`${label}: unbekannter Vergleich`);
    return { left: rule.left, op: rule.op, right: rule.right };
  });
}

export function compileProfile(definition, fallbackId) {
  if (compiledProfiles.has(definition)) return definition;
  keys(definition, ['id', 'title', 'version', 'extends', 'nodeTypes', 'relationTypes', 'viewpoints', 'styleGroups', 'defaultRelation', 'requireViewpoint'], 'Profil');
  const id = definition.id ?? fallbackId;
  identifier(id, 'Profil-ID');
  if (definition.extends !== undefined && (typeof definition.extends !== 'string' || !registry.has(definition.extends))) fail(`Unbekanntes Basisprofil: ${definition.extends}`);
  const base = definition.extends ? registry.get(definition.extends) : undefined;
  for (const key of ['title', 'version']) if (definition[key] !== undefined && typeof definition[key] !== 'string') fail(`Profil.${key} muss ein String sein`);
  if (definition.requireViewpoint !== undefined && typeof definition.requireViewpoint !== 'boolean') fail('requireViewpoint muss boolean sein');
  const merged = key => {
    const values = definition[key] ?? {};
    if (!record(values)) fail(`Profil.${key} muss ein Objekt sein`);
    return Object.assign(Object.create(null), base?.[key] ?? {}, values);
  };
  const rawNodes = merged('nodeTypes'), rawEdges = merged('relationTypes'), rawViews = merged('viewpoints');
  const styleGroups = merged('styleGroups');
  if (Object.keys(styleGroups).length > 512) fail('Zu viele Stilgruppen');
  for (const [name, group] of Object.entries(styleGroups)) {
    identifier(name, 'Stilgruppe'); keys(group, ['backgroundColor'], `Stilgruppe ${name}`);
    if (group.backgroundColor !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(group.backgroundColor)) fail(`${name}: ungültige backgroundColor`);
  }
  if (!Object.keys(rawNodes).length || Object.keys(rawNodes).length > 512 || Object.keys(rawEdges).length > 512 || Object.keys(rawViews).length > 128) fail('Profil benötigt 1–512 Knotentypen; maximal 512 Relationstypen und 128 Viewpoints');
  const nodeTypes = Object.create(null), relationTypes = Object.create(null), viewpoints = Object.create(null);
  const compiling = new Set();
  const node = name => {
    if (own(nodeTypes, name)) return nodeTypes[name];
    if (!own(rawNodes, name) || compiling.has(`n:${name}`)) fail(`Unbekannter oder zyklischer Knotentyp: ${name}`);
    identifier(name, 'Knotentyp');
    if (reservedTypes.has(name)) fail(`Reservierter Knotentyp: ${name}`);
    const raw = rawNodes[name];
    keys(raw, ['extends', 'template', 'container', 'contains', 'abstract', 'attributes', 'icon', 'accent', 'backgroundColor', 'styleGroup', 'comparisons'], `Knotentyp ${name}`);
    compiling.add(`n:${name}`);
    const baseNames = parentNames(raw.extends, `Basistyp von ${name}`), parents = baseNames.map(node), parent = parents[0];
    const result = { template: raw.template ?? parent?.template ?? 'node', container: raw.container,
      abstract: raw.abstract ?? false, attributes: mergeAttributes(parents, raw.attributes, name) };
    for (const key of ['icon', 'accent']) if (raw[key] !== undefined || parent?.[key] !== undefined) result[key] = raw[key] ?? parent[key];
    for (const key of ['styleGroup', 'backgroundColor']) if (raw[key] !== undefined || parent?.[key] !== undefined) result[key] = raw[key] ?? parent[key];
    if (result.styleGroup !== undefined && !own(styleGroups, result.styleGroup)) fail(`${name}: unbekannte Stilgruppe ${result.styleGroup}`);
    if (result.backgroundColor !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(result.backgroundColor)) fail(`${name}: ungültige backgroundColor`);
    if (raw.extends !== undefined) result.extends = Array.isArray(raw.extends) ? baseNames : raw.extends;
    const checks = [...parents.flatMap(p => p.comparisons ?? []), ...comparisons(raw.comparisons, name)];
    if (checks.length) result.comparisons = [...new Map(checks.map(check => [JSON.stringify(check), check])).values()];
    for (const check of result.comparisons ?? []) {
      const a = result.attributes[check.left], b = result.attributes[check.right];
      if (!a || !b || a.many || b.many || a.type !== b.type || !['number', 'integer', 'string'].includes(a.type) || a.format !== b.format)
        fail(`${name}: Vergleich benötigt zwei kompatible skalare Attribute`);
    }
    if (!TEMPLATES.includes(result.template)) fail(`Unbekanntes Template für ${name}: ${result.template}`);
    result.container ??= result.template === 'package';
    if (typeof result.abstract !== 'boolean' || typeof result.container !== 'boolean' || result.container !== (result.template === 'package')) fail(`${name}: Container benötigen template package`);
    if (raw.contains !== undefined && !result.container) fail(`${name}: contains ist nur für Container erlaubt`);
    if (result.container) result.contains = names(raw.contains ?? parent?.contains, `${name}.contains`, ['*'], true);
    if (result.icon !== undefined && (typeof result.icon !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(result.icon))) fail(`${name}: ungültige Iconreferenz`);
    if (result.accent !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(result.accent)) fail(`${name}: ungültige Akzentfarbe`);
    nodeTypes[name] = result; compiling.delete(`n:${name}`); return result;
  };
  for (const name of Object.keys(rawNodes)) node(name);
  const knownNodes = (list, label) => { for (const name of list) if (name !== '*' && !own(nodeTypes, name)) fail(`${label}: unbekannter Knotentyp ${name}`); };
  const checkReferences = (rule, label) => { for (const [key, attr] of Object.entries(rule.attributes)) if (attr.type === 'reference') knownNodes(attr.targets, `${label}.${key}`); };
  for (const [name, rule] of Object.entries(nodeTypes)) {
    if (rule.container) knownNodes(rule.contains, `${name}.contains`);
    checkReferences(rule, name);
  }
  const relation = name => {
    if (own(relationTypes, name)) return relationTypes[name];
    if (!own(rawEdges, name) || compiling.has(`e:${name}`)) fail(`Unbekannter oder zyklischer Relationstyp: ${name}`);
    identifier(name, 'Relationstyp');
    const raw = rawEdges[name];
    keys(raw, ['extends', 'from', 'to', 'style', 'abstract', 'allowSelf', 'attributes', 'outgoing', 'incoming', 'pairs', 'acyclic'], `Relationstyp ${name}`);
    compiling.add(`e:${name}`);
    const baseNames = parentNames(raw.extends, `Basisrelation von ${name}`), parents = baseNames.map(relation), parent = parents[0];
    const result = { from: names(raw.from ?? parent?.from, `${name}.from`), to: names(raw.to ?? parent?.to, `${name}.to`),
      style: raw.style ?? parent?.style ?? 'flow', abstract: raw.abstract ?? false, allowSelf: raw.allowSelf ?? parent?.allowSelf ?? true,
      attributes: mergeAttributes(parents, raw.attributes, name) };
    if (raw.extends !== undefined) result.extends = Array.isArray(raw.extends) ? baseNames : raw.extends;
    if (raw.acyclic !== undefined && typeof raw.acyclic !== 'boolean') fail(`${name}.acyclic muss boolean sein`);
    if (raw.acyclic ?? parent?.acyclic) result.acyclic = true;
    const pairs = raw.pairs ?? parent?.pairs;
    if (pairs !== undefined) {
      if (!Array.isArray(pairs) || !pairs.length || pairs.length > 512) fail(`${name}: ungültige pairs`);
      result.pairs = pairs.map(pair => {
        keys(pair, ['from', 'to', 'fromExclude', 'toExclude'], `${name}.pairs`);
        const normalized = { from: names(pair.from, name), to: names(pair.to, name) };
        for (const key of ['fromExclude', 'toExclude']) if (pair[key] !== undefined) normalized[key] = names(pair[key], name, [], true);
        for (const [key, values] of Object.entries(normalized)) knownNodes(values, `${name}.${key}`);
        return normalized;
      });
    }
    if (!EDGE_STYLES.includes(result.style)) fail(`Unbekannter Kantenstil für ${name}: ${result.style}`);
    if (typeof result.abstract !== 'boolean' || typeof result.allowSelf !== 'boolean') fail(`${name}: abstract/allowSelf müssen boolean sein`);
    for (const key of ['outgoing', 'incoming']) {
      const value = cardinality(raw[key] ?? parent?.[key], `${name}.${key}`);
      if (value) result[key] = value;
    }
    knownNodes(result.from, `${name}.from`); knownNodes(result.to, `${name}.to`);
    checkReferences(result, name);
    relationTypes[name] = result; compiling.delete(`e:${name}`); return result;
  };
  for (const name of Object.keys(rawEdges)) relation(name);
  const knownEdges = (list, label) => { for (const name of list) if (name !== '*' && !own(relationTypes, name)) fail(`${label}: unbekannter Relationstyp ${name}`); };
  for (const [name, raw] of Object.entries(rawViews)) {
    identifier(name, 'Viewpoint');
    keys(raw, ['nodes', 'relations', 'requiredNodes', 'requiredRelations', 'connections'], `Viewpoint ${name}`);
    const result = { nodes: names(raw.nodes, `${name}.nodes`, ['*'], true), relations: names(raw.relations, `${name}.relations`, ['*'], true),
      requiredNodes: raw.requiredNodes === undefined ? [] : names(raw.requiredNodes, `${name}.requiredNodes`, [], true),
      requiredRelations: raw.requiredRelations === undefined ? [] : names(raw.requiredRelations, `${name}.requiredRelations`, [], true) };
    knownNodes(result.nodes, name); knownNodes(result.requiredNodes, name); knownEdges(result.relations, name); knownEdges(result.requiredRelations, name);
    if (result.requiredNodes.includes('*') || result.requiredRelations.includes('*')) fail(`${name}: Pflichtlisten erlauben keinen Wildcard`);
    if (raw.connections !== undefined) {
      if (!Array.isArray(raw.connections) || raw.connections.length > 128) fail(`${name}: ungültige connections`);
      result.connections = raw.connections.map(check => {
        keys(check, ['nodes', 'relations', 'direction', 'min', 'max'], `${name}.connections`);
        const value = { nodes: names(check.nodes, name), relations: names(check.relations, name), direction: check.direction ?? 'either',
          ...cardinality({ min: check.min ?? 1, max: check.max }, `${name}.connections`) };
        if (!['incoming', 'outgoing', 'either'].includes(value.direction)) fail(`${name}: ungültige Verbindungsrichtung`);
        knownNodes(value.nodes, name); knownEdges(value.relations, name); return value;
      });
    }
    viewpoints[name] = result;
  }
  const defaultRelation = own(definition, 'defaultRelation') ? definition.defaultRelation : base ? base.defaultRelation : (own(relationTypes, 'flow') ? 'flow' : null);
  if (defaultRelation !== null && (!own(relationTypes, defaultRelation) || relationTypes[defaultRelation].abstract)) fail(`Ungültige Standardrelation: ${defaultRelation}`);
  const compiled = freeze({ id, title: definition.title ?? base?.title ?? id, version: definition.version ?? base?.version ?? '1',
    nodeTypes, relationTypes, viewpoints, styleGroups: copy(styleGroups), defaultRelation, requireViewpoint: definition.requireViewpoint ?? base?.requireViewpoint ?? false });
  compiledProfiles.add(compiled);
  return compiled;
}

export function registerProfile(name, definition) {
  identifier(name, 'Profilname');
  if (definition?.id !== undefined && definition.id !== name) fail('Profilname und Profil-ID müssen übereinstimmen');
  const profile = compileProfile(definition, name);
  registry.set(name, profile);
  return copy(profile);
}
export function getProfiles() { return [...registry.keys()]; }
export function getProfile(name) {
  if (!registry.has(name)) fail(`Unbekanntes Profil: ${name}`);
  return copy(registry.get(name));
}

export function resolveProfile(model, options = {}) {
  let selection = options.profile;
  if (selection === undefined && model.profile) return compileProfile(model.profile);
  if (selection === undefined) selection = model.config?.profile;
  if (selection !== undefined) {
    if (typeof selection === 'string') {
      if (!registry.has(selection)) throw new ArchError(`Unbekanntes Profil: ${selection}`, model.config?.loc, 'ARCH_PROFILE');
      return registry.get(selection);
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
  const visited = new Set(), pending = [type];
  while (pending.length) {
    const next = pending.pop();
    if (!next || visited.has(next)) continue;
    if (allowed.includes(next)) return true;
    visited.add(next); pending.push(...bases(definitions[next]));
  }
  return false;
}

export function visibleNodeIds(model, view) {
  const nodes = new Map(model.nodes.map(node => [node.id, node])), visible = new Set(view.include ?? nodes.keys());
  if (view.include) {
    const children = new Map();
    for (const node of model.nodes) { if (!children.has(node.parent)) children.set(node.parent, []); children.get(node.parent).push(node.id); }
    const add = id => { for (const child of children.get(id) ?? []) { if (!visible.has(child)) { visible.add(child); add(child); } } };
    for (const id of view.include) add(id);
    for (const id of [...visible]) {
      const seen = new Set(); let parent = nodes.get(id)?.parent;
      while (parent && !seen.has(parent)) { seen.add(parent); visible.add(parent); parent = nodes.get(parent)?.parent; }
    }
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
    line: item?.loc?.line ?? null, column: item?.loc?.column ?? null, ...extra });
  const checkAttributes = (item, rule, builtins) => {
    const values = { ...Object.fromEntries(builtins.filter(key => own(item, key)).map(key => [key, item[key]])), ...item.attributes };
    for (const [name, value] of Object.entries(values)) {
      const schema = rule.attributes[name];
      const location = { loc: item.attributeLocs?.[name] ?? item.loc };
      const extra = { elementId: item.id, attribute: name };
      if (!schema && !builtins.includes(name)) { add(`Unbekanntes Attribut für ${item.type}: ${name}`, location, extra); continue; }
      const type = schema?.type ?? 'string', many = !!schema?.many;
      if (many !== Array.isArray(value)) { add(`${item.id}.${name}: erwartet ${many ? 'Liste' : type}`, location, extra); continue; }
      const entries = many ? value : [value];
      if (many && (entries.length < (schema.minItems ?? 0) || entries.length > (schema.maxItems ?? 4000))) add(`${item.id}.${name}: ungültige Listenlänge`, location, extra);
      if (many && schema.uniqueItems && new Set(entries).size !== entries.length) add(`${item.id}.${name}: doppelte Listeneinträge sind nicht erlaubt`, location, extra);
      for (const entry of entries) {
        if (type === 'integer' ? !Number.isInteger(entry) : typeof entry !== (type === 'reference' ? 'string' : type) || (type === 'number' && !Number.isFinite(entry))) {
          add(`${item.id}.${name}: erwartet ${type}`, location, extra); continue;
        }
        if (!schema) continue;
        if (schema.enum && !schema.enum.includes(entry)) add(`${item.id}.${name}: Wert muss aus ${schema.enum.map(v => JSON.stringify(v)).join(', ')} stammen`, location, extra);
        if ((schema.min !== undefined && entry < schema.min) || (schema.max !== undefined && entry > schema.max)) add(`${item.id}.${name}: Zahl außerhalb des erlaubten Bereichs`, location, extra);
        if ((schema.minLength !== undefined && [...entry].length < schema.minLength) || (schema.maxLength !== undefined && [...entry].length > schema.maxLength)) add(`${item.id}.${name}: ungültige Textlänge`, location, extra);
        if (schema.format && !validFormat(entry, schema.format)) add(`${item.id}.${name}: ungültiges Format ${schema.format}`, location, extra);
        if (type === 'reference') {
          const target = nodes.get(entry);
          if (!target) add(`${item.id}.${name}: unbekannte Referenz ${entry}`, location, extra);
          else if (!matches(target.type, schema.targets, profile.nodeTypes)) add(`${item.id}.${name}: Referenztyp ${target.type} ist nicht erlaubt`, location, extra);
        }
      }
    }
    for (const [name, schema] of Object.entries(rule.attributes)) if (schema.required && !own(values, name)) add(`${item.id}: Pflichtattribut ${name} fehlt`, item, { elementId: item.id, attribute: name });
    for (const check of rule.comparisons ?? []) {
      const a = rule.attributes[check.left], b = rule.attributes[check.right];
      let left = values[check.left], right = values[check.right];
      if (left === undefined || right === undefined || typeof left !== typeof right) continue;
      if (a.format && (!validFormat(left, a.format) || !validFormat(right, b.format))) continue;
      if (a.format === 'date' || a.format === 'date-time') { left = Date.parse(left); right = Date.parse(right); }
      const ok = { '<': left < right, '<=': left <= right, '=': left === right, '!=': left !== right, '>=': left >= right, '>': left > right }[check.op];
      if (!ok) add(`${item.id}: ${check.left} ${check.op} ${check.right} ist nicht erfüllt`, item, { elementId: item.id });
    }
  };
  for (const node of model.nodes) {
    const rule = profile.nodeTypes[node.type];
    if (!rule) { add(`Unbekannter Elementtyp im Profil ${profile.id}: ${node.type}`, node, { elementId: node.id }); continue; }
    if (rule.abstract) add(`Abstrakter Knotentyp darf nicht instanziiert werden: ${node.type}`, node, { elementId: node.id });
    if (node.parent) {
      const parent = nodes.get(node.parent), parentRule = profile.nodeTypes[parent?.type];
      if (parentRule && !parentRule.container) add(`${node.parent} ist kein Container`, node, { elementId: node.id });
      else if (parentRule && !matches(node.type, parentRule.contains, profile.nodeTypes)) add(`${node.type} ist in ${parent.type} nicht erlaubt`, node, { elementId: node.id });
    }
    checkAttributes(node, rule, NODE_PROPERTIES);
  }
  for (const edge of model.edges) {
    const type = edge.type ?? profile.defaultRelation, rule = profile.relationTypes[type];
    if (!rule) { add(type ? `Unbekannter Beziehungstyp im Profil ${profile.id}: ${type}` : `Beziehung ${edge.id} benötigt einen expliziten type`, edge, { elementId: edge.id }); continue; }
    if (rule.abstract) add(`Abstrakter Beziehungstyp darf nicht instanziiert werden: ${type}`, edge, { elementId: edge.id });
    if (!rule.allowSelf && edge.source === edge.target) add(`${type}: Selbstbeziehung ist nicht erlaubt`, edge, { elementId: edge.id });
    for (const [endpoint, types] of [['source', rule.from], ['target', rule.to]]) {
      const node = nodes.get(edge[endpoint]);
      if (node && !matches(node.type, types, profile.nodeTypes)) add(`${edge.id}: ${endpoint} vom Typ ${node.type} ist für ${type} nicht erlaubt`, edge, { elementId: edge.id });
    }
    if (rule.pairs && !rule.pairs.some(pair => {
      const source = nodes.get(edge.source), target = nodes.get(edge.target);
      return source && target && matches(source.type, pair.from, profile.nodeTypes) && matches(target.type, pair.to, profile.nodeTypes) &&
        !matches(source.type, pair.fromExclude ?? [], profile.nodeTypes) && !matches(target.type, pair.toExclude ?? [], profile.nodeTypes);
    })) add(`${edge.id}: Typkombination ${nodes.get(edge.source)?.type} → ${nodes.get(edge.target)?.type} ist für ${type} nicht erlaubt`, edge, { elementId: edge.id });
    checkAttributes({ ...edge, type }, rule, EDGE_PROPERTIES);
  }
  const counts = new Map();
  for (const edge of model.edges) {
    const pending = [edge.type ?? profile.defaultRelation];
    const visited = new Set();
    while (pending.length) {
      const type = pending.pop();
      if (!type || visited.has(type)) continue;
      visited.add(type);
      if (!counts.has(type)) counts.set(type, { source: new Map(), target: new Map() });
      for (const endpoint of ['source', 'target']) {
        const map = counts.get(type)[endpoint]; map.set(edge[endpoint], (map.get(edge[endpoint]) ?? 0) + 1);
      }
      pending.push(...bases(profile.relationTypes[type]));
    }
  }
  for (const [type, rule] of Object.entries(profile.relationTypes)) if (rule.acyclic) {
    const adjacency = new Map(), state = new Map();
    for (const edge of model.edges) if (matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes)) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source).push(edge);
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
    if (cycle) add(`${type}: Zyklus ist nicht erlaubt`, cycle, { elementId: cycle.id });
  }
  for (const [name, rule] of Object.entries(profile.relationTypes)) for (const key of ['outgoing', 'incoming']) if (rule[key]) {
    const endpoint = key === 'outgoing' ? 'source' : 'target', applicable = key === 'outgoing' ? rule.from : rule.to;
    for (const node of model.nodes) if (matches(node.type, applicable, profile.nodeTypes)) {
      const count = counts.get(name)?.[endpoint].get(node.id) ?? 0;
      if (count < rule[key].min || (rule[key].max !== null && count > rule[key].max)) add(`${node.id}: ${name}.${key} erwartet ${rule[key].min}–${rule[key].max ?? '∞'} Beziehungen, gefunden ${count}`, node, { elementId: node.id });
    }
  }
  for (const view of model.views) {
    if (!view.viewpoint) { if (profile.requireViewpoint) add(`Ansicht ${view.id} benötigt einen viewpoint`, view, { viewId: view.id }); continue; }
    const rule = profile.viewpoints[view.viewpoint];
    if (!rule) { add(`Unbekannter Viewpoint: ${view.viewpoint}`, view, { viewId: view.id }); continue; }
    const visible = visibleNodeIds(model, view), selectedNodes = model.nodes.filter(node => visible.has(node.id));
    const selectedEdges = model.edges.filter(edge => visible.has(edge.source) && visible.has(edge.target));
    for (const node of selectedNodes) if (!matches(node.type, rule.nodes, profile.nodeTypes)) add(`${view.id}: Knotentyp ${node.type} ist für Viewpoint ${view.viewpoint} nicht erlaubt`, node, { elementId: node.id, viewId: view.id });
    for (const edge of selectedEdges) if (!matches(edge.type ?? profile.defaultRelation, rule.relations, profile.relationTypes)) add(`${view.id}: Beziehungstyp ${edge.type ?? profile.defaultRelation} ist nicht erlaubt`, edge, { elementId: edge.id, viewId: view.id });
    for (const type of rule.requiredNodes) if (!selectedNodes.some(node => matches(node.type, [type], profile.nodeTypes))) add(`${view.id}: Pflicht-Knotentyp ${type} fehlt`, view, { viewId: view.id });
    for (const type of rule.requiredRelations) if (!selectedEdges.some(edge => matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes))) add(`${view.id}: Pflicht-Beziehungstyp ${type} fehlt`, view, { viewId: view.id });
    for (const check of rule.connections ?? []) for (const node of selectedNodes) if (matches(node.type, check.nodes, profile.nodeTypes)) {
      const count = selectedEdges.filter(edge => matches(edge.type ?? profile.defaultRelation, check.relations, profile.relationTypes) &&
        (check.direction !== 'incoming' && edge.source === node.id || check.direction !== 'outgoing' && edge.target === node.id)).length;
      if (count < check.min || check.max !== null && count > check.max) add(`${view.id}: ${node.id} benötigt ${check.min}–${check.max ?? '∞'} ${check.direction}-Verbindungen`, node, { elementId: node.id, viewId: view.id });
    }
  }
  return result;
}

registerProfile('default', {
  title: 'arch.js standard', version: '1',
  nodeTypes: Object.fromEntries(TEMPLATES.map(template => [template, { template }])),
  relationTypes: Object.fromEntries(EDGE_STYLES.map(style => [style, { style }])),
  defaultRelation: 'flow',
});
