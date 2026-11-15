// Colors enter the renderer only after hexadecimal schema validation.
export function luminance(hex) {
  const value = hex.slice(1);
  const channels = (value.length === 3 ? [...value].map(c => c + c).join('') : value).match(/../g).map(c => {
    const n = parseInt(c, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
export const foreground = background => contrast(background, '#000000') >= contrast(background, '#ffffff') ? '#000000' : '#ffffff';
export function composite(front, back, opacity) {
  const channels = hex => {
    const value = hex.slice(1);
    return (value.length === 3 ? [...value].map(c => c + c).join('') : value).match(/../g).map(c => parseInt(c, 16));
  };
  const base = channels(back);
  return '#' + channels(front).map((n, i) => Math.round(n * opacity + base[i] * (1 - opacity)).toString(16).padStart(2, '0')).join('');
}
