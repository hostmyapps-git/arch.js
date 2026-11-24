import { ArchError } from './errors.js';

const fail = (message, loc) => { throw new ArchError(message, {...loc, help:'@help views'}, 'ARCH_VALIDATION'); };

export function checkPresentationMode(mode, loc) {
  if (mode !== undefined && mode !== 'diagram' && mode !== 'dashboard')
    throw new ArchError('presentation must be diagram or dashboard', {...loc, help:'@help config'}, 'ARCH_VALIDATION');
}

export function viewIds(selection, views, loc) {
  if (!Array.isArray(views) || !views.length) fail('Invalid model; use parse(source)', loc);
  if (selection === undefined) return [views[0].id];
  if (selection === 'all') return views.map(view => view.id);
  const ids = typeof selection === 'string' ? [selection] : selection;
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !id))
    fail('views must be all, a view ID or a nonempty list of view IDs', loc);
  if (new Set(ids).size !== ids.length) fail('views must not contain duplicate view IDs', loc);
  const available = new Set(views.map(view => view.id));
  for (const id of ids) if (!available.has(id)) fail(`Unknown view: ${id}`, loc);
  return [...ids];
}
export function selectedViewIds(model, options = {}) {
  if (options.view !== undefined) {
    if (typeof options.view !== 'string' || !options.view) fail('view must be a view ID');
    // The singular API option always addresses an ID, including a view named all.
    return viewIds([options.view], model?.views);
  }
  return viewIds(options.views === undefined ? model?.config?.views : options.views, model?.views,
    options.views === undefined ? model?.config?.loc : undefined);
}
