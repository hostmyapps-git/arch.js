import { ArchError, validateModel } from './parser.js';
import { resolveProfile, visibleNodeIds } from './profiles.js';
import { layoutDiagram } from './diagrams.js';

export const num = (n) => String(Math.round(n * 1000) / 1000);
const pt = (p) => `${num(p.x)} ${num(p.y)}`;
const fail = (message, loc) => { throw new ArchError(message, loc, 'ARCH_VALIDATION'); };

// Validate path command arity and retain conservative bounds (control-point hulls).
// Arc bounds deliberately overestimate using corrected ellipse radii.
export function inspectPath(path, loc) {
  if (typeof path !== 'string' || !path.trim() || path.length > 100_000) fail('Ungültiger SVG-Pfad', loc);
  const pattern = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
  const tokens = path.match(pattern) ?? [];
  if (path.replace(pattern, '').replace(/[\s,]/g, '') || !/^[Mm]$/.test(tokens[0] ?? '')) fail('SVG-Pfad muss mit M beginnen und gültige Pfaddaten enthalten', loc);
  const arities = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  const points = [];
  let index = 0, command, current = { x: 0, y: 0 }, start = current, previousControl = null, previousCommand = '';
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    else if (!command) fail('Fehlender SVG-Pfadbefehl', loc);
    const upper = command.toUpperCase(), relative = command !== upper;
    if (upper === 'Z') {
      current = start; points.push(current); previousControl = null; previousCommand = upper; command = null; continue;
    }
    const count = arities[upper], args = tokens.slice(index, index + count).map(Number);
    if (args.length !== count || args.some(n => !Number.isFinite(n) || Math.abs(n) > 1e7)) fail('Ungültige Anzahl oder Größe von SVG-Pfadparametern', loc);
    index += count;
    const origin = current;
    const pair = (offset) => ({ x: args[offset] + (relative ? origin.x : 0), y: args[offset + 1] + (relative ? origin.y : 0) });
    if (upper === 'H') current = { x: args[0] + (relative ? origin.x : 0), y: origin.y };
    else if (upper === 'V') current = { x: origin.x, y: args[0] + (relative ? origin.y : 0) };
    else if (upper === 'A') {
      if (args[0] < 0 || args[1] < 0 || ![0, 1].includes(args[3]) || ![0, 1].includes(args[4])) fail('Ungültige SVG-Bogenparameter', loc);
      current = pair(5);
      // SVG endpoint-to-center radius correction, including rotated ellipses.
      // Every point is within two corrected maximum radii of an endpoint.
      const angle = args[2] * Math.PI / 180;
      const dx = (origin.x - current.x) / 2, dy = (origin.y - current.y) / 2;
      const xp = Math.cos(angle) * dx + Math.sin(angle) * dy;
      const yp = -Math.sin(angle) * dx + Math.cos(angle) * dy;
      const correction = args[0] && args[1] ? Math.max(1, Math.hypot(xp / args[0], yp / args[1])) : 0;
      const radius = correction * Math.max(args[0], args[1]) * 2;
      if (!Number.isFinite(radius) || radius > 1e10) fail('SVG-Bogen überschreitet den unterstützten Koordinatenbereich', loc);
      for (const p of [origin, current]) points.push({ x: p.x - radius, y: p.y - radius }, { x: p.x + radius, y: p.y + radius });
    } else {
      for (let j = 0; j < count; j += 2) points.push(pair(j));
      current = pair(count - 2);
      if ((upper === 'S' && ['C', 'S'].includes(previousCommand)) || (upper === 'T' && ['Q', 'T'].includes(previousCommand))) {
        if (previousControl) points.push({ x: origin.x * 2 - previousControl.x, y: origin.y * 2 - previousControl.y });
      }
    }
    if (upper === 'M') { start = current; command = relative ? 'l' : 'L'; }
    if (['C', 'S', 'Q'].includes(upper)) previousControl = pair(count - 4);
    else if (upper === 'T' && ['Q', 'T'].includes(previousCommand) && previousControl)
      previousControl = { x: origin.x * 2 - previousControl.x, y: origin.y * 2 - previousControl.y };
    else previousControl = null;
    previousCommand = upper;
    points.push(current);
  }
  return points;
}

