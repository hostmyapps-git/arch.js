import { normalizeColor } from './colors.js';

export function normalizeViewBackgroundColor(value) {
  return typeof value === 'string' && value.toLowerCase() === 'transparent' ? 'transparent' : normalizeColor(value);
}

export function viewBackground(value, theme) {
  const fallback = theme === 'dark' ? '#111827' : '#fafbfe';
  const color = normalizeViewBackgroundColor(value) ?? fallback;
  return color === 'transparent'
    ? {color, fill:'none', backdrop:fallback}
    : {color, fill:color, backdrop:color};
}
