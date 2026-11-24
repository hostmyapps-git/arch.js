import { helpDocument, parseHelpCommand } from './help-syntax.js';
import { helpSVG, layoutHelp } from './help.js';
import { diagnosticProfile } from './diagnostic-help.js';

const isFollow = event => !event.defaultPrevented && event.button === 0 &&
  !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Attach to the current SVG rather than to the document. Multiple help
// blocks can then keep independent histories and inline profile contexts.
export function attachHelpNavigation(svg, graph, options = {}, onNavigate) {
  if (graph.kind!=='help') return svg;
  svg.addEventListener('click',event => {
    if (!isFollow(event)) return;
    const link = event.target.closest?.('a[data-arch-help-query]');
    if (!link || !svg.contains(link)) return;
    const query = link.getAttribute('data-arch-help-query');
    if (!svg.parentNode) return;
    const action = link.getAttribute('data-arch-help-action');
    const {back,forward} = graph.history;
    const history = action==='back' ? {back:back.slice(0,-1),forward:[...forward,graph.query]} :
      action==='forward' ? {back:[...back,graph.query],forward:forward.slice(0,-1)} :
      {back:[...back,graph.query].slice(-200),forward:[]};
    if (query===graph.query && action==='follow') { event.preventDefault(); return; }

    let next, markup;
    try {
      const model = {...helpDocument(parseHelpCommand(`@help ${query}`)), profile:graph.profile};
      model.views[0].theme=graph.view.theme;
      const nextOptions = {...options,theme:options.theme??svg.dataset.archSvg,helpHistory:history};
      next = layoutHelp(model,nextOptions);
      markup = helpSVG(next,nextOptions);
    } catch (error) {
      event.preventDefault();
      const owner = svg.ownerDocument;
      let status = svg.nextElementSibling;
      if (!status?.matches('[data-arch-help-error]')) {
        status=owner.createElement('p');
        status.dataset.archHelpError='';
        status.setAttribute('role','alert');
        svg.after(status);
      }
      status.textContent = error.message;
      return;
    }
    event.preventDefault();
    if (svg.nextElementSibling?.matches('[data-arch-help-error]')) svg.nextElementSibling.remove();
    const template=svg.ownerDocument.createElement('template');
    template.innerHTML=markup;
    const replacement=template.content.firstElementChild;
    svg.replaceWith(replacement);
    attachHelpNavigation(replacement,next,options,onNavigate);
    onNavigate?.({graph:next,previous:graph,svg:replacement,markup,action});
    replacement.focus({preventScroll:true});
    replacement.scrollIntoView({block:'start',inline:'nearest'});
  });
  return svg;
}

const diagnosticContexts = new WeakMap();

// The help dialog owns its own navigation history and leaves the preview and
// editor intact. A container can be updated when a host replaces its SVG.
export function attachDiagnosticHelp(container, context, options = {}) {
  const attached = diagnosticContexts.has(container);
  diagnosticContexts.set(container, {...options, profile:diagnosticProfile(context) ?? options.profile});
  if (attached) return container;
  container.addEventListener('click', event => {
    if (!isFollow(event)) return;
    const anchor = event.target.closest?.('a[data-arch-diagnostic-help]');
    if (!anchor || !container.contains(anchor)) return;
    const doc = container.ownerDocument, dialog = doc.createElement('dialog');
    if (typeof dialog.showModal !== 'function') return;
    const query = anchor.getAttribute('data-arch-diagnostic-help');
    const options = diagnosticContexts.get(container);
    const theme = options.theme ?? anchor.closest('svg[data-arch-svg]')?.getAttribute('data-arch-svg') ?? 'light';
    const dark = theme === 'dark';
    const helpOptions = {profile:options.profile, helpBaseURL:options.helpBaseURL, theme};
    const model = helpDocument(parseHelpCommand(`@help ${query}`));
    const graph = layoutHelp(model, helpOptions);
    const template = doc.createElement('template');
    template.innerHTML = helpSVG(graph, helpOptions);
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close help');
    close.title = 'Close help';
    close.autofocus = true;
    close.dataset.archCloseHelp = '';
    close.addEventListener('click', () => dialog.close());
    const styles = doc.createElement('style');
    const closeSelector = `[data-arch-diagnostic-dialog="${theme}"] > [data-arch-close-help]`;
    styles.textContent = `
      ${closeSelector} {
        position: sticky;
        top: 0;
        z-index: 1;
        display: grid;
        place-items: center;
        margin: 0 0 8px auto;
        box-sizing: border-box;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid ${dark ? '#475569' : '#cbd5e1'};
        border-radius: 50%;
        background: ${dark ? '#1e293b' : '#ffffff'};
        color: ${dark ? '#e2e8f0' : '#334155'};
        font: 500 22px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      ${closeSelector}:hover {
        border-color: ${dark ? '#818cf8' : '#6366f1'};
        background: ${dark ? '#312e81' : '#eef2ff'};
      }
      ${closeSelector}:focus-visible {
        outline: 2px solid ${dark ? '#a5b4fc' : '#4338ca'};
        outline-offset: 2px;
      }`;
    dialog.setAttribute('aria-label', 'Diagnostic help');
    dialog.dataset.archDiagnosticDialog = theme;
    dialog.style.cssText = 'box-sizing:border-box;width:min(68rem,calc(100vw - 2rem));max-width:none;max-height:calc(100vh - 2rem);padding:12px;overflow:auto;border:1px solid;border-radius:10px;font:14px system-ui,sans-serif';
    dialog.style.colorScheme = theme;
    dialog.style.backgroundColor = dark ? '#111827' : '#fafbfe';
    dialog.style.color = dark ? '#e2e8f0' : '#172033';
    dialog.append(styles, close, attachHelpNavigation(template.content.firstElementChild, graph, helpOptions));
    // Backdrop events target the dialog itself, as do clicks in its padding.
    const onBackdrop = ({target, clientX, clientY}) => {
      if (target !== dialog) return false;
      const {left, top, right, bottom} = dialog.getBoundingClientRect();
      return clientX < left || clientX >= right || clientY < top || clientY >= bottom;
    };
    let pressedBackdrop = false;
    dialog.addEventListener('pointerdown', event => {
      pressedBackdrop = event.button === 0 && onBackdrop(event);
    });
    dialog.addEventListener('click', event => {
      if (pressedBackdrop && onBackdrop(event)) dialog.close();
      pressedBackdrop = false;
    });
    dialog.addEventListener('close', () => dialog.remove(), {once:true});
    event.preventDefault();
    doc.body.append(dialog);
    dialog.showModal();
  });
  return container;
}
