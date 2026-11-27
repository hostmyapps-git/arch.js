import { ArchError } from './errors.js';

export const META_FORMATS = ['json', 'dsl'];
export function metaCommand(command, loc) {
  const match = command.match(/^@meta\s+(json|dsl)\s*$/);
  if (!match) throw new ArchError('Use @meta json or @meta dsl inside an architecture or view', loc, 'ARCH_META');
  return match[1];
}

export function validateMetaView(view) {
  if (view.meta === undefined) return false;
  const fail = message => { throw new ArchError(`View ${view.id}: ${message}`,view.loc,'ARCH_META'); };
  if (!META_FORMATS.includes(view.meta)) fail('meta must be json or dsl');
  if (view.diagram || view.trees || view.viewpoint || view.propertyFields!==undefined || view.include !== undefined || view.exclude !== undefined ||
      Object.keys(view.places).length || Object.keys(view.virtualPlaces ?? {}).length || Object.keys(view.styles).length || Object.keys(view.routes).length || Object.keys(view.virtualRoutes ?? {}).length || view.referenceRoutes?.length ||
      view.routeDefaults !== undefined || view.referenceDisplay !== undefined || view.referenceOccurrences !== undefined ||
      view.backgroundImage !== undefined || view.showBackgroundImage !== undefined ||
      view.direction !== 'right' || view.spacing !== 80)
    fail('meta views support a source format, theme and background color; model filters, viewpoints, diagrams and layout/style settings do not apply');
  return true;
}
