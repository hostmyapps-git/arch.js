import { ArchError } from './errors.js';
import { validateDiagramView } from './diagrams.js';
import { TEMPLATES, EDGE_STYLES, NODE_PROPERTIES, EDGE_PROPERTIES, resolveProfile, profileDiagnostics } from './profiles.js';
export { ArchError };
export const TYPES = TEMPLATES;
export const EDGE_TYPES = EDGE_STYLES;
const dict = () => Object.create(null);
const fail = (message, loc, code = 'ARCH_VALIDATION') => { throw new ArchError(message, loc, code); };

function tokenize(source) {
  const tokens = [];
  let i = 0, line = 1, column = 1;
  const advance = (n) => {
    for (let j = 0; j < n; j++) {
      if (source[i++] === '\n') { line++; column = 1; } else column++;
    }
  };
  while (i < source.length) {
    const c = source[i], loc = { line, column };
    if (/\s/.test(c) || c === ';') { advance(1); continue; }
    if (c === '#' || source.slice(i, i + 2) === '//') {
      while (i < source.length && source[i] !== '\n') advance(1);
      continue;
    }
    if (source.slice(i, i + 2) === '->') {
      tokens.push({ type: '->', value: '->', ...loc }); advance(2); continue;
    }
    if ('{}(),[]'.includes(c)) { tokens.push({ type: c, value: c, ...loc }); advance(1); continue; }
    if (c === '"') {
      let end = i + 1;
      while (end < source.length) {
        if (source[end] === '\\') { end += 2; continue; }
        if (source[end] === '"') break;
        end++;
      }
      if (end >= source.length) fail('Nicht abgeschlossener String', loc, 'ARCH_SYNTAX');
      const raw = source.slice(i, end + 1);
      let value;
      try { value = JSON.parse(raw); } catch { fail('Ungültiger String oder Escape', loc, 'ARCH_SYNTAX'); }
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value) ||
          [...value].some(char => { const code = char.codePointAt(0); return code >= 0xd800 && code <= 0xdfff; }))
        fail('String enthält ein in SVG ungültiges Unicode-Zeichen', loc, 'ARCH_SYNTAX');
      tokens.push({ type: 'string', value, ...loc }); advance(raw.length); continue;
    }
    const number = source.slice(i).match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) fail('Zahl muss endlich sein', loc);
      tokens.push({ type: 'number', value, ...loc }); advance(number[0].length); continue;
    }
    const word = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_.-]*/);
    if (word) {
      // Keep the arrow available even without spaces: a->b.
      const value = word[0].replace(/-$/, (match) => source[i + word[0].length] === '>' ? '' : match);
      tokens.push({ type: 'word', value, ...loc }); advance(value.length); continue;
    }
    fail(`Unerwartetes Zeichen ${JSON.stringify(c)}`, loc, 'ARCH_SYNTAX');
  }
  tokens.push({ type: 'eof', value: '', line, column });
  return tokens;
}

