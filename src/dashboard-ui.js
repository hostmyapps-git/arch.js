// This function also runs in exported HTML. Keep its runtime dependencies in
// the arguments and its helpers inside the function.
export function dashboardUI(root, report, options = {}) {
  const document = root.ownerDocument;
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (label, action, className = 'ad-button') => {
    const node = create('button',className,label);
    node.type = 'button';
    node.addEventListener('click',action);
    return node;
  };
  const byView = new Map(report.views.map(view => [view.id,view]));
  const viewPositions = new Map(report.views.map((view,index) => [view.id,index]));
  const byElement = new Map(report.elements.map(element => [element.id,element]));
  const byRelation = new Map(report.relationships.map(relationship => [relationship.id,relationship]));
  const reuse = new Map(), related = new Map(), linked = new Map(), incoming = new Map();
  function index(map, key, value) {
    if (!map.has(key)) map.set(key,[]);
    map.get(key).push(value);
  }
  for (const view of report.views) {
    const visible = new Set([...view.visibleElements,...view.visibleRelationships]);
    for (const id of [...view.elements,...view.relationships]) index(reuse,id,{view,visible:visible.has(id)});
    if (view.represents) index(linked,view.represents,view);
  }
  for (const relation of report.relationships) {
    for (const id of new Set([relation.source,relation.target])) index(related,id,relation);
  }
  for (const item of [...report.elements,...report.relationships])
    for (const ref of item.references ?? []) index(incoming,ref.id,{item,attribute:ref.attribute});

  const preferred = options.view ?? report.initialView;
  const started = byView.has(preferred) ? preferred : report.views[0]?.id;
  const history = [{view:started, kind:'views', id:started}];
  const rendered = new Map();
  const glyphSelector = '[data-node],[data-edge],[data-label-for],[data-view-link],[data-grid-tile]';
  const diagramItems = new Map();
  const glyphsByKind = {views:new Map(),elements:new Map(),relationships:new Map(),tiles:new Map()};
  const tiles = new Map();
  let position = 0, tab = 'views', zoom = 1, presenting = false;
  let lastView, highlighted, helpDialog;
  let showingSource = false, sourceFormat = 'dsl', lastSourceView, lastSourceFormat, sourceText;
  const current = () => history[position];
  root.classList.add('arch-dashboard');
  const header = create('header','ad-header');
  const heading = create('div');
  heading.append(create('h1',null,report.title));
  if (report.description) heading.append(create('p','ad-model-description',report.description));
  if (report.profile) heading.append(create('p','ad-profile',[report.profile.id, report.profile.version].filter(Boolean).join(' · ')));
  const actions = create('div','ad-actions');
  const present = button('Present',togglePresentation,'ad-button ad-primary');
  present.setAttribute('aria-pressed','false');
  actions.append(present);
  actions.append(button('Help',() => openHelp('')));
  const notesButton = button('Notes',() => openNotes());
  const notesBadge = create('span','ad-notes-badge');
  notesBadge.setAttribute('aria-hidden','true');
  notesButton.append(notesBadge);
  actions.append(notesButton);
  if (options.onExport) actions.append(exportButton('Download HTML',options.onExport));
  if (options.onExportStudio) actions.append(exportButton('Download Studio',options.onExportStudio));
  if (options.onDiagramExport) {
    const menu = create('details','ad-export-menu');
    const summary = create('summary','ad-button','Export diagram');
    const formats = create('div','ad-export-formats');
    for (const [format,title] of [['svg','SVG'],['drawio','draw.io'],['vsdx','Visio'],['excalidraw','Excalidraw']]) {
      formats.append(exportButton(`Export ${title}`,async view => {
        menu.open = false;
        summary.focus();
        await options.onDiagramExport(view,format);
      }));
    }
    menu.append(summary,formats);
    actions.append(menu);
  }
  if (options.onEditSource) actions.append(button('Edit source',() => options.onEditSource(current().view)));
  if (options.onClose) actions.append(button('Close',options.onClose));
  header.append(heading,actions);
  const exportStatus = create('p','ad-export-status');
  exportStatus.setAttribute('role','status');
  exportStatus.hidden = true;
  const {notes, notesDialog, openNotes, refreshNotes} = setupNotes();

  const body = create('div','ad-body');
  const catalog = create('nav','ad-catalog');
  catalog.setAttribute('aria-label','Architecture catalog');
  const controls = create('div','ad-catalog-controls');
  const search = create('input','ad-search');
  search.type = 'search';
  search.placeholder = 'Search names, types, or IDs';
  search.setAttribute('aria-label','Search architecture');
  search.addEventListener('input',drawCatalog);
  const tabs = create('div','ad-tabs');
  const buckets = {views:report.views,elements:report.elements,relationships:report.relationships};
  const tabButtons = new Map();
  for (const [key,title] of [['views','Views'],['elements','Elements'],['relationships','Relations']]) {
    const toggle = button(`${title} ${buckets[key].length}`,() => { tab = key; drawCatalog(); });
    toggle.className = '';
    tabButtons.set(key,toggle);
    tabs.append(toggle);
  }
  controls.append(search,tabs);
  const results = create('div','ad-results');
  const searchFields = new WeakMap();
  let listedTab, listedQuery, listedRows, currentRow;
  let listedNoteButtons = new Map();
  catalog.append(controls,results);

  const main = create('section','ad-main');
  main.setAttribute('aria-label','View content');
  const toolbar = create('div','ad-viewbar');
  const viewTitle = create('div');
  const title = create('h2'), type = create('div','ad-meta');
  title.setAttribute('aria-live','polite');
  viewTitle.append(title,type);
  const viewActions = create('div','ad-view-actions');
  const back = button('Back',() => travel(-1));
  const forward = button('Forward',() => travel(1));
  const previous = button('‹',() => stepView(-1)), next = button('›',() => stepView(1));
  previous.setAttribute('aria-label','Previous view');
  next.setAttribute('aria-label','Next view');
  back.dataset.author = forward.dataset.author = '';
  const zoomOut = button('−',() => scale(zoom / 1.25)), fit = button('Fit',() => scale(1)), zoomIn = button('+',() => scale(zoom * 1.25));
  zoomOut.setAttribute('aria-label','Zoom out');
  zoomIn.setAttribute('aria-label','Zoom in');
  viewActions.append(back,forward,previous,next,zoomOut,fit,zoomIn);
  toolbar.append(viewTitle,viewActions);
  const canvas = create('div','ad-canvas'), diagram = create('div','ad-diagram');
  canvas.append(diagram);
  const modes = create('div','ad-tabs ad-view-modes');
  modes.setAttribute('role','group');
  modes.setAttribute('aria-label','View display');
  const showDiagram = button('Diagram',() => { showingSource = false; paint(); });
  const showSource = button('Source',() => { showingSource = true; paint(); });
  modes.append(showDiagram,showSource);
  const sourcePane = create('section','ad-source');
  sourcePane.setAttribute('aria-label','View source');
  const sourceBar = create('div','ad-source-bar'), formats = create('div','ad-tabs');
  formats.setAttribute('role','group');
  formats.setAttribute('aria-label','Source format');
  const formatButtons = new Map();
  for (const [id,label] of [['dsl','DSL'],['json','JSON']]) {
    const toggle = button(label,() => { sourceFormat = id; drawSource(byView.get(current().view)); });
    formatButtons.set(id,toggle);
    formats.append(toggle);
  }
  const copyStatus = create('span','ad-meta');
  copyStatus.setAttribute('role','status');
  const copy = button('Copy source',copySource);
  const sourceActions = create('div','ad-view-actions');
  sourceActions.append(copyStatus,copy);
  sourceBar.append(formats,sourceActions);
  const sourceScroll = create('pre','ad-source-code'), code = create('code');
  sourceScroll.tabIndex = 0;
  sourceScroll.setAttribute('aria-label','Source code');
  sourceScroll.append(code);
  const sourceError = create('p','ad-empty');
  sourcePane.append(sourceBar,sourceScroll,sourceError);
  const openFromDiagram = event => {
    const item = diagramItems.get(event.target.closest?.(glyphSelector));
    if (item?.kind==='views') openView(item.id);
    else if (item) openItem(item.kind,item.id);
  };
  diagram.addEventListener('click',openFromDiagram);
  diagram.addEventListener('keydown',event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[role=button]')) {
      event.preventDefault();
      openFromDiagram(event);
    }
  });
  main.append(toolbar,modes,canvas,sourcePane);
  const inspector = create('aside','ad-inspector');
  inspector.setAttribute('aria-label','Architecture details');
  body.append(catalog,main,inspector);
  root.replaceChildren(header,exportStatus,body,notesDialog);
  root.addEventListener('keydown', event => {
    if (helpDialog?.open || notesDialog.open) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !presenting) {
      event.preventDefault(); search.focus();
    }
    if (!presenting || sourceScroll.contains(event.target) || !['ArrowLeft','ArrowRight'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    stepView(event.key === 'ArrowLeft' ? -1 : 1);
  });
  refreshNotes();
  paint();

  function exportButton(label, run) {
    const control = button(label,async () => {
      control.disabled = true;
      exportStatus.hidden = false;
      exportStatus.textContent = 'Preparing download…';
      try {
        await run(current().view,{architecture:notes.architecture,views:{...notes.views}});
        exportStatus.textContent = 'Download ready';
      } catch (error) {
        exportStatus.textContent = error.message;
      } finally {
        control.disabled = false;
      }
    });
    return control;
  }

  function setupNotes() {
    const key = options.notesKey;
    let storage, stored, storageFailed = false;
    if (key) {
      try {
        storage = document.defaultView.localStorage;
        stored = JSON.parse(storage.getItem(key));
      } catch {
        storageFailed = true;
      }
    }
    const initial = stored?.version===1 ? stored : options.notes;
    const notes = {architecture:typeof initial?.architecture==='string' ? initial.architecture : '',views:Object.create(null)};
    for (const [id,text] of Object.entries(initial?.views ?? {}))
      if (typeof text==='string') notes.views[id] = text;
    const notesDialog = create('dialog','ad-notes');
    notesDialog.setAttribute('aria-label','Architecture notes');
    const bar = create('div','ad-notes-header');
    bar.append(create('h2',null,'Notes'),button('Close notes',() => notesDialog.close()));
    const noteLinks = create('nav','ad-note-links');
    noteLinks.setAttribute('aria-label','Jump to saved note');
    const status = create('p','ad-meta');
    status.setAttribute('role','status');
    const state = () => storageFailed ? 'Browser storage unavailable. Notes are included in downloads.' :
      storage ? 'Saved in this browser' : 'Notes are included in downloads.';
    const architectureLabel = create('label','ad-note-field','Architecture notes');
    const viewLabel = create('label','ad-note-field');
    const viewCaption = create('span');
    const architecture = create('textarea'), view = create('textarea');
    architecture.rows = view.rows = 5;
    architectureLabel.append(architecture);
    viewLabel.append(viewCaption,view);
    notesDialog.append(bar,noteLinks,architectureLabel,viewLabel,status);
    let viewId;
    function refreshNotes() {
      const annotated = Object.keys(notes.views).filter(id => notes.views[id].trim());
      const hasArchitectureNote = Boolean(notes.architecture.trim());
      const count = annotated.length + Number(hasArchitectureNote);
      notesBadge.hidden = count===0;
      notesBadge.textContent = String(count);
      notesButton.setAttribute('aria-description',count===0 ? 'No notes yet' : `${count} saved note${count===1 ? '' : 's'}`);
      const links = hasArchitectureNote ? [button('Architecture',() => architecture.focus(),'ad-link')] : [];
      for (const id of annotated) {
        const name = byView.get(id)?.title || id;
        links.push(button(name,() => jumpToViewNote(id),'ad-link'));
      }
      noteLinks.replaceChildren(...links);
      noteLinks.hidden = !links.length;
      for (const [id,control] of listedNoteButtons) control.hidden = !notes.views[id]?.trim();
    }
    function save() {
      if (storage) {
        try {
          storage.setItem(key,JSON.stringify({version:1,...notes}));
        } catch {
          storageFailed = true;
        }
      }
      options.onNotes?.({architecture:notes.architecture,views:{...notes.views}});
      status.textContent = state();
      refreshNotes();
    }
    architecture.addEventListener('input',() => { notes.architecture = architecture.value; save(); });
    view.addEventListener('input',() => {
      if (view.value) notes.views[viewId] = view.value;
      else delete notes.views[viewId];
      save();
    });
    function openNotes(id, focusView = false) {
      viewId = id ?? current().view;
      const selectedView = byView.get(viewId);
      viewLabel.hidden = !viewId;
      viewCaption.textContent = viewId ? `View notes · ${selectedView ? label(selectedView) : viewId}` : '';
      architecture.value = notes.architecture;
      view.value = notes.views[viewId] ?? '';
      status.textContent = state();
      if (!notesDialog.open) notesDialog.showModal();
      if (focusView) view.focus();
    }
    return {notes,notesDialog,openNotes,refreshNotes};
  }

  function jumpToViewNote(id) {
    openView(id);
    openNotes(id,true);
  }

  function drawSource(view) {
    if (lastSourceView===view.id && lastSourceFormat===sourceFormat) return;
    lastSourceView = view.id;
    lastSourceFormat = sourceFormat;
    for (const [id,toggle] of formatButtons) toggle.setAttribute('aria-pressed',String(id===sourceFormat));
    sourceText = undefined;
    let message;
    try {
      if (options.viewSource) sourceText = options.viewSource(view.id,sourceFormat);
      else {
        const entry = options.sources && Object.hasOwn(options.sources,view.id) ? options.sources[view.id] : undefined;
        sourceText = entry?.[sourceFormat];
        message = entry?.error;
      }
    } catch (error) { message = error.message; }
    copyStatus.textContent = '';
    copy.disabled = sourceScroll.hidden = sourceText===undefined;
    sourceError.hidden = sourceText!==undefined;
    sourceError.textContent = message ?? 'Source is unavailable for this view.';
    const fragment = document.createDocumentFragment();
    if (sourceText!==undefined) {
      for (const token of options.sourceTokens(sourceText,sourceFormat)) {
        if (token.kind==='plain') fragment.append(token.text);
        else fragment.append(create('span',`ad-code-${token.kind}`,token.text));
      }
    }
    code.className = sourceFormat==='dsl' ? 'language-arch' : 'language-json';
    code.replaceChildren(fragment);
    sourceScroll.scrollTo(0,0);
  }

  async function copySource() {
    if (sourceText===undefined) return;
    const text = sourceText;
    try {
      await document.defaultView.navigator.clipboard.writeText(text);
      if (text===sourceText) copyStatus.textContent = 'Copied';
    } catch {
      if (text!==sourceText || !showingSource) return;
      sourceScroll.focus();
      const selection = document.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      copyStatus.textContent = 'Selected for copying';
    }
  }

  function openHelp(query) {
    if (helpDialog?.open) return;
    const history = [query.replace(/^@help\s*/,'')];
    let index = 0;
    const dialog = create('dialog','ad-help');
    helpDialog = dialog;
    dialog.setAttribute('aria-label','Architecture help');
    const header = create('div','ad-help-header');
    const heading = create('h2');
    const controls = create('div','ad-view-actions');
    const back = button('Back',() => { index--; showPage(); });
    const forward = button('Forward',() => { index++; showPage(); });
    const home = button('Help home',() => follow(''));
    const close = button('Close help',() => dialog.close());
    controls.append(back,forward,home,close);
    header.append(heading,controls);
    const article = create('div','ad-help-body');
    dialog.append(header,article);
    dialog.addEventListener('close',() => { dialog.remove(); helpDialog=undefined; },{once:true});
    root.append(dialog);
    showPage();
    dialog.showModal();
    close.focus();

    function follow(next) {
      if (next===history[index]) return;
      history.splice(index+1,history.length,next);
      index++;
      showPage();
    }
    function showPage() {
      const selected = history[index];
      let page, note;
      try {
        if (options.getHelp) page=options.getHelp(selected);
        else {
          const pages = options.helpPages;
          page = pages && Object.hasOwn(pages, selected) ? pages[selected] : pages?.[selected.split(' ')[0]];
          if (!pages || !Object.hasOwn(pages, selected)) note='This export includes help for the architecture and the main reference topics. Use the live reference for this detail.';
        }
      } catch (error) { note=error.message; }
      heading.textContent=page?.title ?? 'Architecture help';
      back.disabled=index===0;
      forward.disabled=index===history.length-1;
      home.disabled=!selected;
      article.replaceChildren();
      if (note) article.append(create('p','ad-meta',note));
      for (const section of page?.sections ?? []) {
        if (!section.lines.length) continue;
        const block=create('section');
        block.append(create('h3',null,section.title));
        drawHelpSection(block,section,follow);
        article.append(block);
      }
      article.scrollTop=0;
    }
  }

  function drawHelpSection(block,{lines,format,lineStyles,links},follow) {
    const codeBlock = (code,language) => {
      const pre=create('pre');
      pre.append(create('code',`language-${language==='dsl' ? 'arch' : language}`,code.join('\n')));
      block.append(pre);
    };
    if (format) {
      codeBlock(lines,format);
      return;
    }
    for (let index=0; index<lines.length; index++) {
      const style=lineStyles?.[index], lineLinks=links?.[index] ?? [];
      if (style?.format && !lineLinks.length) {
        const start=index;
        while (lineStyles?.[index+1]?.format===style.format && !links?.[index+1]?.length) index++;
        codeBlock(lines.slice(start,index+1),style.format);
        continue;
      }
      const row=create('p'), chars=[...String(lines[index])];
      const termLength = style?.format ? chars.length : style?.termLength ?? 0;
      const append = (target,start,end) => {
        const termEnd = Math.max(start,Math.min(termLength,end));
        if (termEnd>start) target.append(create('code','ad-help-term',chars.slice(start,termEnd).join('')));
        if (end>termEnd) target.append(chars.slice(termEnd,end).join(''));
      };
      let cursor=0;
      for (const link of lineLinks) {
        append(row,cursor,link.start);
        const reference=button('',() => follow(link.query),'ad-link');
        append(reference,link.start,link.end);
        row.append(reference);
        cursor=link.end;
      }
      append(row,cursor,chars.length);
      block.append(row);
    }
  }

  function label(item) { return item.title || item.type || item.id; }
  function name(id) { return byElement.get(id)?.title ?? id; }
  function detail(item, kind) {
    if (kind === 'views') return [item.viewpoint,item.diagram,item.id].filter(Boolean).join(' · ');
    if (kind === 'relationships') return `${name(item.source)} ${item.direction==='both'?'↔':'→'} ${name(item.target)}`;
    const count = reuse.get(item.id)?.length ?? 0;
    return [item.type,count ? `${count} ${count===1?'view':'views'}` : 'Unused'].filter(Boolean).join(' · ');
  }
  function entry(text, subtitle, action) {
    const node = button('',action,'ad-entry');
    node.append(create('strong',null,text));
    if (subtitle) node.append(create('small',null,subtitle));
    return node;
  }
  function drawCatalog() {
    const input = search.value.trim().toLocaleLowerCase();
    if (listedTab!==tab || listedQuery!==input) {
      if (listedTab!==tab) for (const [key,node] of tabButtons) node.setAttribute('aria-pressed',String(key === tab));
      const kind = tab;
      const query = input ? input.split(/\s+/) : [];
      const fragment = document.createDocumentFragment();
      listedRows = new Map();
      listedNoteButtons = new Map();
      for (const item of buckets[kind]) {
        let fields = searchFields.get(item);
        if (!fields && query.length) {
          fields = [item.id,item.title,item.type,item.viewpoint,item.description,detail(item,kind)].join(' ').toLocaleLowerCase();
          searchFields.set(item,fields);
        }
        if (query.length && !query.every(word => fields.includes(word))) continue;
        const node = entry(label(item),detail(item,kind),() => kind==='views' ? openView(item.id) : openItem(kind,item.id));
        listedRows.set(item.id,node);
        if (kind==='views') {
          const row = create('div','ad-catalog-row');
          const noteLink = button('Note',() => jumpToViewNote(item.id),'ad-note-jump');
          noteLink.setAttribute('aria-label',`Open notes for ${label(item)}`);
          noteLink.hidden = !notes.views[item.id]?.trim();
          listedNoteButtons.set(item.id,noteLink);
          row.append(node,noteLink);
          fragment.append(row);
        } else fragment.append(node);
      }
      if (!fragment.childElementCount) fragment.append(create('p','ad-empty','No matching entries.'));
      results.replaceChildren(fragment);
      listedTab = tab;
      listedQuery = input;
      currentRow = undefined;
    }
    // Inspector navigation only changes selection. Keep catalog buttons
    // mounted so focus and scroll position survive on large models.
    const nextRow = current().kind===tab ? listedRows.get(current().id) : undefined;
    if (nextRow!==currentRow) {
      currentRow?.removeAttribute('aria-current');
      nextRow?.setAttribute('aria-current','true');
      currentRow = nextRow;
    }
  }
  function push(state) {
    if (state.view===current().view && state.kind===current().kind && state.id===current().id) return;
    history.splice(position+1,history.length,state);
    position++;
    paint();
  }
  function travel(delta) {
    if (history[position+delta]) { position += delta; paint(); }
  }
  function openView(id, preserve = false) {
    if (!byView.has(id)) return;
    const state = current();
    push(preserve && state.kind!=='views' ? {...state,view:id} : {view:id,kind:'views',id});
  }
  function openItem(kind,id) { push({view:current().view,kind,id}); }
  function stepView(delta) {
    const index = viewPositions.get(current().view) ?? -1;
    openView(report.views[index+delta]?.id);
  }
  function scale(value) {
    zoom = Math.max(.25,Math.min(4,value));
    diagram.style.setProperty('--ad-zoom',zoom);
  }
  function togglePresentation() {
    presenting = !presenting;
    root.classList.toggle('ad-presenting',presenting);
    present.textContent = presenting ? 'Exit presentation' : 'Present';
    present.setAttribute('aria-pressed',String(presenting));
    scale(1);
  }
  function sourceLink(parent, location) {
    if (!location?.line && !location?.path) return;
    const reference = location.line ? `Line ${location.line}` : location.path;
    parent.append(options.onSource && location.line
      ? button(reference,() => options.onSource(location),'ad-link')
      : create('small','ad-meta',reference));
  }
  function section(title) {
    const block = create('section');
    block.append(create('h3',null,title));
    inspector.append(block);
    return block;
  }
  function drawList(block, values, render) {
    const list = create('ul');
    for (const value of values) {
      const li = create('li');
      li.append(render(value));
      list.append(li);
    }
    block.append(list);
  }
  function itemLink(id) {
    const item = byElement.get(id) ?? byRelation.get(id);
    return item ? button(label(item),() => openItem(byElement.has(id)?'elements':'relationships',id),'ad-link') : create('span',null,id);
  }
  function drawDiagnostics(issues) {
    const block = section(`Diagnostics (${issues.length})`);
    if (!issues.length) { block.append(create('p','ad-meta','No findings for this view.')); return; }
    for (const issue of issues) {
      const card = create('div','ad-issue');
      card.dataset.error = String(issue.severity==='error');
      card.append(create('strong',null,issue.omitted?'Omitted during preview':
        issue.mappingStatus==='review'?'Mapping review':issue.severity==='error'?'Error':'Notice'),
        create('p',null,issue.message));
      if (issue.candidates?.length) card.append(create('p',null,`Candidates: ${issue.candidates.join(', ')}`));
      sourceLink(card,issue);
      if (issue.help) card.append(' ',button('Open help',() => (options.onHelp ?? openHelp)(issue.help),'ad-link'));
      block.append(card);
    }
  }
  function drawDetail(view) {
    inspector.replaceChildren();
    const {kind,id} = current();
    if (kind==='tiles') {
      const tile = tiles.get(id);
      if (!tile) return;
      inspector.append(create('p','ad-meta','Grid tile'),create('h2',null,tile.title));
      if (tile.products.length) drawList(section('Products'),tile.products,product => {
        const link = entry(label(product),'Architecture product',() => openItem('elements',product.id));
        if (tile.selectedProducts.has(product.id)) link.setAttribute('aria-current','true');
        return link;
      });
      if (tile.views.length) drawList(section('Diagrams'),tile.views,diagram => {
        const link = entry(label(diagram),detail(diagram,'views'),() => openView(diagram.id));
        if (tile.selectedViews.has(diagram.id)) link.setAttribute('aria-current','true');
        return link;
      });
      return;
    }
    const item = kind==='elements' ? byElement.get(id) : kind==='relationships' ? byRelation.get(id) : view;
    if (!item) return;
    inspector.append(create('p','ad-meta',kind==='elements'?'Element':kind==='relationships'?'Relationship':'View'),
      create('h2',null,label(item)),create('p','ad-meta',[item.id,item.type,item.stereotype].filter(Boolean).join(' · ')));
    if (item.description) inspector.append(create('p',null,item.description));
    sourceLink(inspector,item.location);
    const help = kind==='views' && item.viewpoint ? ['Viewpoint help',`viewpoints . ${item.viewpoint}`] :
      kind==='elements' && item.type ? ['Element type help',`types . ${item.type}`] :
      kind==='relationships' && item.type ? ['Relationship type help',`relations . ${item.type}`] : undefined;
    if (help) inspector.append(' ',button(help[0],() => openHelp(help[1]),'ad-link'));
    if (kind==='views') {
      const issues = report.diagnostics.filter(issue => !issue.viewId || issue.viewId === item.id);
      if (item.error && !issues.some(issue => issue.message===item.error))
        issues.push({severity:'error',message:item.error});
      drawDiagnostics(issues);
      if (item.represents) section('Represents').append(itemLink(item.represents));
      const viewLinks = [...new Set([item.extends,...item.embeds].filter(Boolean))];
      if (viewLinks.length) drawList(section('Reuses views'),viewLinks,link =>
        entry(label(byView.get(link) ?? {id:link}),link,() => openView(link)));
      for (const [heading,ids,visible] of [
        ['Elements',item.elements,item.visibleElements],['Relationships',item.relationships,item.visibleRelationships]
      ]) {
        const group = section(`${heading} (${ids.length})`);
        const visibleSet = new Set(visible);
        const details = create('details');
        details.append(create('summary',null,'Browse selection'));
        drawList(details,ids,ref => entry(label(byElement.get(ref) ?? byRelation.get(ref) ?? {id:ref}),
          visibleSet.has(ref) ? ref : 'Model context',() => openItem(byElement.has(ref)?'elements':'relationships',ref)));
        if (ids.length) group.append(details);
      }
      return;
    }
    if (kind==='relationships') {
      const endpoints = section('Endpoints');
      endpoints.append(itemLink(item.source),` ${item.direction==='both'?'↔':'→'} `,itemLink(item.target));
    } else if (item.parent) section('Container').append(itemLink(item.parent));
    const diagrams = linked.get(id) ?? [];
    if (diagrams.length) drawList(section('Open diagram'),diagrams,link => entry(label(link),detail(link,'views'),() => openView(link.id)));
    const uses = reuse.get(id) ?? [];
    const usage = section(`Used in ${uses.length} ${uses.length===1?'view':'views'}`);
    if (uses.length) drawList(usage,uses,({view:use,visible}) =>
      entry(label(use),[use.viewpoint,use.id,visible?'':'Model context'].filter(Boolean).join(' · '),() => openView(use.id,true)));
    else usage.append(create('p','ad-meta','Outside the current view selections.'));
    const connections = related.get(id) ?? [];
    if (connections.length) drawList(section(`Relationships (${connections.length})`),connections,relation =>
      entry(label(relation),detail(relation,'relationships'),() => openItem('relationships',relation.id)));
    const references = incoming.get(id) ?? [];
    if (references.length) drawList(section(`Referenced by (${references.length})`),references,
      ({item:ref,attribute}) => entry(label(ref),attribute,() => openItem(ref.source!==undefined?'relationships':'elements',ref.id)));
    if (item.attributes && Object.keys(item.attributes).length) {
      const properties = create('dl');
      for (const [key,value] of Object.entries(item.attributes)) {
        const row = create('dd');
        const ids = item.references?.filter(ref => ref.attribute===key).map(ref => ref.id);
        if (ids?.length) {
          ids.forEach((ref,index) => { if(index) row.append(', '); row.append(itemLink(ref)); });
        } else row.textContent = typeof value==='string' ? value : JSON.stringify(value);
        properties.append(create('dt',null,key),row);
      }
      section('Properties').append(properties);
    }
  }
  function paint() {
    const view = byView.get(current().view);
    const viewIndex = viewPositions.get(view?.id) ?? -1;
    title.textContent = view ? label(view) : 'Architecture';
    type.textContent = view ? [view.viewpoint,view.diagram,view.id,`${viewIndex+1} of ${report.views.length}`].filter(Boolean).join(' · ') : '';
    back.disabled = position===0;
    forward.disabled = position===history.length-1;
    previous.disabled = viewIndex<=0;
    next.disabled = viewIndex<0 || viewIndex===report.views.length-1;
    modes.hidden = !view;
    showDiagram.setAttribute('aria-pressed',String(!showingSource));
    showSource.setAttribute('aria-pressed',String(showingSource));
    canvas.hidden = showingSource;
    sourcePane.hidden = !showingSource || !view;
    zoomOut.hidden = fit.hidden = zoomIn.hidden = showingSource;
    if (showingSource && view) drawSource(view);
    if (!showingSource && (view?.id !== lastView || !diagram.hasChildNodes())) {
      lastView = view?.id;
      diagramItems.clear();
      for (const glyphs of Object.values(glyphsByKind)) glyphs.clear();
      highlighted = undefined;
      tiles.clear();
      let panel = rendered.get(view?.id) ?? report.previews?.[view?.id];
      if (!panel && view) {
        try { panel = {svg:options.renderView(view.id)}; }
        catch (error) { panel = {error:error.message}; }
        rendered.set(view.id,panel);
      }
      if (panel?.svg) {
        // SVG comes from the arch.js renderer. User-provided values are
        // escaped by that renderer before this markup reaches the browser.
        diagram.innerHTML = panel.svg;
        const edgeIds = new Map(Array.from(diagram.querySelectorAll('[data-edge]'),
          ({dataset}) => [dataset.edge,dataset.modelId ?? dataset.edge]));
        for (const glyph of diagram.querySelectorAll(glyphSelector)) {
          if (glyph.hasAttribute('data-grid-tile')) {
            const {gridTile,gridTitle,gridProducts,gridViews,selectedProducts,selectedViews} = glyph.dataset;
            const products = gridProducts.split(' ').map(id=>byElement.get(id)).filter(Boolean);
            const views = gridViews.split(' ').map(id=>byView.get(id)).filter(Boolean);
            if (!products.length && !views.length) continue;
            tiles.set(gridTile,{title:gridTitle,products,views,
              selectedProducts:new Set(selectedProducts.split(' ')),selectedViews:new Set(selectedViews.split(' '))});
            diagramItems.set(glyph,{kind:'tiles',id:gridTile});
            index(glyphsByKind.tiles,gridTile,glyph);
            const frame = glyph.querySelector('.arch-grid-tile-frame');
            frame.setAttribute('tabindex','0');
            frame.setAttribute('role','button');
            frame.setAttribute('aria-label',`${gridTitle}, ${products.length} products, ${views.length} diagrams`);
            continue;
          }
          const {node,edge,labelFor,modelId,viewLink} = glyph.dataset;
          const kind = viewLink ? 'views' : node === undefined ? 'relationships' : 'elements';
          const id = viewLink ?? modelId ?? node ?? edgeIds.get(labelFor ?? edge) ?? labelFor;
          const item = (kind==='views' ? byView : kind==='elements' ? byElement : byRelation).get(id);
          if (!item) continue;
          diagramItems.set(glyph,{kind,id});
          index(glyphsByKind[kind],id,glyph);
          glyph.setAttribute('tabindex','0');
          glyph.setAttribute('role','button');
          glyph.setAttribute('aria-label',label(item));
        }
      } else diagram.replaceChildren(create('p','ad-empty',panel?.error ?? view?.error ?? 'No diagram available.'));
      const size = diagram.firstElementChild?.viewBox?.baseVal;
      const hasSize = size?.width > 0 && size.height > 0;
      diagram.toggleAttribute('data-intrinsic-size',hasSize);
      if (hasSize) {
        diagram.style.setProperty('--ad-svg-width',`${size.width}px`);
        diagram.style.setProperty('--ad-svg-aspect',size.width / size.height);
      }
      scale(1);
      canvas.scrollTo(0,0);
    }
    const active = glyphsByKind[current().kind]?.get(current().id);
    if (active!==highlighted) {
      for (const glyph of highlighted ?? []) glyph.removeAttribute('data-dashboard-highlight');
      for (const glyph of active ?? []) glyph.setAttribute('data-dashboard-highlight','');
      highlighted = active;
    }
    drawCatalog();
    drawDetail(view);
  }
}