function textLength(text) {
  return [...String(text)].reduce((sum, c) => sum + (/[MWmw@#%&]/.test(c) ? 1 : /[il.,' :!]/.test(c) ? 0.3 :
    c.codePointAt(0) > 0x2fff ? 1.15 : /[A-Z]/.test(c) ? 0.76 : c.codePointAt(0) > 0x2ff ? 0.9 : 0.62), 0);
}
export function wrap(text, width, fontSize = 13) {
  if (!text) return [];
  const result = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && textLength(`${line} ${word}`) * fontSize > width) { result.push(line); line = ''; }
      // Split unbroken identifiers so arbitrary labels never escape their card.
      for (const char of word) {
        if (textLength(line + char) * fontSize > width && line) { result.push(line); line = ''; }
        line += char;
      }
      line += ' ';
    }
    result.push(line.trimEnd());
  }
  return result.map(line => line.trim());
}

const intersects = (a, b, margin = 24) => a.x < b.x + b.width + margin && a.x + a.width + margin > b.x &&
  a.y < b.y + b.height + margin && a.y + a.height + margin > b.y;

function arrange(items, edges, direction, spacing, places, nodesById) {
  if (!items.length) return;
  const itemIds = new Set(items.map(n => n.id)), incoming = new Map(items.map(n => [n.id, new Set()]));
  const outgoing = new Map(items.map(n => [n.id, new Set()]));
  const representative = (id) => {
    let node = nodesById.get(id);
    while (node && !itemIds.has(node.id)) node = nodesById.get(node.parent);
    return node?.id;
  };
  for (const edge of edges) {
    const a = representative(edge.source), b = representative(edge.target);
    if (a && b && a !== b) { incoming.get(b).add(a); outgoing.get(a).add(b); }
  }
  const remaining = new Set(itemIds), ranks = new Map(items.map(n => [n.id, 0]));
  while (remaining.size) {
    const ready = [...remaining].filter(id => [...incoming.get(id)].every(a => !remaining.has(a)));
    // A deterministic cycle break; only propagate to still-unprocessed nodes.
    for (const id of ready.length ? ready : [remaining.values().next().value]) {
      remaining.delete(id);
      for (const target of outgoing.get(id)) if (remaining.has(target)) ranks.set(target, Math.max(ranks.get(target), ranks.get(id) + 1));
    }
  }
  const down = direction === 'down', primarySize = down ? 'height' : 'width', secondarySize = down ? 'width' : 'height';
  const rankWidths = new Map();
  for (const item of items) rankWidths.set(ranks.get(item.id), Math.max(rankWidths.get(ranks.get(item.id)) ?? 0, item[primarySize]));
  const offsets = new Map(); let offset = 0;
  for (const rank of [...rankWidths.keys()].sort((a, b) => a - b)) { offsets.set(rank, offset); offset += rankWidths.get(rank) + spacing; }
  const used = items.filter(n => places[n.id]).map(n => Object.assign(n, places[n.id].at));
  const stacks = new Map();
  for (const item of items) {
    if (places[item.id]) continue;
    const rank = ranks.get(item.id), primary = offsets.get(rank);
    let secondary = stacks.get(rank) ?? 0;
    const setPosition = () => { item.x = down ? secondary : primary; item.y = down ? primary : secondary; };
    setPosition();
    let collision;
    while ((collision = used.find(other => intersects(item, other)))) {
      secondary = (down ? collision.x + collision.width : collision.y + collision.height) + spacing / 2;
      setPosition();
    }
    stacks.set(rank, secondary + item[secondarySize] + spacing / 2);
    used.push(item);
  }
}

function port(box, side, other) {
  if (typeof side === 'object') return side;
  if (!side || side === 'auto') {
    const dx = other.x + other.width / 2 - box.x - box.width / 2;
    const dy = other.y + other.height / 2 - box.y - box.height / 2;
    side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  }
  return {
    left: { x: box.x, y: box.y + box.height / 2 },
    right: { x: box.x + box.width, y: box.y + box.height / 2 },
    top: { x: box.x + box.width / 2, y: box.y },
    bottom: { x: box.x + box.width / 2, y: box.y + box.height },
  }[side];
}

