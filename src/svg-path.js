import { ArchError } from './errors.js';
import { num } from './svg-values.js';
import svgpath from 'svgpath';

export const pathPoint = p => `${num(p.x)} ${num(p.y)}`;
export const cubicPath = (start, first, second, end) =>
  `M ${pathPoint(start)} C ${pathPoint(first)} ${pathPoint(second)} ${pathPoint(end)}`;
const fail = (message, loc) => { throw new ArchError(message, loc, 'ARCH_VALIDATION'); };

// Validate path command arity and retain conservative bounds (control-point hulls).
// Arc bounds deliberately overestimate using corrected ellipse radii.
export function inspectPath(path, loc) {
  if (typeof path !== 'string' || !path.trim() || path.length > 100_000) fail('Invalid SVG path', loc);
  const pattern = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
  const tokens = path.match(pattern) ?? [];
  if (path.replace(pattern, '').replace(/[\s,]/g, '') || !/^[Mm]$/.test(tokens[0] ?? '')) fail('SVG path must start with M and contain valid path data', loc);
  const arities = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  const points = [];
  let index = 0, command, current = { x: 0, y: 0 }, start = current, previousControl = null, previousCommand = '';
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    else if (!command) fail('Missing SVG path command', loc);
    const upper = command.toUpperCase(), relative = command !== upper;
    if (upper === 'Z') {
      current = start; points.push(current); previousControl = null; previousCommand = upper; command = null; continue;
    }
    const count = arities[upper], args = tokens.slice(index, index + count).map(Number);
    if (args.length !== count || args.some(n => !Number.isFinite(n) || Math.abs(n) > 1e7)) fail('Invalid number or size of SVG path parameters', loc);
    index += count;
    const origin = current;
    const pair = (offset) => ({ x: args[offset] + (relative ? origin.x : 0), y: args[offset + 1] + (relative ? origin.y : 0) });
    if (upper === 'H') current = { x: args[0] + (relative ? origin.x : 0), y: origin.y };
    else if (upper === 'V') current = { x: origin.x, y: args[0] + (relative ? origin.y : 0) };
    else if (upper === 'A') {
      if (args[0] < 0 || args[1] < 0 || ![0, 1].includes(args[3]) || ![0, 1].includes(args[4])) fail('Invalid SVG arc parameters', loc);
      current = pair(5);
      // SVG endpoint-to-center radius correction, including rotated ellipses.
      // Every point is within two corrected maximum radii of an endpoint.
      const angle = args[2] * Math.PI / 180;
      const dx = (origin.x - current.x) / 2, dy = (origin.y - current.y) / 2;
      const xp = Math.cos(angle) * dx + Math.sin(angle) * dy;
      const yp = -Math.sin(angle) * dx + Math.cos(angle) * dy;
      const correction = args[0] && args[1] ? Math.max(1, Math.hypot(xp / args[0], yp / args[1])) : 0;
      const radius = correction * Math.max(args[0], args[1]) * 2;
      if (!Number.isFinite(radius) || radius > 1e10) fail('SVG arc exceeds the supported coordinate range', loc);
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

export function roundedCorner(before, corner, after) {
  const a = Math.hypot(corner.x - before.x, corner.y - before.y);
  const b = Math.hypot(after.x - corner.x, after.y - corner.y);
  if (!a || !b) return null;
  const radius = Math.min(10, a / 2, b / 2);
  return {
    enter: { x: corner.x + (before.x - corner.x) * radius / a, y: corner.y + (before.y - corner.y) * radius / a },
    leave: { x: corner.x + (after.x - corner.x) * radius / b, y: corner.y + (after.y - corner.y) * radius / b }
  };
}

export function polyPath(points, rounded) {
  let previous = points[0], d = `M ${pathPoint(previous)}`;
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    if (!rounded) { d += ` L ${pathPoint(current)}`; continue; }
    // Repeated waypoints or a port equal to a waypoint form one corner.
    while (points[i + 1]?.x === current.x && points[i + 1]?.y === current.y) i++;
    const after = points[i + 1];
    if (!after) d += ` L ${pathPoint(current)}`;
    else {
      const bend = roundedCorner(previous, current, after);
      if (bend) d += ` L ${pathPoint(bend.enter)} Q ${pathPoint(current)} ${pathPoint(bend.leave)}`;
    }
    previous = current;
  }
  return d;
}

// Use the dominant axis for interval comparisons, including reversed and
// diagonal segments. The key groups strokes that occupy the same line.
export function linearSpanProjection({a,b,dx,dy}) {
  const axis=Math.abs(dx)>=Math.abs(dy)?'x':'y', other=axis==='x'?'y':'x';
  const slope=(b[other]-a[other])/(b[axis]-a[axis]), offset=a[other]-slope*a[axis];
  return {axis,low:Math.min(a[axis],b[axis]),high:Math.max(a[axis],b[axis]),
    line:`${axis};${Math.round(slope*1e10)};${Math.round(offset*1e4)}`};
}

const pointPattern = '-?\\d+(?:\\.\\d+)? -?\\d+(?:\\.\\d+)?';
const generatedPath = new RegExp(`^M ${pointPattern}(?: L ${pointPattern}| Q ${pointPattern} ${pointPattern})+$`);

function absoluteCommands(d) {
  // polyPath emits only these space-separated absolute commands. Keep the
  // full parser for authored paths and other SVG syntax.
  if (!generatedPath.test(d)) return svgpath(d).abs().segments;
  const tokens = d.split(' '), commands = [];
  for (let i=0; i<tokens.length;) {
    const kind = tokens[i++];
    const command = [kind,+tokens[i++],+tokens[i++]];
    if (kind==='Q') command.push(+tokens[i++],+tokens[i++]);
    commands.push(command);
  }
  return commands;
}

// Trace the straight portions of the strokes as they will be painted.
// Keep other commands available to reconstruct the path without flattening.
export function traceLinearPath(d) {
  const commands=[], spans=[];
  const collinear=(ax,ay,bx,by)=>Math.abs(ax*by-ay*bx)<1e-8;
  let current, start;
  for (const cmd of absoluteCommands(d)) {
    const type=cmd[0], a=current;
    const b=type==='Z'?start:type==='H'?{x:cmd[1],y:a.y}:type==='V'?{x:a.x,y:cmd[1]}:{x:cmd.at(-2),y:cmd.at(-1)};
    current=b;
    if (type==='M') start=b;
    const dx=a?b.x-a.x:0, dy=a?b.y-a.y:0;
    // A rounded path can contain a quadratic along a straight run. Coalesce
    // these and adjacent collinear segments to include their internal joins.
    const control=type==='Q'?[cmd[1]-a.x,cmd[2]-a.y]:null;
    const along=control?control[0]*dx+control[1]*dy:0;
    const linear=type==='L'||type==='H'||type==='V'||control&&
      (dx||dy)&&collinear(dx,dy,...control)&&along>=0&&along<=dx*dx+dy*dy;
    if (!linear) { commands.push(cmd); continue; }
    if (!dx&&!dy) continue;
    const last=spans.at(-1);
    if (last?.index===commands.length-1&&collinear(last.dx,last.dy,dx,dy)&&last.dx*dx+last.dy*dy>0) {
      last.b=b;
      last.dx=b.x-last.a.x;
      last.dy=b.y-last.a.y;
      commands[last.index]=['L',b.x,b.y];
    } else {
      spans.push({index:commands.length,a,b,dx,dy});
      commands.push(['L',b.x,b.y]);
    }
  }
  return {commands,spans};
}
