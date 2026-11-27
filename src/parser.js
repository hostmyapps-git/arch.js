import { ArchError, errorDiagnostic } from './errors.js';
import { rememberDiagnosticProfile } from './diagnostic-help.js';
import { tokenize } from './lexer.js';
import { parseHelpCommand, helpDocument } from './help-syntax.js';
import { jsonToDSL, isJSONDocument } from './json.js';
import { metaCommand } from './meta-syntax.js';
import { placementAlignmentError, placementAlignments, placementCoordinate } from './placement.js';
import { STYLE_NUMBERS, styleNumber } from './style-expressions.js';
import { TEMPLATES, EDGE_STYLES, NODE_PROPERTIES, EDGE_PROPERTIES, resolveProfile } from './profiles.js';
import { validateModel, validatePreviewModel } from './model-validation.js';
import { diagramOptionName } from './diagrams.js';
import { checkPresentationMode } from './view-selection.js';
import { matchingBraces, resumeAt, recoveryDiagnostic, omitInvalidTypes, pruneDroppedDeclarations, rememberSyntaxDiagnostics, checkSyntaxRecovery, startsMember, enablePreviewRecovery } from './syntax-recovery.js';

export { ArchError };
export const TYPES = TEMPLATES;
export const EDGE_TYPES = EDGE_STYLES;
const dict = () => Object.create(null);
const fail = (message, loc, code = 'ARCH_VALIDATION') => { throw new ArchError(message, loc, code); };

