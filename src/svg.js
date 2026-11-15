import { ArchError } from './parser.js';
import { num } from './geometry.js';
import { defaultIcon, getIcon } from './icons.js';
import { contrast, foreground, composite } from './colors.js';
import { toDiagramSVG } from './diagrams.js';

export const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
let serial = 0;
const accents = { person: '#64748b', system: '#4f46e5', application: '#6366f1', service: '#0d9488',
  component: '#8b5cf6', database: '#d97706', queue: '#db8b22', interface: '#0891b2',
  capability: '#9333ea', process: '#0284c7', artifact: '#64748b', node: '#475569', package: '#64748b' };

function iconMarkup(name, x, y, size, loc) {
  const icon = getIcon(name, loc), scale = size / Math.max(icon.width, icon.height);
  return `<g data-icon="${escape(name)}" transform="translate(${num(x)} ${num(y)}) scale(${num(scale)})">${icon.paths.map(p =>
    `<path d="${escape(p.d)}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="${p.linecap}" stroke-linejoin="${p.linejoin}" fill-rule="${p.fillRule}" opacity="${p.opacity}" fill-opacity="${p.fillOpacity}" stroke-opacity="${p.strokeOpacity}"/>`).join('')}</g>`;
}

export function renderIconToString(name, { size = 24, title = name } = {}) {
  if (!Number.isFinite(size) || size <= 0 || size > 512) throw new ArchError('Icongröße muss zwischen 0 und 512 liegen');
  const icon = getIcon(name), longest = Math.max(icon.width, icon.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}" width="${num(size * icon.width / longest)}" height="${num(size * icon.height / longest)}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title>${iconMarkup(name, 0, 0, longest)}</svg>`;
}

function linesMarkup(lines, x, y, size, color, weight = 400, lineHeight = 17, anchor = 'start') {
  return `<text x="${num(x)}" y="${num(y)}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${num(x)}" dy="${i ? lineHeight : 0}">${escape(line)}</tspan>`).join('')}</text>`;
}

