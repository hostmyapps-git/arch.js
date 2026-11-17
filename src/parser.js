import { ArchError } from './errors.js';
import { normalizeColor } from './colors.js';
import { parseHelpCommand, helpDocument, request as helpRequest } from './help-syntax.js';
import { viewIds } from './view-selection.js';
import { routingOptions } from './routing-options.js';
import { relationshipReferences } from './relationship-labels.js';
import { validateDiagramView } from './diagrams.js';
import { jsonToDSL, isJSONDocument } from './json.js';
import { metaCommand, validateMetaView } from './meta-syntax.js';
import { validationMode, validationDiagnostics } from './validation-mode.js';
import {validateTreeGroups} from './tree-groups.js';
import {placementCoordinate,placementPlan} from './placement.js';
import {viaReferences} from './via.js';
import {validateClassPlacement} from './class-placement.js';
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
    if (c === '@') {
      // A directive ends at the line, semicolon or containing closing brace.
      // Quotes protect separators in filters, and normal string tokens below
      // keep literal @help text out of this branch.
      let end = i, quoted = false;
      while (end < source.length) {
        const char = source[end];
        if (quoted && char === '\\') { end += 2; continue; }
        if (char === '"') quoted = !quoted;
        if (char === '\n' || !quoted && (';}'.includes(char) || char === '#' || source.slice(end, end + 2) === '//')) break;
        end++;
      }
      tokens.push({ type: 'directive', value: source.slice(i, end), ...loc }); advance(end - i); continue;
    }
    if (source.slice(i, i + 3) === '<->') {
      tokens.push({ type: '<->', value: '<->', ...loc }); advance(3); continue;
    }
    if (source.slice(i, i + 2) === '->') {
      tokens.push({ type: '->', value: '->', ...loc }); advance(2); continue;
    }
    if ('{}(),[]+*/'.includes(c)||c==='-'&&!/[\d.]/.test(source[i+1]??'')) { tokens.push({ type: c, value: c, ...loc }); advance(1); continue; }
    if (c === '"') {
      let end = i + 1;
      while (end < source.length) {
        if (source[end] === '\\') { end += 2; continue; }
        if (source[end] === '"') break;
        end++;
      }
      if (end >= source.length) fail('Unclosed string', loc, 'ARCH_SYNTAX');
      const raw = source.slice(i, end + 1);
      let value;
      try { value = JSON.parse(raw); } catch { fail('Invalid string or escape sequence', loc, 'ARCH_SYNTAX'); }
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value) ||
          [...value].some(char => { const code = char.codePointAt(0); return code >= 0xd800 && code <= 0xdfff; }))
        fail('String contains a Unicode character that is invalid in SVG', loc, 'ARCH_SYNTAX');
      tokens.push({ type: 'string', value, ...loc }); advance(raw.length); continue;
    }
    const number = source.slice(i).match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) fail('Number must be finite', loc);
      tokens.push({ type: 'number', value, ...loc }); advance(number[0].length); continue;
    }
    const word = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_.-]*/);
    if (word) {
      // Keep the arrow available even without spaces: a->b.
      const value = word[0].replace(/-$/, (match) => source[i + word[0].length] === '>' ? '' : match);
      tokens.push({ type: 'word', value, ...loc }); advance(value.length); continue;
    }
    fail(`Unexpected character ${JSON.stringify(c)}`, loc, 'ARCH_SYNTAX');
  }
  tokens.push({ type: 'eof', value: '', line, column });
  return tokens;
}