export function parseDocument(source) {
  if (source === null || !['string', 'object'].includes(typeof source)) fail('Source must be a string or a JSON architecture object');
  if (typeof source !== 'string' || /^[\s\uFEFF]*[\[{]/.test(source)) {
    const translated = jsonToDSL(source);
    let model;
    try { model = parseDSLDocument(translated.source); }
    catch (error) {
      if (!(error instanceof ArchError)) throw error;
      const message = error.message.replace(/ \(line \d+, column \d+\)$/, '');
      throw new ArchError(message, {...translated.origin(error.line), help:error.help}, error.code);
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

function parseDSLDocument(source, recovery) {
  if (typeof source !== 'string') fail('Source must be a string');
  if (source.length > 2_000_000) fail('Source exceeds 2 MB');
  const tokens = tokenize(source, Boolean(recovery));
  const pairs = recovery && matchingBraces(tokens);
  let cursor = 0;
  let member;
  const peek = () => tokens[cursor];
  const is = (value) => peek().value === value;
  const take = () => tokens[cursor++];
  const checkValue = () => {
    const token = peek();
    if (token.type === 'invalid') fail(token.value, token, 'ARCH_SYNTAX');
    // A missing value must not consume the keyword of the next statement.
    // Strict parsing runs first, so legitimate multiline syntax is preserved.
    if (member && (token.separator || token.line > member.first.line && token.column <= member.first.column) &&
      token !== member.first &&
      startsMember(tokens, cursor, member.scope, true))
      fail('Incomplete statement before ' + token.value, token, 'ARCH_SYNTAX');
  };
  const expect = (value) => {
    if (recovery) checkValue();
    if (!is(value)) fail(`Expected: ${value}; found: ${peek().value || 'end of input'}`, peek(), 'ARCH_SYNTAX');
    return take();
  };
  const typed = (type, label = type) => {
    if (recovery) checkValue();
    if (peek().type !== type) fail(`Expected: ${label}; found: ${peek().value || 'end of input'}`, peek(), 'ARCH_SYNTAX');
    return take();
  };
  const word = () => typed('word', 'identifier').value;
  const text = () => {
    if (recovery) checkValue();
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
  const nameList = (fn = word) => {
    const bracketed = is('['), result = [];
    if (bracketed) take();
    if (!bracketed || !is(']')) {
      result.push(fn());
      while (is(',')) {
        take(); result.push(fn());
        if (result.length > 4000) fail('At most 4000 list entries are allowed', peek());
      }
    }
    if (bracketed) expect(']');
    return result;
  };
  const paddingValue = () => tokens[cursor + 1]?.type === ',' ? nameList(scalar) : scalar();
  const block = (fn, scope, parent) => {
    expect('{');
    const enclosing = member;
    member = undefined;
    while (!is('}')) {
      if (peek().type === 'eof') {
        if (!recovery || !scope) fail('Unclosed block; expected: }', peek(), 'ARCH_SYNTAX');
        const {line, column} = peek();
        recovery.diagnostics.push({severity:'error', code:'ARCH_SYNTAX', message:`Unclosed ${scope} block; expected: }`, line, column});
        member = enclosing;
        return;
      }
      if (!recovery || !scope) { fn(); continue; }
      const start = cursor;
      const first = peek(), nodeCount = model.nodes.length, edgeCount = model.edges.length;
      try {
        member = {first, scope};
        fn();
      } catch (error) {
        if (!(error instanceof ArchError) || !error.line || error.code === 'ARCH_HELP' ||
          scope === 'architecture' && first.value === 'config') throw error;
        cursor = resumeAt(tokens, start, scope, parent, pairs);
        recovery.diagnostics.push(recoveryDiagnostic(error, first, peek(), scope));
        if (scope === 'model' || scope === 'container') {
          for (const node of model.nodes.splice(nodeCount)) recovery.droppedNodes.add(node.id);
          for (const edge of model.edges.splice(edgeCount)) recovery.droppedEdges.add(edge.id);
          const id = tokens[start+1];
          if (first.type === 'word' && id.type === 'word' && id.line === first.line &&
            (scope === 'model' || startsMember(tokens, start, scope)))
            (first.value === 'relation' ? recovery.droppedEdges : recovery.droppedNodes).add(id.value);
        }
        if (scope === 'architecture' && first.value === 'view' && tokens[start+1].type === 'word' &&
          tokens[start+1].line === first.line) recovery.droppedViews.add(tokens[start+1].value);
      } finally {
        member = undefined;
      }
    }
    expect('}');
    member = enclosing;
  };
  const property = (object, allowed) => {
    const key = typed('word');
    if (!allowed.includes(key.value)) fail(`Unknown attribute: ${key.value}`, key);
    if (Object.hasOwn(object, key.value)) fail(`Duplicate attribute: ${key.value}`, key);
    if (STYLE_NUMBERS.includes(key.value)) {
      const loc=peek();
      if(loc.type==='string'){object[key.value]=styleNumber(take().value,loc);return;}
      const parts=[];let depth=0;
      while(peek().type!=='eof'&&!is('}')) {
        const token=peek();
        if(!depth&&parts.length&&token.type==='word'&&!token.value.includes('.'))break;
        if(!['word','number','+','-','*','/','(',')'].includes(token.type))break;
        if(token.type==='(')depth++;else if(token.type===')')depth--;
        parts.push(String(take().value));if(parts.length>128)fail('Style expression is too long',loc);
      }
      object[key.value]=styleNumber(parts.join(' '),loc);return;
    }
    if (key.value === 'propertyFields') { object.propertyFields = nameList(text); return; }
    if (key.value === 'backgroundImage') { object.backgroundImage = typed('string').value; return; }
    if (['showBackgroundImage', 'showIcon', 'showLabel', 'showStereotype', 'showDescription', 'showTechnology'].includes(key.value)) { object[key.value] = scalar(); return; }
    object[key.value] = ['opacity', 'fontSize', 'width', 'height'].includes(key.value) ? typed('number').value : text();
  };
  const modelProperty = (object, builtins, relation = false) => {
    const key = typed('word');
    const builtin = builtins.includes(key.value) || relation && key.value === 'type';
    if (Object.hasOwn(object.attributes ?? {}, key.value) || builtin && Object.hasOwn(object, key.value))
      fail(`Duplicate attribute: ${key.value}`, key);
    const value = !relation && key.value === 'backgroundImage' ? typed('string').value :
      builtin ? key.value === 'opacity' ? typed('number').value : text() : scalar();
    const attributes = object.attributes ??= dict();
    (object.attributeLocs ??= dict())[key.value] = key;
    (builtin ? object : attributes)[key.value] = value;
  };
  if (peek().type === 'directive') {
    const directive = take();
    if (/^@meta\b/.test(directive.value)) fail('@meta requires architecture source; place @meta json or @meta dsl inside an architecture or view',directive,'ARCH_META');
    typed('eof', 'end of input');
    return helpDocument(parseHelpCommand(directive.value));
  }
  const architecture = expect('architecture');
  const model = { title: typed('string', 'architecture title').value, description: '', nodes: [], edges: [], views: [] };
  let hasModel = false, hasDescription = false;
  const containerBody = node => {
    const close = pairs.get(cursor);
    // A block that appears to consume its enclosing } has no reliable local
    // boundary. Let model-level recovery preserve the next sibling instead.
    if (close === undefined || tokens[close].line > node.loc.line && tokens[close].column < node.loc.column) return false;
    if (node.type === 'package') return true;
    for (let i = cursor + 1; i < close; i++) {
      if (startsMember(tokens, i, 'container', true)) return true;
      if (tokens[i].type === '{') i = pairs.get(i) ?? i;
    }
    return false;
  };
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
    if (is('{')) {
      const recoverChildren = recovery && containerBody(node);
      block(() => {
        const type = tokens[cursor + 2]?.type;
        const declaration = peek().type === 'word' && tokens[cursor + 1]?.type === 'word' &&
          (type === 'string' || recoverChildren && type === 'invalid' && tokens[cursor + 2].line === peek().line);
        if (is('relation') || declaration) element(node.id, depth + 1);
        else modelProperty(node, NODE_PROPERTIES);
      }, recoverChildren ? 'container' : undefined, token);
    }
  };
  const routingFraction = () => {
    const numerator = typed('number', 'position from 0 to 1 or a fraction such as 1/2');
    let value = numerator.value;
    if (is('/')) {
      take(); const denominator = typed('number', 'fraction denominator');
      if (denominator.value === 0) fail('Port/attachment position cannot divide by zero', denominator);
      value /= denominator.value;
    }
    if (!Number.isFinite(value) || value < 0 || value > 1) fail('Port/attachment position must be between 0 and 1', numerator);
    return value;
  };
  const startsRouteExpression = token => ['number', 'string', '(', '+', '-'].includes(token.type) ||
    token.type === 'word' && token.value.includes('.');
  const coordinateExpression = (kind = 'Routing') => {
    const loc=peek();if(loc.type==='string')return placementCoordinate(take().value,loc);
    const parts=[];let depth=0;
    while(peek().type!=='eof'&&!is('}')) {
      const token=peek();if(!depth&&token.type==='word'&&!token.value.includes('.'))break;
      if(!['word','number','+','-','*','/','(',')'].includes(token.type))break;
      if(token.type==='(')depth++;else if(token.type===')')depth--;
      parts.push(String(take().value));if(parts.length>128)fail(`${kind} expression is too long`,loc);
    }
    return placementCoordinate(parts.join(' '),loc);
  };
  const readRelativePlacement = () => {
    const token = typed('word', 'at or placement side (right, top, left, bottom)');
    const side = token.value, allowed = placementAlignments(side);
    if (!allowed) fail(`Expected: at, right, top, left or bottom; found: ${side}`, token, 'ARCH_SYNTAX');
    expect('of');
    const relative = {side, of:word()};
    while (is('gap') || is('align')) {
      const option = take();
      if (Object.hasOwn(relative, option.value)) fail(`Duplicate relative placement option: ${option.value}`, option, 'ARCH_SYNTAX');
      if (option.value === 'gap') relative.gap = coordinateExpression('Placement gap');
      else {
        const alignment = typed('word', `alignment (${allowed.join(', ')} or to ID.FIELD)`);
        const target = alignment.value === 'to' ? typed('word','alignment reference ID.FIELD') : alignment;
        const align = target === alignment ? alignment.value : {to:target.value};
        const invalid = placementAlignmentError(side, align);
        if (invalid) fail(invalid, target, 'ARCH_SYNTAX');
        relative.align = align;
      }
    }
    return relative;
  };
  const readRouting = (item, reference = false, defaults = false) => block(() => {
    const attr = typed('word');
    const allowed = ['from', 'to', 'via', 'curve', 'path', 'label', 'sideOffset', ...(!reference ? ['icon', 'iconPosition', 'showIcon', 'showLabel', 'showStereotype', 'sharePath'] : []),
      ...(!reference && !defaults ? ['source', 'target'] : []), ...(!reference ? ['crossings','crossingRadius','avoidObstacles'] : []), 'color', 'width', 'dasharray'];
    if (!allowed.includes(attr.value)) fail(`Unknown routing attribute: ${attr.value}`, attr);
    if (Object.hasOwn(item, attr.value)) fail(`Duplicate routing attribute: ${attr.value}`, attr);
    if (['showIcon', 'showLabel', 'showStereotype', 'avoidObstacles'].includes(attr.value)) item[attr.value] = scalar();
    else if (['source', 'target'].includes(attr.value)) item[attr.value] = text();
    else if (attr.value === 'width') item.width = typed('number', 'route width').value;
    else if (attr.value === 'crossingRadius') item.crossingRadius = typed('number', 'crossing radius').value;
    else if (attr.value === 'dasharray') {
      item.dasharray = peek().type === 'number' && tokens[cursor + 1]?.type === ','
        ? nameList(() => typed('number', 'numeric dasharray length').value)
        : scalar();
    }
    else if (attr.value === 'via') {
      const bracketed = peek().type === '[';
      if (bracketed) take();
      item.via = list(placementPoint);
      if (bracketed) expect(']');
    }
    else if (attr.value === 'sideOffset') item.sideOffset = coordinateExpression();
    else if (attr.value === 'to' && reference) {
      const start = peek();
      if (!startsRouteExpression(start)) fail('Expected position along the relationship (a number, fraction, or expression from 0 to 1)', start, 'ARCH_SYNTAX');
      item.to = coordinateExpression();
      if (typeof item.to === 'number' && (item.to < 0 || item.to > 1))
        fail('Reference route to must be between 0 and 1', start);
    }
    else if (attr.value === 'to' && defaults && peek().type === 'number') item.to = routingFraction();
    else if (attr.value === 'label') {
      if (is('none')) { take(); item.label = 'none'; }
      else if(is('('))item.label=placementPoint();
      else {
        const position = routingFraction();
        item.label = position;
        if (is('offset') || is('sideOffset')) {
          const label = {position};
          while (is('offset') || is('sideOffset')) {
            const field = take();
            if (Object.hasOwn(label,field.value)) fail(`Duplicate label option: ${field.value}`,field);
            label[field.value] = coordinateExpression();
          }
          item.label = label;
        }
      }
    }
    else if (['from', 'to'].includes(attr.value)) {
      if (is('(')) item[attr.value] = placementPoint();
      else {
        const side = text();
        const start = peek();
        if (startsRouteExpression(start)) {
          const position = coordinateExpression();
          if (typeof position === 'number' && (position < 0 || position > 1)) fail('Port position must be between 0 and 1', start);
          item[attr.value] = {side, position};
        } else item[attr.value] = side;
      }
    }
    else item[attr.value] = text();
  });
  const readView = () => {
    const token = expect('view');
    const view = { id: word(), title: typed('string', 'view title').value,
      places: dict(), styles: dict(), routes: dict(), loc: token };
    const seen = new Set();
    const virtualID = () => typed(peek().type==='string'?'string':'word','virtual point ID').value;
    const virtualPoint = loc => {
      expect('virtual');
      const result={id:virtualID(),loc};
      if (peek().type==='string') result.title=take().value;
      return result;
    };
    block(() => {
      if (peek().type === 'directive') {
        const directive=take();
        if(!/^@meta\b/.test(directive.value))fail('Only @meta directives are allowed inside a view',directive,'ARCH_META');
        if(seen.has('meta'))fail('Only one meta directive is allowed per view',directive,'ARCH_META');
        view.meta=metaCommand(directive.value,directive);seen.add('meta');return;
      }
      const key = typed('word');
      if(key.value==='embed') {
        const source=word(),id=is('as')?(take(),word()):source;if(Object.hasOwn(view.embeds??{},id))fail(`Duplicate embed ID: ${id}`,key);
        const spec={view:source,loc:key};if(is('{'))block(()=>{const option=typed('word');if(option.value!=='frame'||Object.hasOwn(spec,'frame'))fail('embed accepts frame true or false',option);spec.frame=scalar();});(view.embeds??=dict())[id]=spec;
      } else if(key.value==='tree') {
        const id = word();
        if (Object.hasOwn(view.trees ?? {}, id)) fail(`Duplicate tree group: ${id}`, key);
        const tree = {loc:key};
        block(() => {
          const option = typed('word'), name = option.value;
          if (Object.hasOwn(tree, name)) fail(`Duplicate tree option: ${name}`, option);
          if (name === 'nodes') tree.nodes = nameList(text);
          else if (name === 'padding') tree.padding = paddingValue();
          else tree[name] = scalar();
        });
        (view.trees ??= dict())[id] = tree;
      } else if (key.value === 'route' && peek().type === 'word' && tokens[cursor + 1]?.type === '->') {
        const nodeId = word(); expect('->'); const edgeId = word();
        if (view.referenceRoutes?.some(route => route.nodeId === nodeId && route.edgeId === edgeId))
          fail(`Duplicate reference route: ${nodeId} -> ${edgeId}`, key);
        const route = {nodeId, edgeId, loc: key};
        readRouting(route, true); (view.referenceRoutes ??= []).push(route);
      } else if (key.value === 'style') {
        const targets = nameList();
        if (!targets.length) fail('style requires at least one target ID', key, 'ARCH_SYNTAX');
        const item = { loc: key };
        block(() => property(item, ['template', 'accent', 'icon', 'iconPosition', 'backgroundColor', 'backgroundImage', 'showBackgroundImage', 'opacity', 'display', 'fontSize', 'width', 'height', 'showIcon', 'showLabel', 'showStereotype', 'showDescription', 'showTechnology','propertyFields']));
        // Use the same per-ID, per-property precedence as inherited styles.
        for (const id of targets) Object.assign(view.styles[id] ??= {}, item);
      } else if (key.value==='route' && peek().type==='word' && is('virtual') && tokens[cursor+2]?.type==='{') {
        take(); const id=virtualID();
        if (Object.hasOwn(view.virtualRoutes??{},id)) fail(`Duplicate virtual route: ${id}`,key);
        const route={loc:key};
        readRouting(route);
        (view.virtualRoutes ??= dict())[id]=route;
      } else if (key.value === 'route') {
        const targets = nameList();
        if (!targets.length) fail('route requires at least one relationship ID', key, 'ARCH_SYNTAX');
        const item = { loc: key };
        readRouting(item);
        // Expand each block into per-relationship overrides in source order.
        for (const id of targets) Object.assign(view.routes[id] ??= {}, item);
      } else if (key.value === 'row' || key.value === 'column') {
        const ids = nameList(), side = key.value === 'row' ? 'right' : 'bottom';
        if (ids.length < 2 || new Set(ids).size !== ids.length) fail(`${key.value} requires at least two distinct IDs`, key);
        const options = {};
        if (is('{')) block(() => {
          const option = typed('word');
          if (!['gap','align'].includes(option.value) || Object.hasOwn(options, option.value))
            fail('Expected a single gap or align option',option);
          options[option.value] = option.value === 'gap' ? coordinateExpression() : word();
          if (option.value === 'align') {
            const invalid = placementAlignmentError(side,options.align);
            if (invalid) fail(invalid,option);
          }
        });
        const targets = ids.slice(1);
        const conflict = targets.find(id => Object.hasOwn(view.places,id));
        if (conflict) fail(`Duplicate place-statement: ${conflict}`,key);
        for (const [index,id] of targets.entries()) {
          view.places[id] = {loc:key,relative:{side,of:ids[index],...options}};
        }
      } else if (key.value === 'place') {
        const form = tokens[cursor+2]?.value;
        const virtual = peek().type === 'word' && is('virtual') && (form === 'at' || placementAlignments(form));
        if (virtual) take();
        const id = virtual ? virtualID() : word();
        const places = virtual ? (view.virtualPlaces ??= dict()) : view.places;
        if (Object.hasOwn(places, id)) fail(`Duplicate ${virtual ? 'virtual placement' : 'place-statement'}: ${id}`, key);
        const item = {loc:key};
        if (is('at')) { take(); item.at = placementPoint(); }
        else item.relative = readRelativePlacement();
        if (!virtual && is('size')) { take(); item.size = point(); }
        places[id] = item;
      } else {
        if (seen.has(key.value)) fail(`Duplicate view option: ${key.value}`, key);
        if (key.value === 'extends') view.extends=word();
        else if (key.value === 'meta') view.meta = text();
        else if (key.value === 'diagram') {
          const diagram = { type: word() };
          if (is('{')) block(() => {
            const option = typed('word');
            const name = diagramOptionName(diagram.type,option.value);
            const state=diagram.type==='state';
            const arrow=tokens[cursor+(tokens[cursor+2]?.type==='string'?3:2)]?.type==='->';
            if (state && name==='initial' && peek().type==='word' && is('virtual') && arrow) {
              if (diagram.initial!==undefined || diagram.virtualInitial) fail('Duplicate diagram option: initial',option);
              const spec=virtualPoint(option); expect('->'); spec.target=word();
              diagram.virtualInitial=spec;
              return;
            }
            if (state && name==='final' && peek().type==='word' && tokens[cursor+1]?.type==='->') {
              const source=word(); expect('->');
              const spec=virtualPoint(option); spec.source=source;
              if (is('{')) block(() => {
                const field=typed('word');
                if (field.value!=='event' || spec.event!==undefined) fail('A virtual final accepts one event ID',field);
                spec.event=word();
              });
              (diagram.virtualFinal ??= []).push(spec);
              return;
            }
            if (state && ['virtualInitial','virtualFinal'].includes(name)) fail('Use initial or final with the virtual keyword',option);
            if (name==='initial' && diagram.virtualInitial) fail('Duplicate diagram option: initial',option);
            if (Object.hasOwn(diagram,name)) fail(`Duplicate diagram option: ${name}`,option);
            if (['propertyFields','final','viewpoints'].includes(name)) diagram[name] = nameList(text);
            else if (diagram.type === 'tree' && name === 'padding') diagram.padding = paddingValue();
            else diagram[name] = scalar();
          });
          view.diagram = diagram;
        }
        else if (key.value === 'routes') {
          const defaults = {loc: key};
          readRouting(defaults, false, true);
          view.routeDefaults = defaults;
        }
        else if (['include', 'exclude'].includes(key.value)) view[key.value] = nameList();
        else if (key.value === 'spacing') view.spacing = typed('number').value;
        else if (key.value === 'backgroundImage') view.backgroundImage = typed('string').value;
        else if (key.value === 'showBackgroundImage') view.showBackgroundImage = scalar();
        else if (key.value === 'propertyFields') view.propertyFields=nameList(text);
        else if (['direction', 'theme', 'viewpoint', 'represents', 'referenceDisplay', 'referenceOccurrences'].includes(key.value)) view[key.value] = word();
        else fail(`Unknown view option: ${key.value}`, key);
        seen.add(key.value);
      }
    }, 'view', token);
    view._explicit=[...seen];view.direction ??= 'right'; view.theme ??= 'light'; view.spacing ??= 80;
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
            const scalarKeys = key.value === 'type' ? ['extends', 'template', 'container', 'abstract', 'icon', 'accent', 'backgroundColor', 'styleGroup'] : key.value === 'relation' ? ['extends', 'style', 'abstract', 'allowSelf', 'acyclic', 'activityFlow', 'stateTrigger', 'sequenceContext'] : key.value === 'styleGroup' ? ['backgroundColor'] : [];
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
        else if (key.value === 'views') {
          if (is('[')) config.views = scalar();
          else {
            const ids = nameList(scalar);
            config.views = ids.length === 1 ? ids[0] : ids;
          }
        }
        else if (key.value === 'validation') config.validation = text();
        else if (key.value === 'presentation') {
          const loc = peek();
          config.presentation = scalar();
          checkPresentationMode(config.presentation, loc);
        }
        else if (['showValidation','showRouteStereotypes'].includes(key.value)) config[key.value]=scalar();
        else if (key.value === 'syntaxRecovery') {
          config.syntaxRecovery = scalar();
          checkSyntaxRecovery(config.syntaxRecovery, key);
        }
        else if (['id', 'title', 'version', 'extends', 'defaultRelation', 'requireViewpoint'].includes(key.value)) definition[key.value] = scalar();
        else fail(`Unknown config option: ${key.value}`, key);
      }
    });
    const hasDefinition = Object.keys(definition.nodeTypes).length || Object.keys(definition.relationTypes).length || Object.keys(definition.viewpoints).length || Object.keys(definition.styleGroups).length || definition.extends;
    const runtimeOnly = [...seen].every(key => ['profile', 'views', 'presentation', 'validation', 'showValidation', 'syntaxRecovery', 'showRouteStereotypes'].includes(key));
    if (config.profile && (hasDefinition || !runtimeOnly)) fail('Choose either config profile or an inline profile definition', loc);
    if (config.profile || !hasDefinition && runtimeOnly && ['views','presentation','syntaxRecovery','showRouteStereotypes'].some(key => seen.has(key))) delete config.definition;
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
      const parent = take(); block(() => element(), 'model', parent); hasModel = true;
    } else if (is('view')) readView();
    else if (is('config')) readConfig();
    else fail('Expected: model, view, config, description, @help or @meta', peek(), 'ARCH_SYNTAX');
  }, 'architecture', architecture);
  typed('eof', 'end of input');
  if (model.help) return { ...model, ...helpDocument(model.help), title: model.title, config: model.config };
  if (!hasModel) fail('Missing model block');
  if (model.nodes.length > 1000 || model.edges.length > 4000) fail('At most 1000 elements and 4000 relationships are allowed');
  if (!model.views.length) model.views.push({ id: 'default', title: model.title,
    direction: 'right', theme: 'light', spacing: 80, places: dict(), styles: dict(), routes: dict() });
  return model;
}