export function parseDocument(source) {
  if (typeof source !== 'string') fail('Quelltext muss ein String sein');
  if (source.length > 2_000_000) fail('Quelltext ist größer als 2 MB');
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const is = (value) => peek().value === value;
  const take = () => tokens[cursor++];
  const expect = (value) => {
    if (!is(value)) fail(`Erwartet: ${value}; gefunden: ${peek().value || 'Dateiende'}`, peek(), 'ARCH_SYNTAX');
    return take();
  };
  const typed = (type, label = type) => {
    if (peek().type !== type) fail(`Erwartet: ${label}; gefunden: ${peek().value || 'Dateiende'}`, peek(), 'ARCH_SYNTAX');
    return take();
  };
  const word = () => typed('word', 'Bezeichner').value;
  const text = () => {
    if (!['word', 'string'].includes(peek().type)) fail('String oder Wort erwartet', peek(), 'ARCH_SYNTAX');
    return take().value;
  };
  const scalar = () => {
    if (is('[')) {
      take(); const values = [];
      if (!is(']')) {
        if (is('[')) fail('Verschachtelte Listen sind nicht erlaubt', peek());
        values.push(scalar());
        while (is(',')) {
          take(); if (is('[')) fail('Verschachtelte Listen sind nicht erlaubt', peek()); values.push(scalar());
          if (values.length > 4000) fail('Maximal 4000 Listeneinträge erlaubt', peek());
        }
      }
      expect(']'); return values;
    }
    if (peek().type === 'number' || peek().type === 'string') return take().value;
    const value = word();
    return value === 'true' ? true : value === 'false' ? false : value;
  };
  const point = () => {
    expect('('); const x = typed('number'); expect(','); const y = typed('number'); expect(')');
    for (const token of [x, y]) if (Math.abs(token.value) > 1e7) fail('Koordinate außerhalb des Bereichs ±10000000', token);
    return { x: x.value, y: y.value };
  };
  const list = (fn) => { const result = [fn()]; while (is(',')) { take(); result.push(fn()); } return result; };
  const block = (fn) => {
    expect('{');
    while (!is('}')) {
      if (peek().type === 'eof') fail('Nicht abgeschlossener Block; erwartet: }', peek(), 'ARCH_SYNTAX');
      fn();
    }
    expect('}');
  };
  const property = (object, allowed) => {
    const key = typed('word');
    if (!allowed.includes(key.value)) fail(`Unbekanntes Attribut: ${key.value}`, key);
    if (Object.hasOwn(object, key.value)) fail(`Doppeltes Attribut: ${key.value}`, key);
    object[key.value] = text();
  };
  const modelProperty = (object, builtins, relation = false) => {
    const key = typed('word');
    object.attributes ??= dict(); object.attributeLocs ??= dict();
    if (Object.hasOwn(object.attributes, key.value) || (builtins.includes(key.value) || (relation && key.value === 'type')) && Object.hasOwn(object, key.value))
      fail(`Doppeltes Attribut: ${key.value}`, key);
    object.attributeLocs[key.value] = key;
    if (builtins.includes(key.value) || relation && key.value === 'type') object[key.value] = text();
    else object.attributes[key.value] = scalar();
  };
  expect('architecture');
  const model = { title: typed('string', 'Architekturtitel').value, description: '', nodes: [], edges: [], views: [] };
  let hasModel = false, hasDescription = false;
  const element = (parent = null, depth = 0) => {
    if (depth > 32) fail('Packages dürfen maximal 32 Ebenen tief verschachtelt sein', peek());
    const token = typed('word');
    if (token.value === 'relation') {
      const edge = { id: word(), source: word(), loc: token };
      expect('->'); edge.target = word(); edge.title = typed('string', 'Beziehungsbeschriftung').value;
      if (is('{')) block(() => modelProperty(edge, EDGE_PROPERTIES, true));
      model.edges.push(edge); return;
    }
    const node = { type: token.value, id: word(), title: typed('string', 'Elementtitel').value, parent, loc: token };
    model.nodes.push(node);
    if (is('{')) block(() => {
      if (is('relation') || peek().type === 'word' && tokens[cursor + 1]?.type === 'word' && tokens[cursor + 2]?.type === 'string') element(node.id, depth + 1);
      else modelProperty(node, NODE_PROPERTIES);
    });
  };
  const readView = () => {
    const token = expect('view');
    const view = { id: word(), title: typed('string', 'Ansichtstitel').value,
      places: dict(), styles: dict(), routes: dict(), loc: token };
    const seen = new Set();
    block(() => {
      const key = typed('word');
      if (['place', 'style', 'route'].includes(key.value)) {
        const id = word(), collection = view[{ place: 'places', style: 'styles', route: 'routes' }[key.value]];
        if (Object.hasOwn(collection, id)) fail(`Doppelte ${key.value}-Anweisung: ${id}`, key);
        const item = { loc: key };
        if (key.value === 'place') {
          expect('at'); item.at = point();
          if (is('size')) { take(); item.size = point(); }
        } else if (key.value === 'style') {
          block(() => property(item, ['template', 'accent', 'icon', 'backgroundColor']));
        } else {
          block(() => {
            const attr = typed('word');
            if (!['from', 'to', 'via', 'curve', 'label', 'path'].includes(attr.value)) fail(`Unbekanntes Routing-Attribut: ${attr.value}`, attr);
            if (Object.hasOwn(item, attr.value)) fail(`Doppeltes Routing-Attribut: ${attr.value}`, attr);
            if (attr.value === 'via') item.via = list(point);
            else if (attr.value === 'label') item.label = point();
            else if (['from', 'to'].includes(attr.value) && is('(')) item[attr.value] = point();
            else item[attr.value] = text();
          });
        }
        collection[id] = item;
      } else {
        if (seen.has(key.value)) fail(`Doppelte Ansichtseinstellung: ${key.value}`, key);
        seen.add(key.value);
        if (key.value === 'diagram') {
          view.diagram = { type: word() };
          if (is('{')) block(() => {
            const option = typed('word');
            if (Object.hasOwn(view.diagram, option.value)) fail(`Doppelte Diagrammeinstellung: ${option.value}`, option);
            view.diagram[option.value] = scalar();
          });
        }
        else if (key.value === 'include') view.include = list(word);
        else if (key.value === 'spacing') view.spacing = typed('number').value;
        else if (['direction', 'theme', 'viewpoint'].includes(key.value)) view[key.value] = word();
        else fail(`Unbekannte Ansichtseinstellung: ${key.value}`, key);
      }
    });
    view.direction ??= 'right'; view.theme ??= 'light'; view.spacing ??= 80;
    model.views.push(view);
  };
  const readConfig = () => {
    const loc = expect('config');
    if (model.config) fail('Nur ein config-Block ist erlaubt', loc);
    const definition = { id: 'inline', nodeTypes: dict(), relationTypes: dict(), viewpoints: dict(), styleGroups: dict() };
    const config = { loc, definition }, seen = new Set();
    const once = (object, key, loc) => { if (Object.hasOwn(object, key)) fail(`Doppelte Profileinstellung: ${key}`, loc); };
    const readAttribute = (attributes, keyword) => {
      const name = word(); once(attributes, name, keyword);
      const rule = dict();
      block(() => {
        const key = typed('word'); once(rule, key.value, key);
        if (key.value === 'enum') rule.enum = list(scalar);
        else if (key.value === 'targets') rule.targets = list(text);
        else if (['type', 'required', 'min', 'max', 'minLength', 'maxLength', 'format', 'many', 'minItems', 'maxItems', 'uniqueItems'].includes(key.value)) rule[key.value] = scalar();
        else fail(`Unbekannte Attributregel: ${key.value}`, key);
      });
      attributes[name] = rule;
    };
    block(() => {
      const key = typed('word');
      if (['type', 'relation', 'viewpoint', 'styleGroup'].includes(key.value)) {
        const name = word(), collection = definition[{ type: 'nodeTypes', relation: 'relationTypes', viewpoint: 'viewpoints', styleGroup: 'styleGroups' }[key.value]];
        once(collection, name, key);
        const rule = dict();
        block(() => {
          const attr = typed('word');
          if (attr.value === 'attribute' && key.value !== 'viewpoint') {
            rule.attributes ??= dict(); readAttribute(rule.attributes, attr);
          } else if (attr.value === 'attributes' && key.value !== 'viewpoint') {
            once(rule, 'attributes', attr); rule.attributes = dict();
            block(() => { const keyword = expect('attribute'); readAttribute(rule.attributes, keyword); });
          } else if (['incoming', 'outgoing'].includes(attr.value) && key.value === 'relation') {
            once(rule, attr.value, attr); const count = dict();
            block(() => { const bound = typed('word'); once(count, bound.value, bound); if (!['min', 'max'].includes(bound.value)) fail('Erwartet: min oder max', bound); count[bound.value] = typed('number').value; });
            rule[attr.value] = count;
          } else {
            once(rule, attr.value, attr);
            const listKeys = key.value === 'type' ? ['contains'] : key.value === 'relation' ? ['from', 'to'] : ['nodes', 'relations', 'requiredNodes', 'requiredRelations'];
            const scalarKeys = key.value === 'type' ? ['extends', 'template', 'container', 'abstract', 'icon', 'accent', 'backgroundColor', 'styleGroup'] : key.value === 'relation' ? ['extends', 'style', 'abstract', 'allowSelf', 'acyclic'] : key.value === 'styleGroup' ? ['backgroundColor'] : [];
            if (attr.value === 'extends') { const parents = list(text); rule.extends = parents.length === 1 ? parents[0] : parents; }
            else if (listKeys.includes(attr.value)) rule[attr.value] = list(text);
            else if (scalarKeys.includes(attr.value)) rule[attr.value] = scalar();
            else fail(`Unbekannte Profilregel: ${attr.value}`, attr);
          }
        });
        collection[name] = rule;
      } else {
        if (seen.has(key.value)) fail(`Doppelte Profileinstellung: ${key.value}`, key);
        seen.add(key.value);
        if (key.value === 'profile') config.profile = text();
        else if (['id', 'title', 'version', 'extends', 'defaultRelation', 'requireViewpoint'].includes(key.value)) definition[key.value] = scalar();
        else fail(`Unbekannte config-Einstellung: ${key.value}`, key);
      }
    });
    const hasDefinition = Object.keys(definition.nodeTypes).length || Object.keys(definition.relationTypes).length || Object.keys(definition.viewpoints).length || Object.keys(definition.styleGroups).length || definition.extends;
    if (config.profile && (hasDefinition || [...seen].some(key => key !== 'profile'))) fail('config profile und Inline-Profildefinition sind Alternativen', loc);
    if (config.profile) delete config.definition;
    model.config = config;
  };
  block(() => {
    if (is('description')) {
      if (hasDescription) fail('Doppelte Architekturbeschreibung', peek());
      take(); model.description = text(); hasDescription = true;
    } else if (is('model')) {
      if (hasModel) fail('Nur ein model-Block ist erlaubt', peek());
      take(); block(() => element()); hasModel = true;
    } else if (is('view')) readView();
    else if (is('config')) readConfig();
    else fail('Erwartet: model, view, config oder description', peek(), 'ARCH_SYNTAX');
  });
  typed('eof', 'Dateiende');
  if (!hasModel) fail('model-Block fehlt');
  if (model.nodes.length > 1000 || model.edges.length > 4000) fail('Maximal 1000 Elemente und 4000 Beziehungen erlaubt');
  if (!model.views.length) model.views.push({ id: 'default', title: model.title,
    direction: 'right', theme: 'light', spacing: 80, places: dict(), styles: dict(), routes: dict() });
  return model;
}