export function parseDocument(source) {
  if (source === null || !['string', 'object'].includes(typeof source)) fail('Source must be a string or a JSON architecture object');
  if (typeof source !== 'string' || /^[\s\uFEFF]*[\[{]/.test(source)) {
    const translated = jsonToDSL(source);
    let model;
    try { model = parseDSLDocument(translated.source); }
    catch (error) {
      if (!(error instanceof ArchError)) throw error;
      const message = error.message.replace(/ \(line \d+, column \d+\)$/, '');
      throw new ArchError(message, translated.origin(error.line), error.code);
    }
    const seen = new Set();
    const relocate = value => {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (typeof value.line === 'number' && typeof value.column === 'number') Object.assign(value, translated.origin(value.line));
      for (const child of Object.values(value)) relocate(child);
    };
    relocate(model);
    return model;
  }
  return parseDSLDocument(source);
}

function parseDSLDocument(source) {
  if (typeof source !== 'string') fail('Source must be a string');
  if (source.length > 2_000_000) fail('Source exceeds 2 MB');
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const is = (value) => peek().value === value;
  const take = () => tokens[cursor++];
  const expect = (value) => {
    if (!is(value)) fail(`Expected: ${value}; found: ${peek().value || 'end of input'}`, peek(), 'ARCH_SYNTAX');
    return take();
  };
  const typed = (type, label = type) => {
    if (peek().type !== type) fail(`Expected: ${label}; found: ${peek().value || 'end of input'}`, peek(), 'ARCH_SYNTAX');
    return take();
  };
  const word = () => typed('word', 'identifier').value;
  const text = () => {
    if (!['word', 'string'].includes(peek().type)) fail('Expected a string or word', peek(), 'ARCH_SYNTAX');
    return take().value;
  };
  const scalar = () => {
    if (is('[')) {
      take(); const values = [];
      if (!is(']')) {
        if (is('[')) fail('Nested lists are not allowed', peek());
        values.push(scalar());
        while (is(',')) {
          take(); if (is('[')) fail('Nested lists are not allowed', peek()); values.push(scalar());
          if (values.length > 4000) fail('At most 4000 list entries are allowed', peek());
        }
      }
      expect(']'); return values;
    }
    if (peek().type === 'number' || peek().type === 'string') return take().value;
    const value = word();
    return value === 'true' ? true : value === 'false' ? false : value;
  };
  const placementPoint = () => {
    const coordinate=()=>{
      const loc=peek(),parts=[];let depth=0;
      while(peek().type!=='eof'&&!(depth===0&&[',',')'].includes(peek().type))) {
        if(!['word','number','+','-','*','/','(',')'].includes(peek().type))fail('Expected a placement coordinate expression',peek(),'ARCH_SYNTAX');
        if(peek().type==='(')depth++;else if(peek().type===')')depth--;
        parts.push(String(take().value));if(parts.length>128)fail('Placement coordinate expression is too long',loc);
      }
      return placementCoordinate(parts.join(' '),loc);
    };
    expect('(');const x=coordinate();expect(',');const y=coordinate();expect(')');return {x,y};
  };
  const point = () => {
    expect('('); const x = typed('number'); expect(','); const y = typed('number'); expect(')');
    for (const token of [x, y]) if (Math.abs(token.value) > 1e7) fail('Coordinate outside the range ±10000000', token);
    return { x: x.value, y: y.value };
  };
  const list = (fn) => { const result = [fn()]; while (is(',')) { take(); result.push(fn()); } return result; };
  const block = (fn) => {
    expect('{');
    while (!is('}')) {
      if (peek().type === 'eof') fail('Unclosed block; expected: }', peek(), 'ARCH_SYNTAX');
      fn();
    }
    expect('}');
  };
  const property = (object, allowed) => {
    const key = typed('word');
    if (!allowed.includes(key.value)) fail(`Unknown attribute: ${key.value}`, key);
    if (Object.hasOwn(object, key.value)) fail(`Duplicate attribute: ${key.value}`, key);
    if (['showIcon', 'showLabel', 'showStereotype', 'showDescription', 'showTechnology','propertyFields'].includes(key.value)) { object[key.value] = scalar(); return; }
    object[key.value] = ['opacity', 'fontSize', 'width', 'height'].includes(key.value) ? typed('number').value : text();
  };
  const modelProperty = (object, builtins, relation = false) => {
    const key = typed('word');
    object.attributes ??= dict(); object.attributeLocs ??= dict();
    if (Object.hasOwn(object.attributes, key.value) || (builtins.includes(key.value) || (relation && key.value === 'type')) && Object.hasOwn(object, key.value))
      fail(`Duplicate attribute: ${key.value}`, key);
    object.attributeLocs[key.value] = key;
    if (builtins.includes(key.value) || relation && key.value === 'type') object[key.value] = key.value === 'opacity' ? typed('number').value : text();
    else object.attributes[key.value] = scalar();
  };
  if (peek().type === 'directive') {
    const directive = take();
    if (/^@meta\b/.test(directive.value)) fail('@meta requires architecture source; place @meta json or @meta dsl inside an architecture or view',directive,'ARCH_META');
    typed('eof', 'end of input');
    return helpDocument(parseHelpCommand(directive.value));
  }
  expect('architecture');
  const model = { title: typed('string', 'architecture title').value, description: '', nodes: [], edges: [], views: [] };
  let hasModel = false, hasDescription = false;
  const element = (parent = null, depth = 0) => {
    if (depth > 32) fail('Packages may be nested at most 32 levels deep', peek());
    const token = typed('word');
    if (token.value === 'relation') {
      const edge = { id: word(), source: word(), loc: token };
      if(is('<->')) { take(); edge.direction='both'; } else expect('->');
      edge.target = word(); edge.title = typed('string', 'relationship label').value;
      if (is('{')) block(() => modelProperty(edge, EDGE_PROPERTIES, true));
      model.edges.push(edge); return;
    }
    const node = { type: token.value, id: word(), title: typed('string', 'element title').value, parent, loc: token };
    model.nodes.push(node);
    if (is('{')) block(() => {
      if (is('relation') || peek().type === 'word' && tokens[cursor + 1]?.type === 'word' && tokens[cursor + 2]?.type === 'string') element(node.id, depth + 1);
      else modelProperty(node, NODE_PROPERTIES);
    });
  };
  const readRouting = (item, reference = false, defaults = false) => block(() => {
    const attr = typed('word');
    const allowed = reference ? ['from', 'to', 'via', 'curve', 'path'] : ['from', 'to', 'via', 'curve', 'label', 'path', 'icon', 'iconPosition', 'showIcon', 'showLabel', 'sharePath'];
    if (!allowed.includes(attr.value)) fail(`Unknown routing attribute: ${attr.value}`, attr);
    if (Object.hasOwn(item, attr.value)) fail(`Duplicate routing attribute: ${attr.value}`, attr);
    if (['showIcon', 'showLabel'].includes(attr.value)) item[attr.value] = scalar();
    else if (attr.value === 'via') item.via = list(placementPoint);
    else if (attr.value === 'to' && (reference || defaults && peek().type === 'number')) item.to = typed('number', 'position along the relationship (0 to 1)').value;
    else if (attr.value === 'label') {
      if (is('none')) { take(); item.label = 'none'; }
      else item.label = point();
    }
    else if (['from', 'to'].includes(attr.value) && is('(')) item[attr.value] = point();
    else item[attr.value] = text();
  });
  const readView = () => {
    const token = expect('view');
    const view = { id: word(), title: typed('string', 'view title').value,
      places: dict(), styles: dict(), routes: dict(), loc: token };
    const seen = new Set();
    block(() => {
      if (peek().type === 'directive') {
        const directive=take();
        if(!/^@meta\b/.test(directive.value))fail('Only @meta directives are allowed inside a view',directive,'ARCH_META');
        if(seen.has('meta'))fail('Only one meta directive is allowed per view',directive,'ARCH_META');
        seen.add('meta');view.meta=metaCommand(directive.value,directive);return;
      }
      const key = typed('word');
      if(key.value==='tree') {
        const id=word();view.trees??=dict();if(Object.hasOwn(view.trees,id))fail(`Duplicate tree group: ${id}`,key);
        const tree={loc:key};block(()=>{const option=typed('word');if(Object.hasOwn(tree,option.value))fail(`Duplicate tree option: ${option.value}`,option);tree[option.value]=scalar();});view.trees[id]=tree;
      } else if (key.value === 'route' && peek().type === 'word' && tokens[cursor + 1]?.type === '->') {
        const nodeId = word(); expect('->'); const edgeId = word();
        view.referenceRoutes ??= [];
        if (view.referenceRoutes.some(route => route.nodeId === nodeId && route.edgeId === edgeId))
          fail(`Duplicate reference route: ${nodeId} -> ${edgeId}`, key);
        const route = {nodeId, edgeId, loc: key};
        readRouting(route, true); view.referenceRoutes.push(route);
      } else if (['place', 'style', 'route'].includes(key.value)) {
        const id = word(), collection = view[{ place: 'places', style: 'styles', route: 'routes' }[key.value]];
        if (Object.hasOwn(collection, id)) fail(`Duplicate ${key.value}-statement: ${id}`, key);
        const item = { loc: key };
        if (key.value === 'place') {
          expect('at'); item.at = placementPoint();
          if (is('size')) { take(); item.size = point(); }
        } else if (key.value === 'style') {
          block(() => property(item, ['template', 'accent', 'icon', 'iconPosition', 'backgroundColor', 'opacity', 'display', 'fontSize', 'width', 'height', 'showIcon', 'showLabel', 'showStereotype', 'showDescription', 'showTechnology','propertyFields']));
        } else readRouting(item);
        collection[id] = item;
      } else {
        if (seen.has(key.value)) fail(`Duplicate view option: ${key.value}`, key);
        seen.add(key.value);
        if (key.value === 'meta') view.meta = text();
        else if (key.value === 'diagram') {
          view.diagram = { type: word() };
          if (is('{')) block(() => {
            const option = typed('word');
            if (Object.hasOwn(view.diagram, option.value)) fail(`Duplicate diagram option: ${option.value}`, option);
            view.diagram[option.value] = scalar();
          });
        }
        else if (key.value === 'routes') { view.routeDefaults = {loc: key}; readRouting(view.routeDefaults, false, true); }
        else if (['include', 'exclude'].includes(key.value)) view[key.value] = list(word);
        else if (key.value === 'spacing') view.spacing = typed('number').value;
        else if (key.value === 'propertyFields') view.propertyFields=scalar();
        else if (['direction', 'theme', 'viewpoint', 'referenceDisplay', 'referenceOccurrences'].includes(key.value)) view[key.value] = word();
        else fail(`Unknown view option: ${key.value}`, key);
      }
    });
    view.direction ??= 'right'; view.theme ??= 'light'; view.spacing ??= 80;
    model.views.push(view);
  };
  const readConfig = () => {
    const loc = expect('config');
    if (model.config) fail('Only one config block is allowed', loc);
    const definition = { id: 'inline', nodeTypes: dict(), relationTypes: dict(), viewpoints: dict(), styleGroups: dict() };
    const config = { loc, definition }, seen = new Set();
    const once = (object, key, loc) => { if (Object.hasOwn(object, key)) fail(`Duplicate profile option: ${key}`, loc); };
    const readAttribute = (attributes, keyword) => {
      const name = word(); once(attributes, name, keyword);
      const rule = dict();
      block(() => {
        const key = typed('word'); once(rule, key.value, key);
        if (key.value === 'enum') rule.enum = list(scalar);
        else if (key.value === 'targets') rule.targets = list(text);
        else if (['type', 'required', 'min', 'max', 'minLength', 'maxLength', 'format', 'many', 'minItems', 'maxItems', 'uniqueItems'].includes(key.value)) rule[key.value] = scalar();
        else fail(`Unknown attribute rule: ${key.value}`, key);
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
            block(() => { const bound = typed('word'); once(count, bound.value, bound); if (!['min', 'max'].includes(bound.value)) fail('Expected: min or max', bound); count[bound.value] = typed('number').value; });
            rule[attr.value] = count;
          } else {
            once(rule, attr.value, attr);
            const listKeys = key.value === 'type' ? ['contains'] : key.value === 'relation' ? ['from', 'to', 'directions'] : ['nodes', 'relations', 'requiredNodes', 'requiredRelations'];
            const scalarKeys = key.value === 'type' ? ['extends', 'template', 'container', 'abstract', 'icon', 'accent', 'backgroundColor', 'styleGroup'] : key.value === 'relation' ? ['extends', 'style', 'abstract', 'allowSelf', 'acyclic'] : key.value === 'styleGroup' ? ['backgroundColor'] : [];
            if (attr.value === 'extends') { const parents = list(text); rule.extends = parents.length === 1 ? parents[0] : parents; }
            else if (attr.value==='directions'&&key.value==='relation'&&is('[')) rule.directions=scalar();
            else if (listKeys.includes(attr.value)) rule[attr.value] = list(text);
            else if (scalarKeys.includes(attr.value)) rule[attr.value] = scalar();
            else fail(`Unknown profile rule: ${attr.value}`, attr);
          }
        });
        collection[name] = rule;
      } else {
        if (seen.has(key.value)) fail(`Duplicate profile option: ${key.value}`, key);
        seen.add(key.value);
        if (key.value === 'profile') config.profile = text();
        else if (key.value === 'views') config.views = scalar();
        else if (key.value === 'validation') config.validation = text();
        else if (['id', 'title', 'version', 'extends', 'defaultRelation', 'requireViewpoint'].includes(key.value)) definition[key.value] = scalar();
        else fail(`Unknown config option: ${key.value}`, key);
      }
    });
    const hasDefinition = Object.keys(definition.nodeTypes).length || Object.keys(definition.relationTypes).length || Object.keys(definition.viewpoints).length || Object.keys(definition.styleGroups).length || definition.extends;
    if (config.profile && (hasDefinition || [...seen].some(key => !['profile', 'views', 'validation'].includes(key)))) fail('Choose either config profile or an inline profile definition', loc);
    if (config.profile || !hasDefinition && seen.size === 1 && seen.has('views')) delete config.definition;
    model.config = config;
  };
  block(() => {
    if (peek().type === 'directive') {
      const directive = take();
      if(/^@meta\b/.test(directive.value)) {
        const format=metaCommand(directive.value,directive);
        model.views.push({id:`meta-${format}`,title:`Architecture as ${format.toUpperCase()}`,meta:format,
          direction:'right',theme:'light',spacing:80,places:dict(),styles:dict(),routes:dict(),loc:directive});
        return;
      }
      if (model.help) fail('Only one @help command is allowed per architecture', directive, 'ARCH_HELP');
      model.help = parseHelpCommand(directive.value);
    } else if (is('description')) {
      if (hasDescription) fail('Duplicate architecture description', peek());
      take(); model.description = text(); hasDescription = true;
    } else if (is('model')) {
      if (hasModel) fail('Only one model block is allowed', peek());
      take(); block(() => element()); hasModel = true;
    } else if (is('view')) readView();
    else if (is('config')) readConfig();
    else fail('Expected: model, view, config, description, @help or @meta', peek(), 'ARCH_SYNTAX');
  });
  typed('eof', 'end of input');
  if (model.help) return { ...model, ...helpDocument(model.help), title: model.title, config: model.config };
  if (!hasModel) fail('Missing model block');
  if (model.nodes.length > 1000 || model.edges.length > 4000) fail('At most 1000 elements and 4000 relationships are allowed');
  if (!model.views.length) model.views.push({ id: 'default', title: model.title,
    direction: 'right', theme: 'light', spacing: 80, places: dict(), styles: dict(), routes: dict() });
  return model;
}

