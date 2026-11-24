// Deterministic glyph estimates for SVG rendered in Node and in the browser.
// ASCII uses a dense table since most labels and identifiers use that range.
const asciiWidth = new Float64Array(128).fill(0.62);
asciiWidth.fill(0.76, 65, 91);
for (const char of "il.,' :!") asciiWidth[char.charCodeAt(0)] = 0.3;
for (const char of 'MWmw@#%&') asciiWidth[char.charCodeAt(0)] = 1;

function glyphWidth(char) {
  const code = char.codePointAt(0);
  return code < 128 ? asciiWidth[code] : code > 0x2fff ? 1.15 : code > 0x2ff ? 0.9 : 0.62;
}

function measure(text, units) {
  for (const char of text) units += glyphWidth(char);
  return units;
}

export function textLength(text) {
  return measure(String(text), 0);
}

export function wrap(text, width, fontSize = 13) {
  if (!text) return [];
  const result = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '', units = 0;
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      // Preserve the existing line-fit rule: the tentative word includes one
      // extra space, in addition to the one already appended after the line.
      if (line && measure(word, units + asciiWidth[32]) * fontSize > width) {
        result.push(line.trim());
        line = '';
        units = 0;
      }
      // Splitting a long identifier updates the width incrementally instead
      // of rescanning the entire prefix for every appended character.
      for (const char of word) {
        const glyph = glyphWidth(char);
        if (line && (units + glyph) * fontSize > width) {
          result.push(line.trim());
          line = '';
          units = 0;
        }
        line += char;
        units += glyph;
      }
      line += ' ';
      units += asciiWidth[32];
    }
    result.push(line.trim());
  }
  return result;
}

export function singleLine(text, width, fontSize) {
  const full = String(text ?? '').replace(/\s+/gu, ' ').trim();
  if (textLength(full) * fontSize <= width) return full;
  const budget = Math.max(0, width / fontSize - glyphWidth('…'));
  let result = '', used = 0;
  for (const char of full) {
    const units = glyphWidth(char);
    if (used + units > budget) break;
    result += char;
    used += units;
  }
  return result.trimEnd() + '…';
}
