// Provenance kept only for draft layout objects. Inspection uses the renderer's
// resolved values, including layout offsets, rather than evaluating expressions twice.
const sources = new WeakMap();

export function rememberGeometry(item, source) {
  if (source) sources.set(item, source);
}

export function geometrySource(item) {
  return sources.get(item);
}

const number = value => String(Number(value.toFixed(6)));
export function detailValue(value) {
  if (typeof value === 'number') return number(value);
  if (typeof value === 'string' && value.startsWith('data:image/')) return 'Embedded image';
  if (Array.isArray(value)) return `[${value.map(detailValue).join(', ')}]`;
  if (value && typeof value === 'object') {
    if ('side' in value) return `${value.side} ${detailValue(value.position)}`;
    if ('position' in value) return [detailValue(value.position), ...['offset','sideOffset']
      .filter(key=>Object.hasOwn(value,key)).map(key=>`${key} ${detailValue(value[key])}`)].join(' ');
    return `(${detailValue(value.x)}, ${detailValue(value.y)})`;
  }
  return String(value);
}

const row = (key, value, input) => [key, value, input];

function svgBox(anchor) {
  const view = anchor.closest('svg[data-arch-svg]');
  const viewMatrix = view?.getScreenCTM(), localMatrix = anchor.getScreenCTM?.();
  if (!viewMatrix || !localMatrix || !anchor.getBBox) return;
  const box = anchor.getBBox();
  const matrix = viewMatrix.inverse().multiply(localMatrix);
  // getScreenCTM() can return a legacy SVGMatrix without transformPoint().
  // Project both box axes so the bounds cover all four transformed corners.
  const x = matrix.a*box.x + matrix.c*box.y + matrix.e;
  const y = matrix.b*box.x + matrix.d*box.y + matrix.f;
  const wx = matrix.a*box.width, hx = matrix.c*box.height;
  const wy = matrix.b*box.width, hy = matrix.d*box.height;
  return {
    x:x+Math.min(0,wx)+Math.min(0,hx), y:y+Math.min(0,wy)+Math.min(0,hy),
    width:Math.abs(wx)+Math.abs(hx), height:Math.abs(wy)+Math.abs(hy),
  };
}

function cardSections(item, target, anchor, isCard, source) {
  const {place, style = {}, resolvedStyle = style} = source ?? {};
  const geometry = ['x', 'y', 'width', 'height'].map(field => {
    const input = field === 'x' || field === 'y' ? place?.at[field] : undefined;
    return row(field, target?.[field], input);
  });
  const entries = Object.keys(style).filter(key => key !== 'loc');
  const shape = anchor.querySelector(':scope > g[filter] > [fill], :scope > rect[fill]');
  const isClass = anchor.hasAttribute('data-class-card');
  const title = anchor.querySelector(':scope > text[font-weight="650"]:not([data-node-badge]), :scope > g[font-weight="650"] > text');
  const paint = {
    template:isClass ? 'class' : anchor.getAttribute('data-template'),
    fontSize:title?.getAttribute('font-size'),
    backgroundColor:shape?.getAttribute('fill'),
    opacity:shape && (shape.getAttribute('fill-opacity') ?? '1'),
    accent:anchor.querySelector('[data-node-badge]')?.getAttribute('fill'),
    iconPosition:anchor.getAttribute('data-icon-position'),
  };
  const keys = new Set(isCard || isClass ? ['template', 'fontSize', 'accent', 'backgroundColor', 'iconPosition', ...entries] : entries);
  const styles = Array.from(keys, key => {
    const value = paint[key] ?? (key === 'fontSize' ? item.textStyle?.title : ['width', 'height'].includes(key) ? resolvedStyle[key] : item[key]);
    return row(key, value ?? resolvedStyle[key], style[key]);
  });
  if (place?.size) styles.push(row('place size', place.size));
  return {geometry, styles};
}

function edgeSections(item, path, source) {
  let start = item.points?.[0], end = item.points?.at(-1);
  if (!start && path) {
    start = path.getPointAtLength(0);
    end = path.getPointAtLength(path.getTotalLength());
  }
  const geometry = [row('Start', start), row('End', end), row('Label', item.labelLines?.length || item.labelIcon ? item.label : undefined)];
  const {route, resolvedRoute = route} = source ?? {};
  const styles = [row('color', path?.getAttribute('stroke') ?? item.color, route?.color),
    row('width', item.width ?? path?.getAttribute('stroke-width'), route?.width),
    row('dasharray', item.dasharray ?? path?.getAttribute('stroke-dasharray') ?? (path ? 'none' : undefined), route?.dasharray),
    row('label icon', item.labelIcon ?? (route?.icon !== undefined ? 'none' : undefined), route?.icon),
    row('iconPosition', item.labelIcon ? item.labelIconPosition : undefined, route?.iconPosition),
    row('showIcon', route?.showIcon === undefined ? undefined : !!item.labelIcon, route?.showIcon),
    row('showLabel', route?.showLabel === undefined ? undefined : !!item.labelLines?.length, route?.showLabel)];
  const routing = ['from', 'to', 'via', 'label', 'sideOffset', 'curve', 'sharePath', 'path'].filter(key => route?.[key] !== undefined)
    .map(key => row(key, resolvedRoute[key] ?? 'Overridden by path', route[key]));
  return {geometry, styles, routing};
}

export function inspectionSections(item, anchor, scope) {
  if (item.source !== undefined) return edgeSections(item, scope.paths.get(item.id)?.querySelector('path'), geometrySource(item));
  const type = scope.layout.view.diagram?.type ?? 'connected';
  const isCard = type === 'connected' || type === 'tree';
  const reference = anchor.closest('.arch-edge-reference');
  const occurrence = reference && scope.references.get(reference.getAttribute('data-reference-for')?.split(' ')[0])?.get(item.id);
  return cardSections(item, isCard || anchor.hasAttribute('data-class-card') ? occurrence?.node ?? item : svgBox(anchor), anchor, isCard, geometrySource(item));
}