// Bind source semantics before validation. A parsed model retains its profile
// snapshot and default edge type, even if the caller later registers a revision.
function bindModel(model, options) {
  model.profile = resolveProfile(model, options);
  if (options.validation !== undefined) model.validation = options.validation;
  for (const edge of model.edges) if (edge.type === undefined && model.profile.defaultRelation !== null) edge.type = model.profile.defaultRelation;
  return model;
}

export function bindSourceModel(source, options) {
  return bindModel(parseDocument(source), options);
}

export function bindPreviewModel(source, options, defaultRecovery = false) {
  checkSyntaxRecovery(options.syntaxRecovery);
  const dsl = typeof source === 'string' && !/^\s*[\[{]/.test(source);
  const enabled = model => options.syntaxRecovery ?? model.config?.syntaxRecovery ?? defaultRecovery;
  let recovery;
  let model;
  try {
    model = parseDocument(source);
  } catch (error) {
    if (!(error instanceof ArchError) || !error.line || options.syntaxRecovery === false || !dsl) throw error;
    recovery = {diagnostics:[], droppedNodes:new Set(), droppedEdges:new Set(), droppedViews:new Set()};
    try { model = parseDSLDocument(source, recovery); }
    catch (recoveryError) {
      if (!(recoveryError instanceof ArchError)) throw recoveryError;
      throw error;
    }
    if (!recovery.diagnostics.length || !enabled(model) || model.kind === 'help') throw error;
  }
  model = bindModel(model, options);
  if (dsl && enabled(model) && model.kind !== 'help') {
    enablePreviewRecovery(model);
    recovery ??= {diagnostics:[], droppedNodes:new Set(), droppedEdges:new Set(), droppedViews:new Set()};
    omitInvalidTypes(model, recovery);
  }
  if (recovery?.diagnostics.length) {
    pruneDroppedDeclarations(model, recovery);
    recovery.diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
    rememberSyntaxDiagnostics(model, recovery);
  }
  return model;
}

export function parsePreview(source, options = {}) {
  const model = bindPreviewModel(source, options, true);
  validatePreviewModel(model, options, model.profile);
  return model;
}

export function parse(source, options = {}) {
  const model = bindSourceModel(source, options);
  validateModel(model, options, model.profile);
  return model;
}

export function validate(sourceOrModel, options = {}) {
  let model, profile;
  try {
    model = typeof sourceOrModel === 'string' || isJSONDocument(sourceOrModel) ? parseDocument(sourceOrModel) : sourceOrModel;
    if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views))
      throw new ArchError('Invalid model; use parse(source)', {}, 'ARCH_VALIDATION');
    profile = resolveProfile(model, options);
    const { diagnostics } = validateModel(model, options, profile);
    return rememberDiagnosticProfile({ valid: true, profile: { id: profile.id, version: profile.version }, diagnostics, ...(diagnostics.some(d=>d.code!=='ARCH_MAPPING_REVIEW')?{conformant:false}:{}),...(diagnostics.some(d=>d.code==='ARCH_MAPPING_REVIEW')?{reviewRequired:true}:{}) }, profile);
  } catch (error) {
    if (!(error instanceof ArchError)) throw error;
    return rememberDiagnosticProfile({ valid: false, profile: profile ? { id: profile.id, version: profile.version } : null,
      diagnostics: error.diagnostics ?? [errorDiagnostic(error)] }, profile);
  }
}
