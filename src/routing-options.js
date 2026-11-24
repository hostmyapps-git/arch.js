// View defaults apply before per-route overrides. Endpoint types differ:
// model relationships use target ports; reference connectors use path fractions.
export const DEFAULT_CURVE = 'rounded';
const fields = ['from', 'to', 'via', 'curve', 'label', 'sideOffset', 'path', 'icon', 'iconPosition', 'showIcon', 'showLabel', 'sharePath', 'color', 'width', 'dasharray', 'crossings','crossingRadius','avoidObstacles'];
const geometryFields = ['from', 'to', 'via', 'curve', 'source', 'target'];
const portDirections = {top:[0,-1], right:[1,0], bottom:[0,1], left:[-1,0]};

export function sidePort(box, side, position = 0.5) {
  if (side === 'left') return {x:box.x, y:box.y + box.height * position};
  if (side === 'right') return {x:box.x + box.width, y:box.y + box.height * position};
  if (side === 'top') return {x:box.x + box.width * position, y:box.y};
  return {x:box.x + box.width * position, y:box.y + box.height};
}

export function fixedPort(bounds, placement, shape) {
  if (placement === undefined || placement === 'auto') return;
  if (typeof placement === 'object' && !placement.side) {
    const {x,y} = placement;
    const side = y > bounds.y && y < bounds.y+bounds.height
      ? x === bounds.x ? 'left' : x === bounds.x+bounds.width ? 'right' : undefined
      : x > bounds.x && x < bounds.x+bounds.width
        ? y === bounds.y ? 'top' : y === bounds.y+bounds.height ? 'bottom' : undefined
        : undefined;
    return {at:placement, bounds, direction:portDirections[side]};
  }
  const side = placement.side ?? placement, position = placement.position ?? 0.5;
  const at = sidePort(bounds,side,position), direction = portDirections[side];
  // Fractions measure along the symbol's bounding box. Project the resulting
  // port onto the visible outline of tapered symbols.
  if (shape === 'circle' || shape === 'diamond') {
    const offset = Math.abs(2*position-1);
    const inset = shape === 'diamond' ? offset : 1-Math.sqrt(1-offset*offset);
    at.x -= direction[0]*bounds.width*inset/2;
    at.y -= direction[1]*bounds.height*inset/2;
  }
  return {at, bounds, direction};
}

export function routingOptions(view, specific, reference = false) {
  // The common automatic route has neither defaults nor overrides.
  if (!view.routeDefaults) return specific;
  const defaults = {...view.routeDefaults};
  if (reference) {
    delete defaults.sharePath;
    delete defaults.label;
    delete defaults.sideOffset;
    delete defaults.icon;
    delete defaults.iconPosition;
    delete defaults.showIcon;
    delete defaults.showLabel;
    delete defaults.crossings;
    delete defaults.crossingRadius;
    delete defaults.avoidObstacles;
    if (typeof defaults.to !== 'number') delete defaults.to;
  } else if (typeof defaults.to === 'number') delete defaults.to;
  // A locally specified geometry replaces an inherited free-path fallback.
  if (specific && geometryFields.some(key => specific[key] !== undefined)) delete defaults.path;
  if (!specific && !fields.some(key => defaults[key] !== undefined)) return undefined;
  return {...defaults, ...specific};
}