function polyPath(points, rounded) {
  let d = `M ${pt(points[0])}`;
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1], current = points[i], after = points[i + 1];
    if (!rounded || !after) { d += ` L ${pt(current)}`; continue; }
    const a = Math.hypot(current.x - before.x, current.y - before.y), b = Math.hypot(after.x - current.x, after.y - current.y);
    if (!a || !b) continue;
    const r = Math.min(10, a / 2, b / 2);
    const enter = { x: current.x + (before.x - current.x) * r / a, y: current.y + (before.y - current.y) * r / a };
    const leave = { x: current.x + (after.x - current.x) * r / b, y: current.y + (after.y - current.y) * r / b };
    d += ` L ${pt(enter)} Q ${pt(current)} ${pt(leave)}`;
  }
  return d;
}

function middle(points) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let left = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) {
      const ratio = lengths[i] ? left / lengths[i] : 0;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * ratio, y: points[i].y + (points[i + 1].y - points[i].y) * ratio };
    }
    left -= lengths[i];
  }
  return points[0];
}

function routeEdge(edge, source, target, route, parallel) {
  const curve = route.curve ?? 'orthogonal';
  let a = port(source, route.from, target), b = port(target, route.to, source), points = [a], d;
  if (route.path !== undefined) {
    const pathPoints = inspectPath(route.path, route.loc);
    return { ...edge, d: route.path, points: pathPoints, label: route.label ?? middle([a, b]) };
  }
  if (route.via) points.push(...route.via);
  else if (source.id === target.id) {
    a = port(source, route.from ?? 'right', target); b = port(target, route.to ?? 'top', source);
    const reach = 48 + parallel * 24;
    points = [a, { x: a.x + reach, y: a.y }, { x: a.x + reach, y: source.y - reach }, { x: b.x, y: source.y - reach }];
  } else if (curve !== 'straight') {
    const shift = parallel * 22;
    if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
      const x = (a.x + b.x) / 2 + shift;
      if (parallel && a.y === b.y) {
        const stub = Math.sign(b.x - a.x || 1) * 24;
        points.push({ x: a.x + stub, y: a.y }, { x: a.x + stub, y: a.y + shift },
          { x: b.x - stub, y: b.y + shift }, { x: b.x - stub, y: b.y });
      } else points.push({ x, y: a.y }, { x, y: b.y });
    } else {
      const y = (a.y + b.y) / 2 + shift;
      if (parallel && a.x === b.x) {
        const stub = Math.sign(b.y - a.y || 1) * 24;
        points.push({ x: a.x, y: a.y + stub }, { x: a.x + shift, y: a.y + stub },
          { x: b.x + shift, y: b.y - stub }, { x: b.x, y: b.y - stub });
      } else points.push({ x: a.x, y }, { x: b.x, y });
    }
  } else if (parallel) points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + parallel * 28 });
  points.push(b);
  if (route.via && ['orthogonal', 'rounded'].includes(curve)) {
    const orthogonal = [points[0]];
    for (const next of points.slice(1)) {
      const previous = orthogonal.at(-1);
      if (previous.x !== next.x && previous.y !== next.y) orthogonal.push({ x: next.x, y: previous.y });
      orthogonal.push(next);
    }
    points = orthogonal;
  }
  if (curve === 'bezier' && source.id !== target.id) {
    const controls = route.via ?? points.slice(1, 3);
    d = `M ${pt(a)} C ${pt(controls[0])} ${pt(controls[1])} ${pt(b)}`;
  } else d = polyPath(points, curve === 'rounded');
  let label = route.label ?? middle(points);
  if (!route.label && curve === 'bezier' && source.id !== target.id) {
    const controls = route.via ?? points.slice(1, 3);
    label = { x: (a.x + 3 * controls[0].x + 3 * controls[1].x + b.x) / 8,
      y: (a.y + 3 * controls[0].y + 3 * controls[1].y + b.y) / 8 };
  }
  return { ...edge, d, points, label };
}

