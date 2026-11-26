import { createRuntime } from './runtime.js';

export { ArchError, parse, parsePreview } from './parser.js';
export { registerProfile, getProfiles, getProfile, getProfileVersions } from './profiles.js';
export { registerIconPack, getIconPacks } from './icons.js';
export { renderIconToString } from './svg.js';
export { translate } from './source.js';
export const version = '0.1.0';

export const { layout, validate, renderToString, renderDiagram, render, renderAll, renderMarkdown } =
  /* @__PURE__ */ createRuntime();
