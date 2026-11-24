import { helpHref, queryFor } from './help-syntax.js';
import { isCurrentProfile, isRegisteredProfileRevision } from './profiles.js';

// Keep the exact profile available for live help, including inline definitions,
// without copying it into diagnostics, layout data or standalone SVGs.
const profiles = new WeakMap();
export function rememberDiagnosticProfile(owner, profile) {
  if (profile) profiles.set(owner, profile);
  return owner;
}
export const diagnosticProfile = owner => profiles.get(owner);

export function profileHelp(profile, topic, name) {
  let selection = '.';
  if (isCurrentProfile(profile)) selection = profile.id;
  else if (isRegisteredProfileRevision(profile)) selection = `${profile.id}@${profile.version}`;
  return `@help ${queryFor(topic, selection, ...(name === undefined ? [] : [name]))}`;
}

const topicsByCode = {
  ARCH_HELP: '', ARCH_ICON: 'iconpacks', ARCH_JSON: 'json', ARCH_META: 'meta',
  ARCH_PROFILE: 'profiles', ARCH_VIEW_REUSE: 'views', ARCH_VIEWPOINT_RELATION: 'viewpoints',
  ARCH_STYLE: 'styles', ARCH_ROUTING: 'routing', ARCH_PLACEMENT: 'routing',
  ARCH_MAPPING_REVIEW: 'viewpoints', ARCH_MAPPING_HIDDEN: 'viewpoints',
  ARCH_MISSING_TYPE: 'relations', ARCH_RELATION_ENDPOINT_TYPE: 'relations', ARCH_UNKNOWN_TYPE: 'types',
};

export function diagnosticHelpLink(diagnostic, {format, helpBaseURL} = {}) {
  const command = diagnostic.help ?? `@help ${topicsByCode[diagnostic.code] ??
    (format === 'json' || diagnostic.path !== undefined ? 'json' : diagnostic.code === 'ARCH_SYNTAX' ? 'syntax' : 'model')}`;
  const query = command.slice('@help'.length).trim();
  return { query, href: helpHref(query, helpBaseURL), label: query ? `Open ${command.trim()}` : 'Open arch.js help' };
}

export function createDiagnosticHelpLink(doc, diagnostic, options) {
  const {query, href, label} = diagnosticHelpLink(diagnostic, options);
  const link = doc.createElement('a');
  link.href = href;
  link.dataset.archDiagnosticHelp = query;
  link.textContent = 'Open help';
  link.title = label;
  link.setAttribute('aria-label', label);
  link.style.cssText = 'text-decoration:underline;text-underline-offset:2px;color:inherit';
  return link;
}
