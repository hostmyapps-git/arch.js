import { ArchError } from './errors.js';
import { profileHelp, rememberDiagnosticProfile } from './diagnostic-help.js';
import { normalizeColor } from './colors.js';
import { request as helpRequest } from './help-syntax.js';
import { validateMetaView } from './meta-syntax.js';
import { indexGraph } from './graph-index.js';
import { resolveViewReuse } from './view-reuse.js';
import { isGridDiagram } from './diagram-types.js';
import { checkPresentationMode, viewIds } from './view-selection.js';
import { TEMPLATES, matches, resolveProfile } from './profiles.js';
import { profileDiagnostics, viewpointRelationshipMessage } from './profile-validation.js';
import { validationMode, validationDiagnostics } from './validation-mode.js';
import { validateBackgroundImage } from './background-images.js';
import { validateViewRoutes } from './route-validation.js';
import { validateTreeGroups } from './tree-groups.js';
import { diagramOptionName, validateDiagramView } from './diagrams.js';
import { STYLE_NUMBERS, checkStyleNumber, styleExpressionPlan } from './style-expressions.js';
import { expandRelativePlacements, placementPlan } from './placement.js';
import { validateClassPlacement } from './class-placement.js';
import { viaReferences } from './via.js';
import { bindPresentation, occurrenceCatalogs, findCard } from './view-occurrences.js';
import { hasOmittedModelDeclarations, isPreviewRecoveryEnabled } from './syntax-recovery.js';

const fail = (message, loc) => { throw new ArchError(message, loc, 'ARCH_VALIDATION'); };

// This context belongs to one operation. Public models are editable, so a new
// operation validates the current input even if it came from parse().
export function validatePreviewModel(model, options, profile, sharedChecks) {
  return validateModel(model, options, profile, {
    partialModel: hasOmittedModelDeclarations(model),
    recoverViewpoints: options.syntaxRecovery !== false && isPreviewRecoveryEnabled(model),
    sharedChecks
  });
}

