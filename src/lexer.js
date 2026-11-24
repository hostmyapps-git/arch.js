import { ArchError } from './errors.js';

const invalidXML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff\ud800-\udfff]/u;
const fail = (message, line, column) => { throw new ArchError(message, { line, column }, 'ARCH_SYNTAX'); };

export function tokenize(source, recover = false) {
  const tokens = [];
  let i = 0, line = 1, column = 1, separator = false;
  // Sticky expressions inspect the original string at the cursor. Avoid
  // building a new tail substring for each number and identifier.
  const numberAt = /-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
  const wordAt = /[A-Za-z_][A-Za-z0-9_.-]*/y;
  const append = (type, value) => {
    const token = {type, value, line, column};
    if (separator) token.separator = true;
    tokens.push(token);
    separator = false;
  };
  const emit = (type, value, length) => {
    append(type, value);
    // Regular tokens cannot contain physical newlines. Columns count UTF-16
    // code units, including the original escape sequences.
    i += length;
    column += length;
  };
  const invalid = (message, length) => {
    if (!recover) fail(message,line,column);
    emit('invalid',message,length);
  };

  while (i < source.length) {
    const c = source[i];
    if (c === '\n') { i++; line++; column = 1; continue; }
    if (c === ';') { separator = recover; i++; column++; continue; }
    if (c === ' ' || /\s/.test(c)) { i++; column++; continue; }
    if (c === '#' || c === '/' && source[i+1] === '/') {
      const nextLine = source.indexOf('\n', i), end = nextLine < 0 ? source.length : nextLine;
      column += end - i;
      i = end;
      continue;
    }
    if (c === '@') {
      // Quotes protect separators in help filters. Unescaped newlines and
      // separators outside quotes terminate a directive.
      let end = i, quoted = false;
      while (end < source.length) {
        const char = source[end];
        if (quoted && char === '\\') { end += 2; continue; }
        if (char === '"') quoted = !quoted;
        if (char === '\n' || !quoted && (';}'.includes(char) || char === '#' || char === '/' && source[end+1] === '/')) break;
        end++;
      }
      append('directive',source.slice(i, end));
      while (i < end) {
        if (source[i++] === '\n') { line++; column = 1; } else column++;
      }
      continue;
    }
    if (c === '<' && source.startsWith('<->', i)) { emit('<->', '<->', 3); continue; }
    if (c === '-' && source[i+1] === '>') { emit('->', '->', 2); continue; }
    if ('{}(),[]+*/'.includes(c) || c === '-' && !/[\d.]/.test(source[i+1] ?? '')) {
      emit(c, c, 1);
      continue;
    }
    if (c === '"') {
      let end = i + 1;
      while (end < source.length) {
        if (recover && source[end] === '\n') break;
        if (source[end] === '\\') {
          if (recover && source[end+1] === '\n') { end++; break; }
          end += 2; continue;
        }
        if (source[end] === '"') break;
        end++;
      }
      if (end >= source.length || source[end] !== '"') {
        invalid('Unclosed string',Math.min(end,source.length)-i);
        continue;
      }
      const raw = source.slice(i, end + 1);
      let value;
      try { value = JSON.parse(raw); }
      catch { invalid('Invalid string or escape sequence',raw.length); continue; }
      // In Unicode mode the surrogate range matches only unpaired code
      // units, leaving valid supplementary characters (including emoji) intact.
      if (invalidXML.test(value)) { invalid('String contains a Unicode character that is invalid in SVG',raw.length); continue; }
      emit('string', value, raw.length);
      continue;
    }
    if (c === '-' || c === '.' || c >= '0' && c <= '9') {
      numberAt.lastIndex = i;
      const number = numberAt.exec(source)?.[0];
      if (number) {
        const value = Number(number);
        if (!Number.isFinite(value)) { invalid('Number must be finite',number.length); continue; }
        emit('number', value, number.length);
        continue;
      }
    }
    wordAt.lastIndex = i;
    const word = wordAt.exec(source)?.[0];
    if (word) {
      // Leave the last hyphen for an arrow in a compact spelling like a->b.
      const value = word.endsWith('-') && source[i+word.length] === '>' ? word.slice(0, -1) : word;
      emit('word', value, value.length);
      continue;
    }
    invalid('Unexpected character ' + JSON.stringify(c),1);
  }
  tokens.push({ type:'eof', value:'', line, column });
  return tokens;
}
