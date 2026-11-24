import { escape as esc, num } from './svg-values.js';
import { polyPath } from './svg-path.js';
import { singleLine, wrap } from './text-layout.js';

const SECOND = 1000, MINUTE = 60 * SECOND, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TIME_STEPS = [1, 10, 100, SECOND, 5 * SECOND, 15 * SECOND, 30 * SECOND,
  MINUTE, 5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 3 * HOUR, 6 * HOUR,
  12 * HOUR, DAY, 2 * DAY, 4 * DAY, 7 * DAY, 14 * DAY];
const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 60, 120, 240, 600, 1200, 2400, 6000, 12000, 24000];

const WIDTH = 1080, INSET = 10, DIVIDER = 306, HEADER_END = 74, ROW_HEIGHT = 62;
const PLOT_START = DIVIDER + 28, PLOT_END = WIDTH - 44;
const LABEL_X = 30, LABEL_WIDTH = DIVIDER - LABEL_X - 18;

const light = {
  panel: '#ffffff', header: '#f2f5fb', stripe: '#f8fafd', outline: '#d9e2ef', grid: '#e6edf6',
  ink: '#1e293b', secondary: '#52647b', bar: '#5146cb', milestone: '#087d76', edge: '#64748b'
};
const dark = {
  panel: '#151f30', header: '#202d44', stripe: '#192639', outline: '#35445a', grid: '#2a394d',
  ink: '#f1f5f9', secondary: '#aebed3', bar: '#9287fb', milestone: '#5edbc4', edge: '#8b9ab2'
};

const dateLabel = date => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
const fullDate = date => `${dateLabel(date)} ${date.getUTCFullYear()}`;
const timeLabel = (date, digits = 5) => date.toISOString().split('T')[1].slice(0, digits);

function rowDateLabel(start, end, showTime) {
  const first = new Date(start), last = new Date(end);
  const sameDay = first.toISOString().split('T')[0] === last.toISOString().split('T')[0];
  if (showTime && sameDay) {
    const digits = end - start < MINUTE ? 12 : 5;
    const clock = date => timeLabel(date, digits).replace(/\.000$/, '');
    const time = clock(first) + (start === end ? '' : '–' + clock(last));
    return `${fullDate(first)} · ${time} UTC`;
  }
  if (start === end) return fullDate(first);
  const startLabel = first.getUTCFullYear() === last.getUTCFullYear() ? dateLabel(first) : fullDate(first);
  return `${startLabel} – ${fullDate(last)}`;
}

function utcMonth(index) {
  const date = new Date(0);
  date.setUTCFullYear(0, index, 1);
  return date;
}

// Align short ranges to clock/day boundaries and long ranges to calendar
// months. A month tick uses its actual date even in leap years.
function axisTicks(from, to, hasClock) {
  const interval = Math.max(hasClock ? 1 : DAY, (to - from) / 7);
  const ticks = [];
  const step = TIME_STEPS.find(step => step >= interval);
  if (step) {
    const spansDays = Math.floor(from / DAY) !== Math.floor(to / DAY);
    let previousDay;
    for (let stamp = Math.ceil(from / step) * step; stamp <= to; stamp += step) {
      const date = new Date(stamp);
      const day = dateLabel(date);
      let label = day;
      if (step < DAY) {
        const clock = timeLabel(date, step < SECOND ? 12 : step < MINUTE ? 8 : 5);
        label = spansDays && day !== previousDay ? `${day} · ${clock}` : clock;
      }
      ticks.push({ stamp, label });
      previousDay = day;
    }
  } else {
    const stride = MONTH_STEPS.find(months => months * 30.44 * DAY >= interval) ?? MONTH_STEPS.at(-1);
    const first = new Date(from);
    const index = first.getUTCFullYear() * 12 + first.getUTCMonth();
    // Start at the first aligned month and skip it when its boundary is just
    // outside the domain. Do not create evenly spaced approximations of months.
    for (let month = Math.ceil(index / stride) * stride; ; month += stride) {
      const date = utcMonth(month), stamp = date.getTime();
      if (stamp > to) break;
      if (stamp < from) continue;
      const label = stride >= 12 ? String(date.getUTCFullYear()) : MONTHS[date.getUTCMonth()];
      ticks.push({ stamp, label });
    }
  }
  return ticks;
}

