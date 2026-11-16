export class ArchError extends Error {
  constructor(message, loc = {}, code = 'ARCH_SYNTAX') {
    const detail = loc.path !== undefined ? `${message} (JSON path ${loc.path || '/'})` : message;
    super(loc.line ? `${detail} (line ${loc.line}, column ${loc.column})` : detail);
    this.name = 'ArchError';
    this.line = loc.line ?? null;
    this.column = loc.column ?? null;
    this.code = code;
    if (loc.path !== undefined) this.path = loc.path;
  }
}