export function parse(source, options = {}) {
  const model = parseDocument(source);
  model.profile = resolveProfile(model, options);
  if(options.validation!==undefined)model.validation=options.validation;
  for (const edge of model.edges) if (edge.type === undefined && model.profile.defaultRelation !== null) edge.type = model.profile.defaultRelation;
  validateModel(model,options);
  return model;
}

export function validateModel(model, options = {}) {
  if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views) || !model.views.length)
    fail('Invalid model; use parse(source)');
  const profile = resolveProfile(model, options);
  const mode=validationMode(model,options);
  if (model.kind === 'help') { helpRequest(model.help?.topic, model.help?.parameters); return model; }
  const ids = new Set(), nodes = new Map(model.nodes.map(n => [n.id, n]));
  for (const item of [...model.nodes, ...model.edges]) {
    if (ids.has(item.id)) fail(`Duplicate ID: ${item.id}`, item.loc);
    ids.add(item.id);
  }
  for (const node of model.nodes) {
    if (node.parent && !nodes.has(node.parent)) fail(`Unknown container: ${node.parent}`, node.loc);
    const ancestry = new Set([node.id]);
    let parent = nodes.get(node.parent);
    while (parent) {
      if (ancestry.has(parent.id)) fail(`Cyclic package hierarchy: ${node.id}`, node.loc);
      ancestry.add(parent.id); parent = nodes.get(parent.parent);
    }
  }
  for (const edge of model.edges) {
    for (const id of [edge.source, edge.target]) if (!nodes.has(id)) fail(`Unknown endpoint: ${id}`, edge.loc);
  }
  const views = new Set();
  for (const view of model.views) {
    if (views.has(view.id)) fail(`Duplicate view ID: ${view.id}`, view.loc);
    views.add(view.id);
    if (!['right', 'down'].includes(view.direction)) fail('direction must be right or down', view.loc);
    if (!['light', 'dark'].includes(view.theme)) fail('theme must be light or dark', view.loc);
    if(validateMetaView(view)) continue;
    if (view.referenceDisplay !== undefined && !['labels', 'nodes', 'both'].includes(view.referenceDisplay)) fail('referenceDisplay must be labels, nodes or both', view.loc);
    if (view.referenceOccurrences !== undefined && !['shared', 'perEdge'].includes(view.referenceOccurrences)) fail('referenceOccurrences must be shared or perEdge', view.loc);
    if (!Number.isFinite(view.spacing) || view.spacing < 24 || view.spacing > 400) fail('spacing must be between 24 and 400', view.loc);
    for (const key of ['include', 'exclude']) if (view[key] !== undefined && (!Array.isArray(view[key]) || view[key].some(id => typeof id !== 'string')))
      fail(`${key} requires a list of element IDs`, view.loc);
    for (const id of [...(view.include ?? []), ...(view.exclude ?? [])])
      if (!nodes.has(id)) fail(`Unknown element in view ${view.id}: ${id}`, view.loc);
    for(const id of Object.keys(view.places))if(!nodes.has(id)&&!Object.hasOwn(view.trees??{},id))fail(`Unknown element or tree group in view ${view.id}: ${id}`,view.loc);
    const edges = new Map(model.edges.map(e => [e.id, e]));
    for (const [id, place] of Object.entries(view.places))
      if (place.size && (place.size.x < 160 || place.size.y < 96)) fail(`Size of ${id} must be at least (160, 96)`, place.loc);
    for (const [id, style] of Object.entries(view.styles)) {
      if(!nodes.has(id)) {
        if(!edges.has(id))fail(`Unknown element or relationship in view ${view.id}: ${id}`,style.loc);
        if(Object.keys(style).some(k=>!['loc','display'].includes(k))||!['none','standard'].includes(style.display))fail('Relationship styles support only display none or standard',style.loc);
        continue;
      }
      for (const [field,min,max] of [['fontSize',6,64],['width',160,1e7],['height',96,1e7]]) if (style[field] !== undefined &&
        (!Number.isFinite(style[field]) || style[field] < min || style[field] > max)) fail(`${field} must be a number between ${min} and ${max}`,style.loc);
      for (const key of ['showIcon', 'showLabel', 'showStereotype', 'showDescription', 'showTechnology']) if (style[key] !== undefined && typeof style[key] !== 'boolean') fail(`${key} must be true or false`, style.loc);
      if (style.iconPosition !== undefined && !['top', 'left', 'bottom', 'right'].includes(style.iconPosition)) fail('iconPosition must be top, left, bottom or right', style.loc);
      if (style.display !== undefined && !['standard', 'logo', 'none'].includes(style.display)) fail('display must be standard, logo or none', style.loc);
      if (style.display === 'logo' && profile.nodeTypes[nodes.get(id).type]?.container) fail('logo display is only supported for non-container elements', style.loc);
      if (style.opacity !== undefined && (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)) fail('opacity must be a number between 0 and 1', style.loc);
      if (style.template !== undefined && (!TEMPLATES.includes(style.template) || !!profile.nodeTypes[nodes.get(id).type]?.container !== (style.template === 'package')))
        fail(`Invalid template for ${id}: ${style.template}`, style.loc);
      if (style.accent !== undefined && !normalizeColor(style.accent)) fail('accent requires a hex color or CSS3 color name', style.loc);
      if (style.backgroundColor !== undefined && !normalizeColor(style.backgroundColor)) fail('backgroundColor requires a hex color or CSS3 color name', style.loc);
    }
    const referenceRoutes = view.referenceRoutes ?? [], referenceKeys = new Set();
    for (const route of referenceRoutes) {
      if (!nodes.has(route.nodeId)) fail(`Unknown reference element: ${route.nodeId}`, route.loc);
      const edge = edges.get(route.edgeId);
      if (!edge) fail(`Unknown relationship: ${route.edgeId}`, route.loc);
      const key = JSON.stringify([route.nodeId, route.edgeId]);
      if (referenceKeys.has(key)) fail(`Duplicate reference route: ${route.nodeId} -> ${route.edgeId}`, route.loc);
      referenceKeys.add(key);
      const rule = profile.relationTypes[edge.type ?? profile.defaultRelation] ?? {};
      if (!relationshipReferences(edge, rule).some(item => item.id === route.nodeId) || profile.nodeTypes[nodes.get(route.nodeId).type]?.container)
        fail(`Element ${route.nodeId} is not a graphical reference of relationship ${route.edgeId}`, route.loc);
      if (route.to !== undefined && (!Number.isFinite(route.to) || route.to < 0 || route.to > 1))
        fail('Reference route to must be a number between 0 and 1', route.loc);
    }
    for (const [id, route] of Object.entries(view.routes)) if (!edges.has(id)) fail(`Unknown relationship: ${id}`, route.loc);
    const checkRouting = (route, reference = false, defaults = false, combined = true) => {
      if (!route) return;
      if (route.sharePath !== undefined && !['none', 'stereotypes', 'all'].includes(route.sharePath)) fail('sharePath must be none, stereotypes or all', route.loc);
      for (const key of ['from', ...(!reference ? ['to'] : [])]) if (typeof route[key] === 'string' && !['auto', 'top', 'right', 'bottom', 'left'].includes(route[key]))
        fail(`Unknown port: ${route[key]}`, route.loc);
      if ((reference || defaults) && typeof route.to === 'number' && (!Number.isFinite(route.to) || route.to < 0 || route.to > 1))
        fail('Reference route to must be a number between 0 and 1', route.loc);
      for (const key of ['showIcon', 'showLabel']) if (route[key] !== undefined && typeof route[key] !== 'boolean') fail(`${key} must be true or false`, route.loc);
      if (route.label !== undefined && route.label !== 'none' && (!route.label || typeof route.label !== 'object' || !['x','y'].every(key => Number.isFinite(route.label[key]) && Math.abs(route.label[key]) <= 1e7))) fail('label must be none or a point (X, Y)', route.loc);
      if (route.icon !== undefined && (typeof route.icon !== 'string' || route.icon !== 'none' && !/^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(route.icon))) fail('icon must be PACK.NAME or none', route.loc);
      if (route.iconPosition !== undefined && !['top', 'left', 'bottom', 'right'].includes(route.iconPosition)) fail('iconPosition must be top, left, bottom or right', route.loc);
      if (route.curve !== undefined && !['orthogonal', 'straight', 'rounded', 'bezier'].includes(route.curve)) fail(`Unknown curve: ${route.curve}`, route.loc);
      if (combined && route.curve === 'bezier' && route.via && route.via.length !== 2) fail('bezier requires exactly two control points', route.loc);
    };
    checkRouting(view.routeDefaults, false, true, false);
    for (const route of Object.values(view.routes)) checkRouting(route, false, false, false);
    for (const route of referenceRoutes) checkRouting(route, true, false, false);
    const referenceRouteMap = new Map(referenceRoutes.map(route => [JSON.stringify([route.nodeId, route.edgeId]), route]));
    for (const edge of model.edges) {
      checkRouting(routingOptions(view, view.routes[edge.id]));
      const rule = profile.relationTypes[edge.type ?? profile.defaultRelation] ?? {};
      for (const item of relationshipReferences(edge, rule))
        checkRouting(routingOptions(view, referenceRouteMap.get(JSON.stringify([item.id, edge.id])), true), true);
    }
  }
  viewIds(model.config?.views, model.views, model.config?.loc);
  const diagnostics = validationDiagnostics(profileDiagnostics(model, profile),mode);
  const errors=diagnostics.filter(d=>d.severity==='error');
  if (errors.length) {
    const first = errors[0], error = new ArchError(first.message, first, first.code);
    error.diagnostics = diagnostics;
    throw error;
  }
  for (const view of model.views) {validateTreeGroups(model,profile,view);validateDiagramView(model, profile, view);if(view.meta===undefined){if(view.diagram?.type==='class')validateClassPlacement(model,profile,view);else placementPlan(model,profile,view);viaReferences(model,profile,view);}}
  return model;
}

export function validate(sourceOrModel, options = {}) {
  let model, profile;
  try {
    model = typeof sourceOrModel === 'string' || isJSONDocument(sourceOrModel) ? parseDocument(sourceOrModel) : sourceOrModel;
    if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views))
      throw new ArchError('Invalid model; use parse(source)', {}, 'ARCH_VALIDATION');
    profile = resolveProfile(model, options);
    validateModel(model, { ...options, profile });
    const diagnostics=validationDiagnostics(profileDiagnostics(model,profile),validationMode(model,options));
    return { valid: true, profile: { id: profile.id, version: profile.version }, diagnostics, ...(diagnostics.length?{conformant:false}:{}) };
  } catch (error) {
    if (!(error instanceof ArchError)) throw error;
    return { valid: false, profile: profile ? { id: profile.id, version: profile.version } : null,
      diagnostics: error.diagnostics ?? [{ severity: 'error', code: error.code, message: error.message, line: error.line, column: error.column, ...(error.path !== undefined ? {path: error.path} : {}) }] };
  }
}