export function parse(source, options = {}) {
  const model = parseDocument(source);
  model.profile = resolveProfile(model, options);
  for (const edge of model.edges) if (edge.type === undefined && model.profile.defaultRelation !== null) edge.type = model.profile.defaultRelation;
  validateModel(model);
  return model;
}

export function validateModel(model, options = {}) {
  if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views) || !model.views.length)
    fail('Ungültiges Modell; verwende parse(source)');
  const profile = resolveProfile(model, options);
  const ids = new Set(), nodes = new Map(model.nodes.map(n => [n.id, n]));
  for (const item of [...model.nodes, ...model.edges]) {
    if (ids.has(item.id)) fail(`Doppelte ID: ${item.id}`, item.loc);
    ids.add(item.id);
  }
  for (const node of model.nodes) {
    if (node.parent && !nodes.has(node.parent)) fail(`Unbekannter Container: ${node.parent}`, node.loc);
    const ancestry = new Set([node.id]);
    let parent = nodes.get(node.parent);
    while (parent) {
      if (ancestry.has(parent.id)) fail(`Zyklische Package-Hierarchie: ${node.id}`, node.loc);
      ancestry.add(parent.id); parent = nodes.get(parent.parent);
    }
  }
  for (const edge of model.edges) {
    for (const id of [edge.source, edge.target]) if (!nodes.has(id)) fail(`Unbekannter Endpunkt: ${id}`, edge.loc);
  }
  const views = new Set();
  for (const view of model.views) {
    if (views.has(view.id)) fail(`Doppelte Ansichts-ID: ${view.id}`, view.loc);
    views.add(view.id);
    if (!['right', 'down'].includes(view.direction)) fail('direction muss right oder down sein', view.loc);
    if (!['light', 'dark'].includes(view.theme)) fail('theme muss light oder dark sein', view.loc);
    if (!Number.isFinite(view.spacing) || view.spacing < 24 || view.spacing > 400) fail('spacing muss zwischen 24 und 400 liegen', view.loc);
    for (const id of [...(view.include ?? []), ...Object.keys(view.places), ...Object.keys(view.styles)])
      if (!nodes.has(id)) fail(`Unbekanntes Element in Ansicht ${view.id}: ${id}`, view.loc);
    for (const [id, place] of Object.entries(view.places))
      if (place.size && (place.size.x < 160 || place.size.y < 96)) fail(`Größe von ${id} muss mindestens (160, 96) sein`, place.loc);
    for (const [id, style] of Object.entries(view.styles)) {
      if (style.template !== undefined && (!TEMPLATES.includes(style.template) || !!profile.nodeTypes[nodes.get(id).type]?.container !== (style.template === 'package')))
        fail(`Ungültiges Template für ${id}: ${style.template}`, style.loc);
      if (style.accent !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(style.accent)) fail('accent muss eine Hexfarbe sein', style.loc);
      if (style.backgroundColor !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(style.backgroundColor)) fail('backgroundColor muss eine Hexfarbe sein', style.loc);
    }
    const edges = new Set(model.edges.map(e => e.id));
    for (const [id, route] of Object.entries(view.routes)) {
      if (!edges.has(id)) fail(`Unbekannte Beziehung: ${id}`, route.loc);
      for (const key of ['from', 'to']) if (typeof route[key] === 'string' && !['auto', 'top', 'right', 'bottom', 'left'].includes(route[key]))
        fail(`Unbekannter Port: ${route[key]}`, route.loc);
      if (route.curve !== undefined && !['orthogonal', 'straight', 'rounded', 'bezier'].includes(route.curve)) fail(`Unbekannte Kurve: ${route.curve}`, route.loc);
      if (route.curve === 'bezier' && route.via && route.via.length !== 2) fail('bezier benötigt genau zwei Kontrollpunkte', route.loc);
    }
  }
  const diagnostics = profileDiagnostics(model, profile);
  if (diagnostics.length) {
    const first = diagnostics[0], error = new ArchError(first.message, first, first.code);
    error.diagnostics = diagnostics;
    throw error;
  }
  for (const view of model.views) validateDiagramView(model, profile, view);
  return model;
}

export function validate(sourceOrModel, options = {}) {
  let model, profile;
  try {
    model = typeof sourceOrModel === 'string' ? parseDocument(sourceOrModel) : sourceOrModel;
    if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views))
      throw new ArchError('Ungültiges Modell; verwende parse(source)', {}, 'ARCH_VALIDATION');
    profile = resolveProfile(model, options);
    validateModel(model, { profile });
    return { valid: true, profile: { id: profile.id, version: profile.version }, diagnostics: [] };
  } catch (error) {
    if (!(error instanceof ArchError)) throw error;
    return { valid: false, profile: profile ? { id: profile.id, version: profile.version } : null,
      diagnostics: error.diagnostics ?? [{ severity: 'error', code: error.code, message: error.message, line: error.line, column: error.column }] };
  }
}
