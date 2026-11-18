import { ArchError } from './errors.js';
import {placementCoordinate} from './placement.js';

const own = (o, k) => Object.hasOwn(o, k);
const record = o => o !== null && typeof o === 'object' && !Array.isArray(o);
const child = (path, key) => `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
const identifier = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const maxSource = 2_000_000;

export const isJSONDocument = value => record(value) && (own(value, 'architecture') || own(value, '@help'));

// JSON is a second concrete syntax. Lower only its surface notation to the DSL
// grammar so defaults, supported fields and all model rules stay in one place.
// Each generated line retains its JSON pointer and original source location.
export function jsonToDSL(input) {
  const locations = new Map();
  const lineStarts = [0];
  let source;
  const error = (message, path = '', offset) => {
    const loc = offset === undefined ? locations.get(path) ?? {path} : position(offset, path);
    throw new ArchError(message, loc, 'ARCH_JSON');
  };
  const position = (offset, path) => {
    let low = 0, high = lineStarts.length;
    while (low + 1 < high) { const mid = (low + high) >>> 1; if (lineStarts[mid] <= offset) low = mid; else high = mid; }
    return {path, line: low + 1, column: offset - lineStarts[low] + 1};
  };
  if (typeof input === 'string') source = input;
  else {
    // Reject non-JSON JS values before stringify can silently discard/coerce them.
    const ancestors = new Set();
    const check = (value, path, depth = 0) => {
      if (depth > 128) error('JSON nesting exceeds 128 levels', path);
      if (value === null || ['string', 'boolean'].includes(typeof value)) return;
      if (typeof value === 'number' && Number.isFinite(value)) return;
      if (typeof value !== 'object' || !value || !Array.isArray(value) && Object.getPrototypeOf(value) !== null && Object.getPrototypeOf(Object.getPrototypeOf(value)) !== null) error('Expected a JSON value', path);
      if (ancestors.has(value)) error('Cyclic JSON document', path);
      ancestors.add(value);
      for (const key of Reflect.ownKeys(value)) {
        if (Array.isArray(value) && key === 'length') continue;
        if (typeof key !== 'string') error('JSON keys must be strings', path);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!own(descriptor, 'value')) error('JSON properties must be data values', child(path, key));
        check(descriptor.value, child(path, key), depth + 1);
      }
      ancestors.delete(value);
    };
    check(input, '');
    source = JSON.stringify(input);
  }
  if (source.length > maxSource) error('Source exceeds 2 MB');
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1);
  try { JSON.parse(source); }
  catch (e) {
    const nativePosition = e.message.match(/position (\d+)/), nativeLine = e.message.match(/line (\d+) column (\d+)/);
    const at = nativePosition ? Number(nativePosition[1]) : nativeLine ? (lineStarts[Number(nativeLine[1])-1]??0)+Number(nativeLine[2])-1 : source.length;
    error(`Invalid JSON: ${e.message}`, '', at);
  }
  // Scan already syntax-checked JSON to preserve locations and reject duplicate
  // object keys (including escaped spellings), which JSON.parse would overwrite.
  let cursor = 0;
  const space = () => { while (/\s/.test(source[cursor] ?? '') && cursor < source.length) cursor++; };
  const string = () => {
    const start = cursor++;
    while (source[cursor] !== '"') { if (source[cursor] === '\\') cursor++; cursor++; }
    cursor++; return JSON.parse(source.slice(start, cursor));
  };
  const read = (path = '', depth = 0) => {
    space(); locations.set(path, position(cursor, path));
    if (depth > 128) error('JSON nesting exceeds 128 levels', path);
    if (source[cursor] === '{') {
      cursor++; space(); const result = Object.create(null);
      while (source[cursor] !== '}') {
        const start = cursor, key = string(), next = child(path, key);
        if (own(result, key)) error(`Duplicate JSON key: ${key}`, next, start);
        space(); cursor++; result[key] = read(next, depth + 1); space();
        if (source[cursor] !== ',') break;
        cursor++; space();
      }
      cursor++; return result;
    }
    if (source[cursor] === '[') {
      cursor++; space(); const result = [];
      while (source[cursor] !== ']') {
        result.push(read(child(path, result.length), depth + 1)); space();
        if (source[cursor] !== ',') break;
        cursor++;
      }
      cursor++; return result;
    }
    if (source[cursor] === '"') return string();
    const start = cursor;
    while (cursor < source.length && !/[\s,}\]]/.test(source[cursor])) cursor++;
    return JSON.parse(source.slice(start, cursor));
  };
  const document = read();
  const obj = (value, path) => { if (!record(value)) error('Expected an object', path); return value; };
  const keys = (value, allowed, path) => {
    obj(value, path);
    for (const key of Object.keys(value)) if (!allowed.includes(key)) error(`Unknown JSON field: ${key}`, child(path, key));
  };
  const id = (value, path) => { if (typeof value !== 'string' || !identifier.test(value)) error('Expected an identifier', path); return value; };
  const text = (value, path) => { if (typeof value !== 'string') error('Expected a string', path); return JSON.stringify(value); };
  const scalar = (value, path) => {
    if (Array.isArray(value)) {
      if (value.length > 4000) error('At most 4000 list entries are allowed', path);
      if (value.some(v => Array.isArray(v))) error('Nested attribute lists are not allowed', path);
      return `[${value.map((v, i) => scalar(v, child(path, i))).join(', ')}]`;
    }
    if (typeof value === 'string') return text(value, path);
    if (typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return String(value);
    error('Expected a string, finite number, boolean or flat list', path);
  };
  const list = (value, path) => {
    const values = Array.isArray(value) ? value : [value];
    if (!values.length) error('Expected a nonempty list', path);
    return values.map((v, i) => text(v, Array.isArray(value) ? child(path, i) : path)).join(', ');
  };
  const placementPoint = (value,path) => {
    if(!Array.isArray(value)||value.length!==2)error('Expected a coordinate pair [x, y]',path);
    return `(${value.map((v,i)=>placementCoordinate(v,{path:child(path,i)})).join(', ')})`;
  };
  const point = (value, path) => {
    if (!Array.isArray(value) || value.length !== 2 || value.some(v => typeof v !== 'number' || !Number.isFinite(v))) error('Expected a coordinate pair [x, y]', path);
    return `(${value.join(', ')})`;
  };
  const entries = (value, path) => {
    if (Array.isArray(value)) return value.map((v, i) => { const p = child(path, i); obj(v, p); return [id(v.id, child(p, 'id')), v, p]; });
    return Object.entries(obj(value, path)).map(([key, v]) => {
      const p = child(path, key); id(key, p); obj(v, p);
      if (own(v, 'id')) error('Use either an object key or an array entry with id', child(p, 'id'));
      return [key, v, p];
    });
  };
  const lines = [], origins = [];
  let generatedLength = 0;
  const emit = (line, path) => {
    generatedLength += line.length + 1;
    if (generatedLength > maxSource) error('Normalized source exceeds 2 MB', path);
    lines.push(line); origins.push(locations.get(path) ?? {path});
  };
  const field = (key, value, path) => emit(`${id(key, path)} ${scalar(value, path)}`, path);
  const attributes = (value, path, reserved = []) => {
    obj(value, path);
    for (const [key, v] of Object.entries(value)) {
      const p = child(path, key);
      if (reserved.includes(key)) error(`Reserved attribute: ${key}`, p);
      field(key, v, p);
    }
  };
  const config = (value, path) => {
    obj(value, path); emit('config {', path);
    for (const [key, v] of Object.entries(value)) {
      const p = child(path, key);
      if (['type', 'relation', 'viewpoint', 'styleGroup'].includes(key)) {
        for (const [name, rule, rp] of entries(v, p)) {
          emit(`${key} ${name} {`, rp);
          for (const [attr, a] of Object.entries(rule)) {
            if (attr === 'id') continue;
            const ap = child(rp, attr);
            if (['attribute', 'attributes'].includes(attr)) {
              for (const [name, schema, sp] of entries(a, ap)) {
                emit(`attribute ${name} {`, sp);
                for (const [option, optionValue] of Object.entries(schema)) if (option !== 'id') {
                  const op = child(sp, option);
                  let value;
                  if (option === 'enum') {
                    const values = Array.isArray(optionValue) ? optionValue : [optionValue];
                    if (!values.length) error('Expected a nonempty enum list', op);
                    value = values.map((v, i) => scalar(v, child(op, i))).join(', ');
                  } else value = option === 'targets' ? list(optionValue, op) : scalar(optionValue, op);
                  emit(`${id(option, op)} ${value}`, op);
                }
                emit('}', sp);
              }
            } else if (['incoming', 'outgoing'].includes(attr)) {
              obj(a, ap); emit(`${attr} {`, ap); attributes(a, ap); emit('}', ap);
            } else {
              const asList = ['extends', 'contains', 'from', 'to', 'directions', 'nodes', 'relations', 'requiredNodes', 'requiredRelations'].includes(attr);
              emit(`${id(attr, ap)} ${asList ? list(a, ap) : scalar(a, ap)}`, ap);
            }
          }
          emit('}', rp);
        }
      } else field(key, v, p);
    }
    emit('}', path);
  };
  let nodeCount = 0, edgeCount = 0;
  const model = (value, path, depth = 0) => {
    keys(value, ['elements', 'relations'], path);
    for (const [key, collection] of Object.entries(value)) for (const [name, item, p] of entries(collection, child(path, key))) {
      if (key === 'elements') {
        if (++nodeCount > 1000) error('At most 1000 elements are allowed', p);
        if (depth > 32) error('Packages may be nested at most 32 levels deep', p);
        emit(`${id(item.type, child(p, 'type'))} ${name} ${text(item.name, child(p, 'name'))} {`, p);
      } else {
        if (++edgeCount > 4000) error('At most 4000 relationships are allowed', p);
        if(item.direction!==undefined&&!['forward','both'].includes(item.direction))error('direction must be forward or both',child(p,'direction'));
        emit(`relation ${name} ${id(item.from, child(p, 'from'))} ${item.direction==='both'?'<->':'->'} ${id(item.to, child(p, 'to'))} ${text(item.name, child(p, 'name'))} {`, p);
      }
      const reserved = key === 'elements' ? ['id', 'type', 'name', 'elements', 'relations'] : ['id', 'name', 'from', 'to', 'direction'];
      const written = new Set();
      const attribute = (attr, v, ap) => {
        if (written.has(attr)) error(`Duplicate attribute: ${attr}`, ap);
        written.add(attr); field(attr, v, ap);
      };
      for (const [attr, v] of Object.entries(item)) {
        const ap = child(p, attr);
        if (reserved.includes(attr)) continue;
        if (attr === 'attributes') {
          obj(v, ap);
          for (const [a, av] of Object.entries(v)) attribute(a, av, child(ap, a));
        } else attribute(attr, v, ap);
      }
      if (key === 'elements' && (own(item, 'elements') || own(item, 'relations'))) {
        const nested = Object.create(null);
        if (own(item, 'elements')) nested.elements = item.elements;
        if (own(item, 'relations')) nested.relations = item.relations;
        model(nested, p, depth + 1);
      }
      emit('}', p);
    }
  };
  const routing = (value, path) => {
    obj(value, path); emit('{', path);
    const fraction = (value, p) => {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) return String(value);
      if (typeof value === 'string' && /^\s*-?(?:\d+(?:\.\d*)?|\.\d+)\s*\/\s*-?(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(value)) return value.trim();
      error('Port/attachment position must be a number between 0 and 1 or a fraction such as "1/2"', p);
    };
    for (const [key, v] of Object.entries(value)) {
      const p = child(path, key);
      if (key === 'via') {
        if (!Array.isArray(v) || !v.length) error('Expected a nonempty list of coordinate pairs', p);
        emit(`via ${v.map((pair, i) => placementPoint(pair, child(p, i))).join(', ')}`, p);
      } else if (['from', 'to'].includes(key) && record(v)) {
        keys(v, ['side', 'position'], p);
        if (!['top', 'right', 'bottom', 'left'].includes(v.side)) error('Positioned port side must be top, right, bottom or left', child(p, 'side'));
        emit(`${key} ${v.side} ${fraction(v.position, child(p, 'position'))}`, p);
      } else if (['from', 'to', 'label'].includes(key) && Array.isArray(v)) emit(`${key} ${point(v, p)}`, p);
      else if (key === 'to' && typeof v === 'string' && v.includes('/')) emit(`to ${fraction(v, p)}`, p);
      else if (key === 'label' && v === 'none') emit('label none', p);
      else field(key, v, p);
    }
    emit('}', path);
  };
  const help = (command, path) => {
    text(command, path);
    let quoted = false;
    for (let i = 0; i < command.length; i++) {
      const c = command[i];
      if (quoted && c === '\\') { i++; continue; }
      if (c === '"') quoted = !quoted;
      if (/[\r\n]/.test(c) || !quoted && /[;}]/.test(c)) error('Expected a single help query without @help', path);
    }
    emit(`@help ${command}`, path);
  };
  const views = (value, path) => {
    for (const [name, view, p] of entries(value, path)) {
      emit(`view ${name} ${text(view.name, child(p, 'name'))} {`, p);
      for (const [key, v] of Object.entries(view)) {
        const vp = child(p, key);
        if (['id', 'name'].includes(key)) continue;
        if (['meta','@meta'].includes(key)) {
          if(!['json','dsl'].includes(v))error('meta must be json or dsl',vp);
          emit(`@meta ${v}`,vp);
        }
        else if (['place', 'style', 'route'].includes(key)) {
          obj(v, vp);
          for (const [target, rule] of Object.entries(v)) {
            const rp = child(vp, target); obj(rule, rp);
            if (key === 'route') {
              const pair = target.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*->\s*([A-Za-z_][A-Za-z0-9_.-]*)$/);
              emit(`route ${pair ? `${pair[1]} -> ${pair[2]}` : id(target, rp)}`, rp); routing(rule, rp);
            } else if (key === 'place') {
              keys(rule, ['at', 'size'], rp);
              emit(`place ${id(target, rp)} at ${placementPoint(rule.at, child(rp, 'at'))}${own(rule, 'size') ? ` size ${point(rule.size, child(rp, 'size'))}` : ''}`, rp);
            } else {
              emit(`style ${id(target, rp)} {`, rp); attributes(rule, rp); emit('}', rp);
            }
          }
        } else if(key==='tree') {
          for(const [id,tree,tp]of entries(v,vp)) {emit(`tree ${id} {`,tp);for(const [option,a]of Object.entries(tree))if(option!=='id')field(option,a,child(tp,option));emit('}',tp);}
        } else if (key === 'routes') { emit('routes', vp); routing(v, vp); }
        else if (key === 'diagram') {
          if (typeof v === 'string') emit(`diagram ${id(v, vp)}`, vp);
          else {
            obj(v, vp); emit(`diagram ${id(v.type, child(vp, 'type'))} {`, vp);
            for (const [option, a] of Object.entries(v)) if (option !== 'type') field(option, a, child(vp, option));
            emit('}', vp);
          }
        } else if (['include', 'exclude'].includes(key)) {
          const values = Array.isArray(v) ? v : [v];
          if (!values.length) error('Expected a nonempty identifier list', vp);
          emit(`${key} ${values.map((a, i) => id(a, Array.isArray(v) ? child(vp, i) : vp)).join(', ')}`, vp);
        } else if (['direction', 'theme', 'viewpoint', 'referenceDisplay', 'referenceOccurrences'].includes(key)) emit(`${key} ${id(v, vp)}`, vp);
        else field(key, v, vp);
      }
      emit('}', p);
    }
  };
  obj(document, '');
  if (own(document, '@help')) {
    keys(document, ['@help'], '');
    help(document['@help'], '/@help');
  } else {
    keys(document, ['architecture'], ''); const a = obj(document.architecture, '/architecture');
    keys(a, ['name', 'description', 'config', 'model', 'views', '@help', '@meta'], '/architecture');
    emit(`architecture ${text(a.name, '/architecture/name')} {`, '/architecture');
    if (own(a, 'description')) emit(`description ${text(a.description, '/architecture/description')}`, '/architecture/description');
    if (own(a, 'config')) config(a.config, '/architecture/config');
    if (own(a, '@help')) {
      help(a['@help'], '/architecture/@help');
    }
    if (own(a, 'model')) { emit('model {', '/architecture/model'); model(a.model, '/architecture/model'); emit('}', '/architecture/model'); }
    if (own(a, 'views')) views(a.views, '/architecture/views');
    if (own(a, '@meta')) {
      const format=a['@meta'];
      if(!['json','dsl'].includes(format))error('meta must be json or dsl','/architecture/@meta');
      emit(`@meta ${format}`,'/architecture/@meta');
    }
    emit('}', '/architecture');
  }
  return {source: lines.join('\n'), origin: line => origins[line - 1] ?? {path: ''}};
}
