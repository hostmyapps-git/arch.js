import { ArchError } from './errors.js';
import { modelSource } from './source.js';
import { getProfile } from './profiles.js';
import { getIcon } from './icons.js';
import { iconifyMarkup } from './iconify.js';
import { registerBackgroundImages } from './background-images.js';
import { imageBaker } from './diagram-export/images.js';

export const canExportStudio = typeof __archStudioRuntime === 'function' && typeof __ARCH_STUDIO_SHELL__ === 'string';
const restoredIcons = new WeakMap();

export function downloadHTML(document, title, html, suffix = '') {
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'architecture';
  downloadFile(document,{name:name+suffix+'.html',data:html,mimeType:'text/html;charset=utf-8'});
}

export function downloadFile(document, {name,data,mimeType}) {
  const browser = document.defaultView;
  const url = browser.URL.createObjectURL(new browser.Blob([data],{type:mimeType}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  browser.setTimeout(() => browser.URL.revokeObjectURL(url),1000);
}

export const htmlJSON = data => JSON.stringify(data).replace(/</g,'\\u003c');
export const exportRevision = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function modelAssets(model, profile) {
  const names = new Set(), images = new Set();
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.icon==='string') names.add(value.icon);
    if (typeof value.backgroundImage==='string' && !value.backgroundImage.startsWith('data:')) images.add(value.backgroundImage);
    for (const [key, field] of Object.entries(value))
      if (!['loc','attributeLocs','profile'].includes(key)) collect(field);
  }
  collect(model);
  collect(profile?.nodeTypes);
  const packs = new Map();
  for (const name of names) {
    const [pack,id] = name.split('.');
    if (pack==='core') continue;
    let icon;
    try { icon = getIcon(name); }
    catch (error) {
      if (!(error instanceof ArchError)) throw error;
      continue; // Keep unresolved icon diagnostics in the editable document.
    }
    if (!packs.has(pack)) packs.set(pack, Object.create(null));
    packs.get(pack)[id] = restoredIcons.get(icon) ?? (icon.tree
      ? {width:icon.width,height:icon.height,body:iconifyMarkup(icon,'icon',{clip:false})}
      : icon);
  }
  return {icons:[...packs].map(([name,icons])=>[name,{icons}]),images};
}

export function restoreStudioDependencies({profiles,icons,images}, registerProfile, registerIconPack) {
  for (const profile of profiles) registerProfile(profile.id,profile);
  for (const [name,pack] of icons) {
    registerIconPack(name,pack);
    for (const [id,definition] of Object.entries(pack.icons))
      restoredIcons.set(getIcon(`${name}.${id}`),definition);
  }
  registerBackgroundImages(images);
}

export async function portableStudio(prepared, originalSource, options) {
  if (!canExportStudio) throw new ArchError('Studio export requires the built arch.min.js bundle',{},'ARCH_STUDIO_EXPORT');
  const {model,profile,report} = prepared;
  const source = typeof originalSource==='string' ? originalSource :
    originalSource ? JSON.stringify(originalSource,null,2) : modelSource(model,'dsl');
  const profiles = new Map();
  const add = definition => {
    const key = `${definition.id}@${definition.version}`;
    if (key!=='default@1') profiles.set(key,definition);
    return key;
  };
  const declared = model.config?.profile;
  let declaredRevision;
  if (declared) {
    try { declaredRevision = add(getProfile(declared)); }
    catch (error) { if (!(error instanceof ArchError) || options.profile===undefined) throw error; }
  }
  let profileOverride;
  if (profile && (declared || options.profile!==undefined || !model.config?.definition && profile.id!=='default')) {
    const active = add(profile);
    if (options.profile!==undefined || active!==declaredRevision) profileOverride = active;
  }
  const {icons,images} = modelAssets(model,profile);
  const {resolve} = imageBaker(options);
  const files = await Promise.all([...images].map(async source=>[source,await resolve(source)]));
  const data = htmlJSON({ source,title:report.title,view:options.view ?? report.initialView ?? report.views[0]?.id,
    theme:options.theme, profile:profileOverride, profiles:[...profiles.values()],icons,images:files,
    notes:options.notes,notesKey:options.notesKey,revision:exportRevision() });
  const script = (value) => `<script>${value.replace(/<\/script/gi,'<\\/script')}</script>`;
  const boot = `window.ARCH_STUDIO_WORKSPACE = JSON.parse(document.getElementById('studio-workspace').textContent);
arch.restoreStudioDependencies(ARCH_STUDIO_WORKSPACE);
document.title = ARCH_STUDIO_WORKSPACE.title + ' · arch.js Studio';
window.ARCH_EXAMPLES = [
  {id:'workspace',title:ARCH_STUDIO_WORKSPACE.title,subtitle:'Editable architecture',source:ARCH_STUDIO_WORKSPACE.source},
  {id:'help',title:'Language reference',subtitle:'Browse the built-in help',source:'@help'}
];
window.ARCH_ICON_PACKS = [];`;
  const inline = `<script type="application/json" id="studio-workspace">${data}</script>\n` +
    script(__archStudioRuntime.toString()+'\nvar arch = __archStudioRuntime();')+script(boot)+script(__ARCH_STUDIO_APP__);
  return __ARCH_STUDIO_SHELL__.replace('</body>',() => inline+'\n</body>');
}
