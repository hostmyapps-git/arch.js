export class ArchError extends Error {
  constructor(message, loc = {}, code = 'ARCH_SYNTAX') {
    super(loc.line ? `${message} (Zeile ${loc.line}, Spalte ${loc.column})` : message);
    this.name = 'ArchError';
    this.line = loc.line ?? null;
    this.column = loc.column ?? null;
    this.code = code;
  }
}
