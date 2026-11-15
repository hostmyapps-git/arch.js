import { ArchError } from './parser.js';
import { inspectPath } from './geometry.js';

const packs = new Map();
const paintDefaults = Object.freeze({ fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  linecap: 'round', linejoin: 'round', fillRule: 'nonzero', opacity: 1, fillOpacity: 1, strokeOpacity: 1 });
const paintKeys = Object.keys(paintDefaults);
export function registerIconPack(name, pack) {
  const error = (message) => { throw new ArchError(message, {}, 'ARCH_ICON'); };
  if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) error('Ungültiger Iconpack-Name');
  if (!pack || !pack.icons || typeof pack.icons !== 'object' || Array.isArray(pack.icons)) error('Iconpack benötigt ein icons-Objekt');
  const result = new Map();
  if (Object.keys(pack.icons).length > 20000) error('Maximal 20000 Icons pro Pack erlaubt');
  for (const [id, icon] of Object.entries(pack.icons)) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(id) || !icon) error(`Ungültiges Icon: ${id}`);
    const width = icon.width ?? pack.width ?? 24, height = icon.height ?? pack.height ?? 24;
    if (![width, height].every(n => Number.isFinite(n) && n > 0 && n <= 4096)) error(`Ungültige Icongröße: ${id}`);
    if (!Array.isArray(icon.paths) || !icon.paths.length || icon.paths.length > 64) error(`Ungültige paths für Icon: ${id}`);
    const paths = icon.paths.map(path => {
      const value = typeof path === 'string' ? { d: path } : path;
      if (!value || typeof value !== 'object' || Object.keys(value).some(key => !['d', ...paintKeys].includes(key)))
        error(`Ungültiges Pfadobjekt: ${id}`);
      inspectPath(value.d);
      const paint = Object.fromEntries(paintKeys.map(key => [key, value[key] ?? paintDefaults[key]]));
      for (const key of ['fill', 'stroke']) if (!['none', 'currentColor'].includes(paint[key])) error(`Ungültige Iconfarbe: ${id}.${key}`);
      if (!['butt', 'round', 'square'].includes(paint.linecap) || !['miter', 'round', 'bevel'].includes(paint.linejoin) ||
          !['nonzero', 'evenodd'].includes(paint.fillRule)) error(`Ungültiger Zeichenstil: ${id}`);
      if (!Number.isFinite(paint.strokeWidth) || paint.strokeWidth < 0 || paint.strokeWidth > 64 ||
          ['opacity', 'fillOpacity', 'strokeOpacity'].some(key => !Number.isFinite(paint[key]) || paint[key] < 0 || paint[key] > 1))
        error(`Ungültige Strichstärke oder Deckkraft: ${id}`);
      return Object.freeze({ d: value.d, ...paint });
    });
    result.set(id, Object.freeze({ width, height, paths: Object.freeze(paths) }));
  }
  if (!result.size) error('Iconpack ist leer');
  packs.set(name, result);
}
export function getIconPacks() { return [...packs.keys()]; }
export function getIcon(name, loc) {
  const [pack, id, ...rest] = String(name).split('.');
  const result = !rest.length && packs.get(pack)?.get(id);
  if (!result) throw new ArchError(`Unbekanntes Icon: ${name}`, loc, 'ARCH_ICON');
  return result;
}

registerIconPack('core', { icons: {
  person: { paths: ['M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z', 'M4 21v-2a8 8 0 0 1 16 0v2'] },
  system: { paths: ['M3 4h18v13H3Z', 'M8 21h8M12 17v4M7 8h10M7 12h6'] },
  browser: { paths: ['M3 4h18v16H3ZM3 9h18M7 6.5h.01M10 6.5h.01', 'm9 12-3 2 3 2m6-4 3 2-3 2'] },
  service: { paths: ['m12 2 9 5v10l-9 5-9-5V7Z', 'm3 7 9 5 9-5M12 12v10M8 4l9 5'] },
  component: { paths: ['M8 3h13v18H8v-4M8 13V9M8 5V3', 'M3 5h8v4H3ZM3 13h8v4H3Z'] },
  database: { paths: ['M21 5c0 4-18 4-18 0s18-4 18 0ZM3 5v14c0 4 18 4 18 0V5', 'M3 12c0 4 18 4 18 0'] },
  queue: { paths: ['M3 5h18v14H3ZM8 5v14M16 5v14', 'm10 10 3 2-3 2'] },
  interface: { paths: ['M16 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM16 12h6M1 12h5'] },
  capability: { paths: ['m12 2 2.8 6 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 8.9 9.2 8Z'] },
  process: { paths: ['M3 5h13l5 7-5 7H3l5-7Z'] },
  artifact: { paths: ['M5 2h9l5 5v15H5ZM14 2v6h5M8 12h8M8 16h6'] },
  node: { paths: ['M3 4h18v16H3ZM3 9h18M7 6.5h.01M7 13h.01M7 17h.01M11 13h6M11 17h6'] },
  package: { paths: ['M3 7V4h7l3 3h8v13H3ZM3 7h18'] },
  cloud: { paths: ['M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11-1A5 5 0 0 0 6 18Z'] },
  shield: { paths: ['m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z', 'm8 12 3 3 5-6'] },
  globe: { paths: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20', 'M12 2c6 6 6 14 0 20-6-6-6-14 0-20Z'] },
} });

export const defaultIcon = (type) => `core.${type === 'application' ? 'browser' : type}`;