function nodeMarkup(node, palette, prefix, backdrop = palette.bg) {
  const { width: w, height: h } = node;
  let accent = node.accent ?? accents[node.template] ?? accents.node;
  if (palette.dark) {
    const hex = accent.slice(1), full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
    accent = '#' + full.match(/../g).map(c => Math.round(parseInt(c, 16) * .62 + 255 * .38).toString(16).padStart(2, '0')).join('');
  }
  if (node.backgroundColor) {
    const visibleColor = composite(node.backgroundColor, backdrop, 0.2);
    const text = foreground(visibleColor);
    palette = { ...palette, card: node.backgroundColor, package: node.backgroundColor, text, muted: text, border: text };
    if (contrast(accent, visibleColor) < 4.5 || contrast(accent, composite(accent, visibleColor, 0.1)) < 4.5) accent = text;
  }
  const fillOpacity = node.backgroundColor ? ' fill-opacity="0.2"' : '';
  const title = `<title>${escape(node.title)} — ${escape(node.type)}${node.description ? `: ${escape(node.description)}` : ''}</title>`;
  const attrs = `data-node="${escape(node.id)}" data-type="${escape(node.type)}" data-template="${node.template}" transform="translate(${num(node.x)} ${num(node.y)})"`;
  const iconName = node.icon ?? defaultIcon(node.template);
  if (node.container) {
    return `<g class="arch-package" ${attrs}>${title}
      <rect width="${num(w)}" height="${num(h)}" rx="18" fill="${palette.package}"${fillOpacity} stroke="${palette.border}" stroke-dasharray="5 4"/>
      <path d="M 0 ${num(node.headerHeight)} H ${num(w)}" stroke="${palette.border}"/>
      <g color="${accent}">${iconMarkup(iconName, 20, 17, 22, node.loc)}</g>
      ${linesMarkup(node.titleLines, 53, 32, 14, palette.text, 650, 20)}
      ${linesMarkup([node.type === 'package' ? 'PACKAGE' : 'CONTAINER'], w - 18, 32, 9, palette.muted, 600, 17, 'end')}
    </g>`;
  }
  let shape;
  const standard = `<rect x="0.75" y="0.75" width="${num(w - 1.5)}" height="${num(h - 1.5)}" rx="13" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>`;
  switch (node.template) {
    case 'database':
      shape = `<path d="M1 15 C1 -3 ${num(w - 1)} -3 ${num(w - 1)} 15 V${num(h - 15)} C${num(w - 1)} ${num(h + 3)} 1 ${num(h + 3)} 1 ${num(h - 15)}Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>
        <path d="M1 15 C1 33 ${num(w - 1)} 33 ${num(w - 1)} 15" fill="none" stroke="${palette.border}"/>`;
      break;
    case 'process':
      shape = `<path d="M1 1 H${num(w - 20)} L${num(w - 1)} ${num(h / 2)} L${num(w - 20)} ${num(h - 1)} H1 L13 ${num(h / 2)}Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>`; break;
    case 'artifact':
      shape = `<path d="M1 1 H${num(w - 23)} L${num(w - 1)} 23 V${num(h - 1)} H1Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/><path d="M${num(w - 23)} 1 V23 H${num(w - 1)}" fill="none" stroke="${palette.border}"/>`; break;
    case 'interface': shape = standard.replace('rx="13"', 'rx="36"'); break;
    case 'capability': shape = standard.replace('rx="13"', 'rx="24"'); break;
    default: shape = standard;
  }
  const extras = {
    system: `<rect x="5" y="5" width="${num(w - 10)}" height="${num(h - 10)}" rx="9" fill="none" stroke="${palette.border}" opacity=".65"/>`,
    component: `<path d="M${num(w - 22)} 18h12v8h-12ZM${num(w - 22)} 31h12v8h-12Z" fill="${palette.card}"${fillOpacity} stroke="${accent}"/>`,
    queue: `<path d="M${num(w - 17)} 14V${num(h - 14)}M${num(w - 12)} 14V${num(h - 14)}" stroke="${accent}" opacity=".35"/>`,
    node: `<circle cx="${num(w - 18)}" cy="22" r="3" fill="${accent}"/>`,
  }[node.template] ?? '';
  const top = node.template === 'database' ? 34 : 18;
  const textY = top + 44 + Math.max(0, node.badgeLines.length - 1) * 12;
  let descriptionY = textY + (node.titleLines.length - 1) * 20 + 25;
  return `<g class="arch-node" ${attrs} tabindex="0" role="group" aria-label="${escape(`${node.title}, ${node.type}`)}">${title}
    <g filter="url(#${prefix}-shadow)">${shape}</g>${extras}
    <rect x="18" y="${top}" width="27" height="27" rx="7" fill="${accent}" opacity=".1"/>
    <g color="${accent}">${iconMarkup(iconName, 23, top + 5, 17, node.loc)}</g>
    ${linesMarkup(node.badgeLines, 54, top + 18, 9, accent, 650, 12)}
    ${linesMarkup(node.titleLines, 20, textY, 15, palette.text, 650, 20)}
    ${linesMarkup(node.descLines, 20, descriptionY, 12, palette.muted, 400, 17)}
    ${linesMarkup(node.technologyLines, 20, h - 18 - (node.technologyLines.length - 1) * 13, 10, accent, 500, 13)}
  </g>`;
}

