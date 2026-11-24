export const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export const num = n => String(Math.round(n * 1000) / 1000);

export function cardShadowFilter(id) {
  return `<filter id="${id}" x="-15%" y="-15%" width="130%" height="145%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity=".045"/></filter>`;
}