export function validateModel(model, options = {}, profile, {partialModel, recoverViewpoints, sharedChecks} = {}) {
  if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views) || !model.views.length)
    fail('Invalid model; use parse(source)');
  checkPresentationMode(model.config?.presentation, model.config?.loc);
  const showRouteStereotypes = model.config?.showRouteStereotypes;
  if (showRouteStereotypes !== undefined && typeof showRouteStereotypes !== 'boolean')
    fail('showRouteStereotypes must be true or false',{...model.config.loc,help:'@help config'});
  // Older parse() results can still reach layout() as editable model data.
  const usesLegacyFinal = ({diagram}) => diagram && Object.hasOwn(diagram,'finals') && diagramOptionName(diagram.type,'finals')==='final';
  if (model.views.some(usesLegacyFinal)) model = {...model,views:model.views.map(view => {
    if (!usesLegacyFinal(view)) return view;
    const {finals,...diagram}=view.diagram;
    if (Object.hasOwn(diagram,'final')) fail('Duplicate diagram option: final',view.loc);
    return {...view,diagram:{...diagram,final:finals}};
  })};
  const omittedByView = recoverViewpoints ? new Map() : undefined;
  let omitRelationship;
  if (recoverViewpoints) {
    profile ??= resolveProfile(model, options);
    omitRelationship = (view, edge) => {
      const rules = profile.viewpoints[view.viewpoint];
      const type = edge.type ?? profile.defaultRelation;
      if (!rules || view.meta !== undefined || matches(type, rules.relations, profile.relationTypes)) return false;
      if (!omittedByView.has(view.id)) omittedByView.set(view.id, []);
      omittedByView.get(view.id).push({ severity:'error', code:'ARCH_VIEWPOINT_RELATION', elementId:edge.id, viewId:view.id,
        message:viewpointRelationshipMessage(view, edge, type), line:edge.loc?.line, column:edge.loc?.column,
        help:profileHelp(profile, 'viewpoints', view.viewpoint) });
      return true;
    };
  }
  const graph = indexGraph(model, omitRelationship);
  profile ??= resolveProfile(model, options);
  model = resolveViewReuse(model, graph, profile);
  let mode=validationMode(model,options);
  if (model.kind === 'help') {
    helpRequest(model.help?.topic, model.help?.parameters);
    return { model, profile, mode, diagnostics: [] };
  }
  const ids = new Set(), { nodesById: nodes, edgesById: edges } = graph;
  for (const item of [...model.nodes, ...model.edges]) {
    if (ids.has(item.id)) fail(`Duplicate ID: ${item.id}`, item.loc);
    ids.add(item.id);
  }
  for (const node of model.nodes) {
    validateBackgroundImage(node.backgroundImage, node.attributeLocs?.backgroundImage ?? node.loc);
    if (node.parent && !nodes.has(node.parent)) fail(`Unknown container: ${node.parent}`, node.loc);
    const ancestry = new Set([node.id]);
    let parent = nodes.get(node.parent);
    while (parent) {
      if (ancestry.has(parent.id)) fail(`Cyclic package hierarchy: ${node.id}`, node.loc);
      ancestry.add(parent.id); parent = nodes.get(parent.parent);
    }
  }
  for (const edge of model.edges) {
    for (const id of [edge.source, edge.target]) if (!nodes.has(id)) fail(`Unknown endpoint: ${id}`, edge.loc);
  }
  const views = new Map();
  for (const view of model.views) {
    if (views.has(view.id)) fail(`Duplicate view ID: ${view.id}`, view.loc);
    views.set(view.id, view);
  }
  const getCatalog = occurrenceCatalogs(graph, views, profile);
  const viewCatalogue = model._viewCatalogue;
  for (const view of model.views) {
    if (!['right', 'down'].includes(view.direction)) fail('direction must be right or down', view.loc);
    if (!['light', 'dark'].includes(view.theme)) fail('theme must be light or dark', view.loc);
    if (view.represents !== undefined && !nodes.has(view.represents))
      fail(`Unknown element represented by view ${view.id}: ${view.represents}`,view.loc);
    if(validateMetaView(view)) continue;
    validateBackgroundImage(view.backgroundImage, view.loc);
    if (view.showBackgroundImage !== undefined && typeof view.showBackgroundImage !== 'boolean') fail('showBackgroundImage must be true or false', view.loc);
    if (view.referenceDisplay !== undefined && !['labels', 'nodes', 'both'].includes(view.referenceDisplay)) fail('referenceDisplay must be labels, nodes or both', view.loc);
    if (view.referenceOccurrences !== undefined && !['shared', 'perEdge'].includes(view.referenceOccurrences)) fail('referenceOccurrences must be shared or perEdge', view.loc);
    if (!Number.isFinite(view.spacing) || view.spacing < 24 || view.spacing > 400) fail('spacing must be between 24 and 400', view.loc);
    for (const key of ['include', 'exclude']) if (view[key] !== undefined && (!Array.isArray(view[key]) || view[key].some(id => typeof id !== 'string')))
      fail(`${key} requires a list of ${key === 'exclude' ? 'element or relationship' : 'element'} IDs`, view.loc);
    for (const id of view.include ?? [])
      if (!nodes.has(id)) fail(`Unknown element in view ${view.id}: ${id}`, view.loc);
    for (const id of view._gridIncludes ?? []) {
      const selected = views.get(id) ?? viewCatalogue?.get(id);
      if (selected && !nodes.has(id) && (selected.meta!==undefined || isGridDiagram(selected.diagram?.type,profile)))
        fail(`Grid ${view.id} requires a diagram view in include: ${id}`,view.loc);
    }
    for (const id of view.exclude ?? [])
      if (!nodes.has(id) && !edges.has(id)) fail(`Unknown element or relationship in view ${view.id}: ${id}`, view.loc);
    const catalog = view.embeddings ? getCatalog(view) : undefined;
    for (const id of Object.keys(view.places)) {
      const card = findCard(catalog, id, view.places[id].loc);
      if (card?.owner) fail(`Embedded card ${id} is positioned by its source view; place ${card.owner} or extend the source view`, view.places[id].loc);
      if(!nodes.has(id)&&!Object.hasOwn(view.trees??{},id))fail(`Unknown element or tree group in view ${view.id}: ${id}`,view.loc);
    }
    for (const [id, place] of Object.entries(view.places))
      if (place.size && (place.size.x < 160 || place.size.y < 96)) fail(`Size of ${id} must be at least (160, 96)`, place.loc);
    for (const [id, style] of Object.entries(view.styles)) {
      const embedded = catalog?.byName.get(id)?.find(card => card.owner);
      if (embedded) fail(`Embedded card ${id} is styled by its source view; extend the source view to change it`, style.loc);
      if(!nodes.has(id)) {
        if(!edges.has(id))fail(`Unknown element or relationship in view ${view.id}: ${id}`,style.loc);
        if(Object.keys(style).some(k=>!['loc','display'].includes(k))||!['none','standard'].includes(style.display))fail('Relationship styles support only display none or standard',style.loc);
        continue;
      }
      for (const field of STYLE_NUMBERS) if (style[field] !== undefined)checkStyleNumber(style[field],field,style.loc);
      for (const key of ['showBackgroundImage', 'showIcon', 'showLabel', 'showStereotype', 'showDescription', 'showTechnology']) if (style[key] !== undefined && typeof style[key] !== 'boolean') fail(`${key} must be true or false`, style.loc);
      if (style.iconPosition !== undefined && !['top', 'left', 'bottom', 'right'].includes(style.iconPosition)) fail('iconPosition must be top, left, bottom or right', style.loc);
      if (style.display !== undefined && !['standard', 'logo', 'none'].includes(style.display)) fail('display must be standard, logo or none', style.loc);
      if (style.display === 'logo' && profile.nodeTypes[nodes.get(id).type]?.container) fail('logo display is only supported for non-container elements', style.loc);
      if (style.opacity !== undefined && (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)) fail('opacity must be a number between 0 and 1', style.loc);
      if (style.template !== undefined && (!TEMPLATES.includes(style.template) || !!profile.nodeTypes[nodes.get(id).type]?.container !== (style.template === 'package')))
        fail(`Invalid template for ${id}: ${style.template}`, style.loc);
      if (style.accent !== undefined && !normalizeColor(style.accent)) fail('accent requires a hex color or CSS3 color name', style.loc);
      if (style.backgroundColor !== undefined && !normalizeColor(style.backgroundColor)) fail('backgroundColor requires a hex color or CSS3 color name', style.loc);
      validateBackgroundImage(style.backgroundImage, style.loc);
    }
    validateViewRoutes(view, profile, graph, catalog);
  }
  viewIds(model.config?.views, model.views, model.config?.loc);
  let checks = sharedChecks?.get(profile);
  if (sharedChecks && !checks) sharedChecks.set(profile,checks = {});
  const findings = profileDiagnostics(model, profile, graph, checks);
  // Dropping a declaration can temporarily break minimum counts and
  // required mappings in otherwise useful views. The preview still checks
  // hard constraints and displays these incomplete requirements as notices.
  if (partialModel && findings.some(diagnostic => diagnostic.incomplete)) mode = 'draft';
  let diagnostics = validationDiagnostics(findings, mode);
  if (mode !== 'draft' && omittedByView?.size) diagnostics = diagnostics.map(diagnostic =>
    diagnostic.severity === 'error' && diagnostic.incomplete && omittedByView.has(diagnostic.viewId)
      ? {...diagnostic, severity:'warning'} : diagnostic);
  const firstError = diagnostics.find(d => d.severity === 'error');
  if (firstError) {
    const error = new ArchError(firstError.message, firstError, firstError.code);
    error.diagnostics = diagnostics;
    throw rememberDiagnosticProfile(error, profile);
  }
  const plans = new Map();
  for (const authoredView of model.views) {
    if (authoredView.meta !== undefined) continue;
    const view = expandRelativePlacements(authoredView);
    if (view !== authoredView) views.set(view.id, view);
    validateTreeGroups(profile, view, graph);
    const statePlacement=validateDiagramView(profile, view, graph);
    const presentation = view.embeddings || Object.values(view.routes).some(route => route.source !== undefined || route.target !== undefined)
      ? bindPresentation(graph, profile, view, getCatalog(view)) : null;
    const styles = styleExpressionPlan(graph, profile, view, presentation);
    const placement = view.diagram?.type === 'class'
      ? validateClassPlacement(profile, view, graph)
      : view.diagram?.type === 'state' ? null : placementPlan(graph, profile, view, false, presentation);
    const routeReferences = view.diagram?.type === 'state' ? null : viaReferences(graph, profile, view, presentation);
    plans.set(view.id, { styles, placement, routeReferences, presentation, statePlacement });
  }
  return { model, profile, mode, diagnostics, views, graph, plans, omittedByView };
}