export function toSVG(graph, options = {}) {
  const theme = options.theme ?? graph.view.theme;
  if (!['light', 'dark'].includes(theme)) throw new ArchError('theme muss light oder dark sein');
  const prefix = options.idPrefix ?? `arch-${++serial}`;
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(prefix)) throw new ArchError('Ungültiges idPrefix');
  if (graph.view.diagram && graph.view.diagram.type !== 'connected') return toDiagramSVG(graph, { theme, idPrefix: prefix });
  const palette = theme === 'dark'
    ? { dark: true, bg: '#111827', card: '#1e293b', package: '#162032', border: '#3b4960', text: '#f1f5f9', muted: '#a4b2c7', edge: '#9caac0' }
    : { bg: '#fafbfe', card: '#ffffff', package: '#f0f3fa', border: '#d8dfec', text: '#1e293b', muted: '#738198', edge: '#94a3b8' };
  const b = graph.bounds;
  const nodeById = new Map(graph.nodes.map(node => [node.id, node])), backdrops = new Map();
  const backdropFor = node => {
    if (backdrops.has(node.id)) return backdrops.get(node.id);
    const parent = nodeById.get(node.parent);
    const color = parent ? parent.backgroundColor ? composite(parent.backgroundColor, backdropFor(parent), 0.2) : palette.package : palette.bg;
    backdrops.set(node.id, color); return color;
  };
  const definitions = `<defs>
    <filter id="${prefix}-shadow" x="-15%" y="-15%" width="130%" height="145%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity=".045"/></filter>
    <marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m1 1 8 4-8 4" fill="none" stroke="${palette.edge}" stroke-width="1.5"/></marker>
    <marker id="${prefix}-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 11 6 1 11Z" fill="${palette.bg}" stroke="${palette.edge}"/></marker>
    <marker id="${prefix}-diamond" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="10" markerHeight="8" orient="auto"><path d="m1 5 6-4 6 4-6 4Z" fill="${palette.edge}"/></marker>
  </defs>`;
  const edgePaths = graph.edges.map(edge => {
    const dash = ['dependency', 'realization'].includes(edge.style) ? ' stroke-dasharray="6 5"' : '';
    const start = edge.style === 'composition' ? ` marker-start="url(#${prefix}-diamond)"` : '';
    const end = ['association', 'composition'].includes(edge.style) ? '' : ` marker-end="url(#${prefix}-${['realization', 'generalization'].includes(edge.style) ? 'triangle' : 'arrow'})"`;
    return `<g class="arch-edge" data-edge="${escape(edge.id)}" data-type="${escape(edge.type)}" data-style="${edge.style}"><title>${escape(edge.title || edge.type)}</title><path d="${escape(edge.d)}" fill="none" stroke="${palette.edge}" stroke-width="1.5" stroke-linejoin="round"${dash}${start}${end}/></g>`;
  }).join('');
  const edgeLabels = graph.edges.filter(e => e.title).map(edge => {
    const { x, y } = edge.label;
    return `<g class="arch-edge-label" data-label-for="${escape(edge.id)}"><rect x="${num(x - edge.labelWidth / 2)}" y="${num(y - edge.labelHeight / 2)}" width="${num(edge.labelWidth)}" height="${num(edge.labelHeight)}" rx="5" fill="${palette.bg}" stroke="${palette.border}" stroke-width=".6"/>${linesMarkup(edge.labelLines, x, y - (edge.labelLines.length - 1) * 7.5 + 3.5, 11, palette.muted, 450, 15, 'middle')}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${prefix}-diagram" data-arch-svg="${theme}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" viewBox="${num(b.x)} ${num(b.y)} ${num(b.width)} ${num(b.height)}" width="${num(b.width)}" height="${num(b.height)}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:${palette.bg};color:${palette.text}">
    <title id="${prefix}-title">${escape(graph.title)} — ${escape(graph.view.title)}</title>
    <desc id="${prefix}-desc">${escape(graph.description || `${graph.nodes.length} architecture elements, ${graph.edges.length} relationships`)}</desc>
    ${definitions}<style>#${prefix}-diagram .arch-node{outline:none}#${prefix}-diagram .arch-node:focus>g:first-of-type{filter:none}#${prefix}-diagram .arch-node:focus{outline:2px solid #818cf8;outline-offset:5px;border-radius:12px}</style>
    <rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.width)}" height="${num(b.height)}" fill="${palette.bg}"/>
    ${graph.nodes.filter(n => n.container).map(n => nodeMarkup(n, palette, prefix, backdropFor(n))).join('')}
    ${edgePaths}${graph.nodes.filter(n => !n.container).map(n => nodeMarkup(n, palette, prefix, backdropFor(n))).join('')}${edgeLabels}
  </svg>`;
}