export function layout(model, options = {}) {
  validateModel(model, options);
  const profile = resolveProfile(model, options);
  const view = options.view ? model.views.find(v => v.id === options.view) : model.views[0];
  if (!view) fail(`Unbekannte Ansicht: ${options.view}`);
  const visible = visibleNodeIds(model, view);
  const nodes = model.nodes.filter(n => visible.has(n.id)).map(n => {
    const definition = profile.nodeTypes[n.type], style = view.styles[n.id] ?? {};
    const template = style.template ?? definition.template;
    const width = view.places[n.id]?.size?.x ?? 220;
    const titleLines = wrap(n.title, width - 40, 15), descLines = wrap(n.description, width - 40, 12);
    const badgeLines = wrap(String(n.stereotype ?? n.type).toUpperCase(), width - 74, 9);
    const technologyLines = wrap(n.technology, width - 40, 10);
    const height = Math.max(view.places[n.id]?.size?.y ?? 0, 96,
      (template === 'database' ? 78 : 62) + (titleLines.length - 1) * 20 +
      Math.max(0, badgeLines.length - 1) * 12 +
      (descLines.length ? 25 + (descLines.length - 1) * 17 : 0) +
      (technologyLines.length ? 26 + (technologyLines.length - 1) * 13 : 0) + 22);
    return { ...n, icon: n.icon ?? definition.icon, accent: n.accent ?? definition.accent,
      backgroundColor: definition.backgroundColor ?? profile.styleGroups?.[definition.styleGroup]?.backgroundColor,
      ...style, container: definition.container, template, width, height, titleLines, badgeLines, descLines, technologyLines, x: 0, y: 0 };
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges = model.edges.filter(e => visible.has(e.source) && visible.has(e.target)).map(edge => {
    const type = edge.type ?? profile.defaultRelation;
    return { ...edge, type, style: profile.relationTypes[type].style };
  });
  if (view.diagram && view.diagram.type !== 'connected') return layoutDiagram(model, profile, view, nodes, edges);
  const process = (parent) => {
    const children = nodes.filter(n => n.parent === parent);
    for (const child of children) if (child.container) process(child.id);
    arrange(children, edges, view.direction, view.spacing, view.places, byId);
    if (parent) {
      const box = byId.get(parent);
      // Shift automatic children if necessary; explicit negative positions remain meaningful.
      const minX = Math.min(0, ...children.map(n => n.x)), minY = Math.min(0, ...children.map(n => n.y));
      box.width = Math.max(box.width, ...children.map(n => n.x + 28 - minX + n.width + 28));
      box.titleLines = wrap(box.title, box.width - 140, 14);
      box.headerHeight = Math.max(56, 28 + box.titleLines.length * 20);
      box.contentOffset = { x: 28 - minX, y: box.headerHeight + 16 - minY };
      box.width = Math.max(box.width, ...children.map(n => n.x + box.contentOffset.x + n.width + 28));
      box.height = Math.max(box.height, ...children.map(n => n.y + box.contentOffset.y + n.height + 28));
    }
  };
  process(null);
  const absolute = (parent, x, y) => {
    for (const node of nodes.filter(n => n.parent === parent)) {
      node.x += x; node.y += y;
      if (node.container) absolute(node.id, node.x + node.contentOffset.x, node.y + node.contentOffset.y);
    }
  };
  absolute(null, 0, 0);
  const parallel = new Map();
  const routedEdges = edges.map(edge => {
    const key = [edge.source, edge.target].sort().join('\0'), count = parallel.get(key) ?? 0;
    parallel.set(key, count + 1);
    const result = routeEdge(edge, byId.get(edge.source), byId.get(edge.target), view.routes[edge.id] ?? {}, count);
    result.labelLines = wrap(edge.title, 160, 11);
    result.labelWidth = Math.max(28, ...result.labelLines.map(line => textLength(line) * 11 + 18));
    result.labelHeight = result.labelLines.length * 15 + 8;
    return result;
  });
  const extents = nodes.flatMap(n => [{ x: n.x, y: n.y }, { x: n.x + n.width, y: n.y + n.height }]);
  for (const edge of routedEdges) {
    extents.push(...edge.points);
    if (edge.title) extents.push({ x: edge.label.x - edge.labelWidth / 2, y: edge.label.y - edge.labelHeight / 2 },
      { x: edge.label.x + edge.labelWidth / 2, y: edge.label.y + edge.labelHeight / 2 });
  }
  const minX = Math.min(0, ...extents.map(p => p.x)) - 48, minY = Math.min(0, ...extents.map(p => p.y)) - 48;
  const maxX = Math.max(160, ...extents.map(p => p.x)) + 48, maxY = Math.max(96, ...extents.map(p => p.y)) + 48;
  return { title: model.title, description: model.description, profile: { id: profile.id, version: profile.version }, view, nodes, edges: routedEdges,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}