function dependencyPoints(source, target) {
  const exit = { x: source.right, y: source.y };
  const entry = { x: target.left - 3, y: target.y };
  if (entry.x - exit.x >= 24 && entry.y !== exit.y) {
    const bendX = (exit.x + entry.x) / 2;
    return [exit, { x: bendX, y: exit.y }, { x: bendX, y: entry.y }, entry];
  }
  // Finish-to-start edges can share the same day or go backward in time.
  // Use the space between row centers to approach the target from the left.
  const gapY = exit.y + (entry.y < exit.y ? -1 : 1) * 21;
  const exitX = exit.x + 12, entryX = entry.x - 12;
  return [exit, { x: exitX, y: exit.y }, { x: exitX, y: gapY },
    { x: entryX, y: gapY }, { x: entryX, y: entry.y }, entry];
}

export function drawTimeline({ nodes, edges, options, isDark, prefix, out, measureOnly }) {
  const rowEnd = HEADER_END + ROW_HEIGHT * nodes.length;
  const panelEnd = rowEnd + 8;
  const height = panelEnd + INSET;
  if (measureOnly) return { width: WIDTH, height };

  const palette = isDark ? dark : light;
  const startField = options.startAttribute ?? 'start', endField = options.endAttribute ?? 'end';
  let first = Infinity, last = -Infinity, hasClock = false;
  const rows = nodes.map(node => {
    const startValue = node.attributes?.[startField] ?? node[startField];
    const endValue = node.attributes?.[endField] ?? node[endField];
    const start = Date.parse(startValue), end = Date.parse(endValue);
    const showTime = startValue.includes('T') || endValue.includes('T');
    first = Math.min(first, start);
    last = Math.max(last, end);
    hasClock ||= showTime;
    return { node, start, end, showTime, startValue, endValue };
  });
  const pad = first === last ? (hasClock ? HOUR : 2 * DAY) : 0;
  const from = first - pad, to = last + pad;
  const scale = stamp => PLOT_START + (stamp - from) / (to - from) * (PLOT_END - PLOT_START);
  const text = (value, x, y, size, fill, weight = 400, anchor = 'start') =>
    `<text x="${num(x)}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;

  // The panel is a single outlined surface. Stripes are grouped under the
  // grid, and all connectors are painted behind the foreground marks.
  out.push(`<g class="arch-timeline" style="font-variant-numeric:tabular-nums">`,
    `<rect x="${INSET}" y="${INSET}" width="${WIDTH - 2 * INSET}" height="${panelEnd - INSET}" rx="14" fill="${palette.panel}"/>`,
    `<path d="M${INSET} ${HEADER_END}V24Q${INSET} ${INSET} 24 ${INSET}H${WIDTH - 24}Q${WIDTH - INSET} ${INSET} ${WIDTH - INSET} 24V${HEADER_END}Z" fill="${palette.header}"/>`);
  if (!rows.length) {
    out.push(text('No dated elements',LABEL_X,48,13,palette.secondary,600),'</g>');
    return {width:WIDTH,height};
  }

  const positions = new Map();
  rows.forEach((row, index) => {
    const top = HEADER_END + index * ROW_HEIGHT;
    if (index % 2) out.push(`<rect x="${INSET + 1}" y="${top}" width="${WIDTH - 2 * INSET - 2}" height="${ROW_HEIGHT}" fill="${palette.stripe}"/>`);
    const x = scale(row.start), y = top + ROW_HEIGHT / 2;
    const milestone = row.start === row.end;
    const left = milestone ? x - 8 : x;
    const right = milestone ? x + 8 : Math.max(x + 3, scale(row.end));
    Object.assign(row, { x, y, left, right, milestone });
    positions.set(row.node.id, row);
  });

  // Axis labels are drawn in the header. Grid lines stop at the body and
  // use a quieter color than row names and dependency strokes.
  const firstDate = new Date(from), lastDate = new Date(to);
  const firstYear = firstDate.getUTCFullYear(), lastYear = lastDate.getUTCFullYear();
  let period = firstYear === lastYear ? String(firstYear) : `${firstYear}–${lastYear}`;
  if (hasClock && to - from < 2 * DAY) {
    const day = dateLabel(firstDate) === dateLabel(lastDate) ? fullDate(firstDate) : rowDateLabel(from, to, false);
    period = `${day} · UTC`;
  }
  out.push(text('Item', LABEL_X, 48, 13, palette.secondary, 600),
    text(period, PLOT_START, 32, 14, palette.ink, 650));
  for (const { stamp, label } of axisTicks(from, to, hasClock)) {
    const x = num(scale(stamp));
    out.push(`<path d="M${x} ${HEADER_END}V${rowEnd}" stroke="${palette.grid}"/>`,
      text(label, Number(x), 57, 12, palette.secondary, 500, 'middle'));
  }
  const dividers = rows.map((_, index) => `M${INSET} ${HEADER_END + index * ROW_HEIGHT}H${WIDTH - INSET}`).join(' ');
  out.push(`<path d="M${DIVIDER} ${INSET}V${panelEnd} ${dividers}" fill="none" stroke="${palette.outline}"/>`);

  for (const edge of edges) {
    const source = positions.get(edge.source), target = positions.get(edge.target);
    if (!source || !target) continue;
    out.push(`<g data-edge="${esc(edge.id)}"><title>${esc(edge.title)}</title>`,
      `<path d="${polyPath(dependencyPoints(source, target), true)}" fill="none" stroke="${palette.edge}" stroke-width="1.5" stroke-linecap="round" marker-end="url(#${prefix}-arrow)"/></g>`);
  }

  for (const { node, x, y, right, milestone, start, end, showTime, startValue, endValue } of rows) {
    const fill = node.backgroundColor ?? (milestone ? palette.milestone : palette.bar);
    const opacity = node.opacity ?? (node.backgroundColor && !milestone ? 0.28 : 1);
    const title = wrap(node.title, LABEL_WIDTH, 14);
    const visible = title.length > 2 ? [title[0], singleLine(title.slice(1).join(' '), LABEL_WIDTH, 14)] : title;
    const titleY = y - (visible.length > 1 ? 13 : 3);
    out.push(`<g data-bar="${esc(node.id)}"><title>${esc(node.title)}: ${esc(startValue)} – ${esc(endValue)}</title>`);
    visible.forEach((line, i) => out.push(text(line, LABEL_X, titleY + i * 16, 14, palette.ink, 600)));
    out.push(text(singleLine(rowDateLabel(start, end, showTime), LABEL_WIDTH, 12), LABEL_X, y + (visible.length > 1 ? 21 : 16), 12, palette.secondary));
    if (milestone) {
      out.push(`<path d="M${num(x)} ${y - 8}l8 8-8 8-8-8Z" fill="${fill}" fill-opacity="${opacity}"/>`);
    } else {
      const width = right - x;
      out.push(`<rect x="${num(x)}" y="${y - 10}" width="${num(width)}" height="20" rx="${num(Math.min(5, width / 2))}" fill="${fill}" fill-opacity="${opacity}" stroke="${fill}"/>`);
    }
    out.push('</g>');
  }

  out.push(`<rect x="${INSET}" y="${INSET}" width="${WIDTH - 2 * INSET}" height="${panelEnd - INSET}" rx="14" fill="none" stroke="${palette.outline}" pointer-events="none"/>`, '</g>');
  return { width: WIDTH, height };
}
