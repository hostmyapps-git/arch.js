export const DIAGRAMS = ['connected','tree','sequence','state','activity','matrix','heatmap','timeline','class','table','sankey','viewpointGrid','nafgrid'];
export const GRID_MODES = ['count','list','none'];
export const GRID_OPTIONS = ['products','diagrams','show','viewpoints'];
export const GRID_VISIBILITY = ['all','selected','modeled','coverage'];
export const GRID_VISIBILITY_ERROR = 'show must be all, selected, modeled or coverage';

export function isGridDiagram(type, profile) {
  return type==='nafgrid' || type==='viewpointGrid' || Object.hasOwn(profile?.diagrams ?? {},type);
}

export function gridDefinition(type, profile) {
  if (type==='nafgrid') return profile.viewpointGrid;
  return profile.diagrams?.[type]?.layout;
}
