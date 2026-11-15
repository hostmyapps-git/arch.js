import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import svgpath from 'svgpath';
import { registerIconPack } from '../src/icons.js';

const paintAttributes = { fill: 'fill', stroke: 'stroke', 'stroke-width': 'strokeWidth',
  'stroke-linecap': 'linecap', 'stroke-linejoin': 'linejoin', 'fill-rule': 'fillRule',
  opacity: 'opacity', 'fill-opacity': 'fillOpacity', 'stroke-opacity': 'strokeOpacity' };
const initialPaint = { fill: 'currentColor', stroke: 'none', strokeWidth: 1, linecap: 'butt',
  linejoin: 'miter', fillRule: 'nonzero', opacity: 1, fillOpacity: 1, strokeOpacity: 1 };
const numberAttributes = new Set(['strokeWidth', 'opacity', 'fillOpacity', 'strokeOpacity']);

function shapePath(element) {
  const tag = element.tagName;
  const n = (name, fallback = 0) => {
    const value = element.hasAttribute(name) ? Number(element.getAttribute(name)) : fallback;
    if (!Number.isFinite(value)) throw new Error(`Invalid ${tag}.${name}`);
    return value;
  };
  if (tag === 'path') return element.getAttribute('d');
  if (tag === 'circle' || tag === 'ellipse') {
    const x = n('cx'), y = n('cy'), rx = tag === 'circle' ? n('r') : n('rx'), ry = tag === 'circle' ? rx : n('ry');
    if (rx <= 0 || ry <= 0) throw new Error('Invalid ellipse radius');
    return `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
  }
  if (tag === 'rect') {
    const x = n('x'), y = n('y'), w = n('width'), h = n('height');
    const rx = Math.min(n('rx', n('ry')), w / 2), ry = Math.min(n('ry', rx), h / 2);
    if (w <= 0 || h <= 0 || rx < 0 || ry < 0) throw new Error('Invalid rectangle dimensions');
    if (!rx || !ry) return `M${x} ${y}h${w}v${h}h${-w}Z`;
    return `M${x + rx} ${y}H${x + w - rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}V${y + h - ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}H${x + rx}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}V${y + ry}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`;
  }
  throw new Error(`Unsupported SVG geometry: ${tag}`);
}

export function convertBody(body) {
  if (typeof body !== 'string' || /<!|<\?/.test(body)) throw new Error('Only SVG geometry is allowed');
  const document = new DOMParser({ onError: (level, message) => { throw new Error(`${level}: ${message}`); } })
    .parseFromString(`<svg>${body}</svg>`, 'image/svg+xml');
  const root = document.documentElement, ids = new Map(), result = [];
  const elements = [root, ...Array.from(root.getElementsByTagName('*'))];
  const attributes = [...Object.keys(paintAttributes), 'clip-rule', 'id', 'class', 'transform',
    'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'href'];
  for (const element of elements) {
    if (!['svg', 'g', 'defs', 'use', 'path', 'circle', 'ellipse', 'rect'].includes(element.tagName))
      throw new Error(`Unsupported SVG element: ${element.tagName}`);
    for (const attribute of Array.from(element.attributes)) if (!attributes.includes(attribute.name))
      throw new Error(`Unsupported SVG attribute: ${attribute.name}`);
    if (element.hasAttribute('id')) {
      const id = element.getAttribute('id');
      if (ids.has(id)) throw new Error(`Duplicate SVG ID: ${id}`);
      ids.set(id, element);
    }
  }
  const visit = (element, inherited = initialPaint, transforms = [], references = new Set()) => {
    if (element.tagName === 'defs') return;
    const paint = { ...inherited };
    for (const [attribute, key] of Object.entries(paintAttributes)) if (element.hasAttribute(attribute)) {
      let value = element.getAttribute(attribute);
      if (numberAttributes.has(key)) value = Number(value);
      // Group opacity is multiplicative, unlike inherited fill/stroke opacity.
      paint[key] = key === 'opacity' ? inherited.opacity * value : value;
    }
    if (element.hasAttribute('transform')) {
      const transform = element.getAttribute('transform');
      if (!/^matrix\(\s*[-+\d.eE,\s]+\)$/.test(transform)) throw new Error(`Unsupported SVG transform: ${transform}`);
      transforms = [...transforms, transform];
    }
    if (element.tagName === 'use') {
      const href = element.getAttribute('href');
      if (!href.startsWith('#') || !ids.has(href.slice(1)) || references.has(href)) throw new Error(`Invalid local SVG reference: ${href}`);
      visit(ids.get(href.slice(1)), paint, transforms, new Set([...references, href]));
    } else if (['svg', 'g'].includes(element.tagName)) {
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === 1) visit(child, paint, transforms, references);
        else if (child.nodeType !== 3 || child.nodeValue.trim()) throw new Error('Unexpected SVG content');
      }
    } else {
      const path = svgpath(shapePath(element));
      if (path.err) throw new Error(path.err);
      if (transforms.length) path.transform(transforms.join(' '));
      // Canonicalize compact arc flags before the runtime validator sees them.
      result.push({ d: path.round(6).toString(), ...paint });
    }
  };
  visit(root);
  if (!result.length) throw new Error('Empty SVG icon');
  return result;
}

export function convertCollection(collection, source) {
  const icons = Object.create(null);
  const width = collection.width ?? 16, height = collection.height ?? 16;
  for (const [id, icon] of Object.entries(collection.icons)) {
    try {
      icons[id] = { paths: convertBody(icon.body) };
      if (icon.width && icon.width !== width) icons[id].width = icon.width;
      if (icon.height && icon.height !== height) icons[id].height = icon.height;
    } catch (error) { throw new Error(`${source.name}.${id}: ${error.message}`); }
  }
  const resolving = new Set();
  const alias = id => {
    if (Object.hasOwn(icons, id)) return icons[id];
    const value = collection.aliases?.[id];
    if (!value || Object.keys(value).some(key => key !== 'parent') || resolving.has(id)) throw new Error(`Unsupported alias: ${source.name}.${id}`);
    resolving.add(id); icons[id] = alias(value.parent); resolving.delete(id); return icons[id];
  };
  for (const id of Object.keys(collection.aliases ?? {})) alias(id);
  const pack = { name: source.title, width, height, source: source.url, license: source.license, icons };
  registerIconPack(source.name, pack); // Fail the build on any unsupported geometry or paint.
  return pack;
}

export async function buildIconPacks() {
  const lock = JSON.parse(await readFile('icons/sources.lock.json', 'utf8')), packs = [];
  for (const source of lock.packs) {
    for (const [file, expected] of [[source.file, source.sha256], [source.licenseFile, source.licenseSha256]]) {
      const data = await readFile(file);
      if (createHash('sha256').update(data).digest('hex') !== expected) throw new Error(`Checksum mismatch: ${file}`);
    }
    const pack = convertCollection(JSON.parse(await readFile(source.file, 'utf8')), source);
    await writeFile(`icons/${source.name}.json`, JSON.stringify(pack) + '\n');
    packs.push({ name: source.name, title: source.title, count: Object.keys(pack.icons).length,
      license: source.license, file: `icons/${source.name}.json` });
  }
  const notice = '/* Bootstrap Icons: MIT; Lucide: ISC + Feather MIT; Tabler Icons: MIT. Full notices: icons/licenses/. */\n';
  const script = [notice, "'use strict';", 'if (typeof arch === "undefined") throw new Error("Load arch.js before icons/iconpacks.js");'];
  for (const pack of packs) script.push(`arch.registerIconPack(${JSON.stringify(pack.name)}, ${await readFile(pack.file, 'utf8')});`);
  script.push(`window.ARCH_ICON_PACKS = ${JSON.stringify(packs)};`);
  await writeFile('icons/iconpacks.js', script.join('\n') + '\n');
  console.log('Built local iconpacks:', packs.map(pack => `${pack.name} (${pack.count})`).join(', '));
  return packs;
}
