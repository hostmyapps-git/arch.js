import { backgroundImageURL, imageBaker, readImageFile } from './diagram-export/images.js';
import { preferLocalImages } from './portable-images.js';

function prefixedImageBase(source, url) {
  if (/^(?:[a-z][a-z\d+.-]*:|[/?#])|(?:^|\/)\.\.(?:\/|$)/i.test(source)) return;
  const authored = new URL(source,'https://arch.invalid/');
  if (authored.pathname==='/' || !url.pathname.endsWith(authored.pathname) ||
      url.search!==authored.search || url.hash!==authored.hash) return;
  const base = new URL(url);
  base.pathname = url.pathname.slice(0,-authored.pathname.length)+'/';
  base.search = base.hash = '';
  return base.href;
}

// Each architecture gets its own attachment map. Two Markdown blocks can
// refer to the same relative filename without sharing a selected local file.
export function createImageSession(host, {baseURL,loadImage} = {}) {
  const document = host.ownerDocument;
  const imageFiles = new Map();
  const imageURLs = new Map();
  const providerImages = new Map();
  const provider = loadImage && (source => {
    if (!providerImages.has(source)) {
      const data = Promise.resolve().then(() => loadImage(source));
      providerImages.set(source,data);
      data.catch(() => providerImages.delete(source));
    }
    return providerImages.get(source);
  });
  const configuredBase = baseURL ?? host.closest('[data-arch-image-base]')?.getAttribute('data-arch-image-base') ?? undefined;
  const options = {baseURL:configuredBase,document,loadImage:provider,imageFiles,imageURLs};
  const resolve = provider && imageBaker(options).resolve;
  const mounted = new Map();
  const pending = new Map();
  let queue = Promise.resolve();
  let rewrittenBase;

  function rememberRewrite(source, href) {
    if (!href || href===source || imageFiles.has(source)) return;
    if (/^data:/i.test(href)) { imageURLs.set(source,href); return; }
    let url;
    try { url = backgroundImageURL(href,document); } catch { return; }
    imageURLs.set(source,url.href);
    // Some hosts add one directory prefix to every resource after rendering.
    // Reuse that base for images in views that haven't been opened yet.
    const base = prefixedImageBase(source,url);
    if (base && url.origin===new URL(document.baseURI).origin) {
      rewrittenBase = rewrittenBase===undefined || rewrittenBase===base ? base : false;
      options.baseURL = rewrittenBase || undefined;
    }
  }

  function mount(container, unavailable, markup) {
    // Resolve authored URLs on an inert SVG before the browser starts image
    // requests. A Markdown block may live under a different asset base.
    const template = markup === undefined ? null : document.createElement('template');
    if (template) template.innerHTML = markup;
    const images = new Map();
    const notices = new Map();
    const sources = new Map();
    mounted.get(container)?.observer?.disconnect();
    const observer = configuredBase===undefined && !provider && new document.defaultView.MutationObserver(records => {
      for (const {target} of records) rememberRewrite(sources.get(target),target.getAttribute('href'));
    });
    mounted.set(container,{images,notices,observer});
    const report = (source,message) => {
      if (!notices.has(source)) notices.set(source,unavailable?.(source,message));
    };
    const clear = source => {
      notices.get(source)?.();
      notices.delete(source);
    };
    for (const image of (template?.content ?? container).querySelectorAll('svg image[data-background-image]')) {
      const source = image.getAttribute('href');
      if (!source || /^data:/i.test(source)) continue;
      if (!images.has(source)) images.set(source,[]);
      images.get(source).push(image);
      const data = imageFiles.get(source);
      if (data) { image.setAttribute('href',data); continue; }
      if (resolve) {
        image.removeAttribute('href');
        resolve(source).then(data => {
          if (!container.contains(image)) return;
          image.addEventListener('error',() => {
            if (container.contains(image) && !imageFiles.has(source)) report(source,`Image data could not be displayed for ${source}`);
          },{once:true});
          image.setAttribute('href',imageFiles.get(source) ?? data);
        },error => {
          if (container.contains(image) && !imageFiles.has(source)) report(source,error.message);
        });
        continue;
      }
      const reference = imageURLs.get(source) ?? source;
      let url;
      try { url = /^data:/i.test(reference) ? reference : backgroundImageURL(reference,document,options.baseURL).href; }
      catch (error) { report(source,error.message); continue; }
      image.addEventListener('load',() => clear(source));
      image.addEventListener('error', () => {
        if (imageFiles.has(source) || !image.isConnected) return;
        const address = new URL(image.getAttribute('href'),document.baseURI).href;
        report(source,`Image could not be loaded from ${address}`);
      });
      // Without an explicit base, leave new relative references available to
      // host post-processors such as LivePreview's directory URL rewriter.
      if (options.baseURL!==undefined || reference!==source) image.setAttribute('href',url);
      if (observer) {
        sources.set(image,source);
        observer.observe(image,{attributes:true,attributeFilter:['href']});
      }
    }
    preferLocalImages(template?.content ?? container,document);
    if (template) container.replaceChildren(template.content);
  }

  function choose(source, message) {
    if (imageFiles.has(source)) return Promise.resolve(true);
    if (!pending.has(source)) {
      const request = queue.then(() => pick(source,message));
      queue = request.catch(() => {});
      pending.set(source,request);
      const forget = () => pending.delete(source);
      request.then(forget,forget);
    }
    return pending.get(source);
  }

  async function run(action) {
    const attempted = new Set();
    for (;;) {
      try { return await action(options); }
      catch (error) {
        const source = error.imageSource;
        if (!source || attempted.has(source)) throw error;
        attempted.add(source);
        if (!await choose(source,error.message)) throw error;
      }
    }
  }

  function pick(source, message) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'arch-image-picker';
      dialog.setAttribute('aria-label','Attach background image');
      const title = document.createElement('h2');
      title.textContent = 'Attach background image';
      const path = document.createElement('code');
      path.textContent = source;
      const detail = document.createElement('p');
      detail.textContent = message;
      const controls = document.createElement('div');
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/*,.svg';
      file.setAttribute('aria-label','Choose image file');
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      const status = document.createElement('p');
      status.setAttribute('role','status');
      controls.append(file,cancel);
      dialog.append(title,path,detail,controls,status);
      let attached = false;
      cancel.addEventListener('click',()=>dialog.close());
      file.addEventListener('change',async () => {
        const selected = file.files[0];
        if (!selected) return;
        file.disabled = true;
        try {
          const data = await readImageFile(selected,document);
          if (!dialog.open) return;
          imageFiles.set(source,data);
          for (const [container,{images,notices,observer}] of mounted) {
            if (!container.isConnected) { observer?.disconnect(); mounted.delete(container); continue; }
            for (const image of images.get(source) ?? []) image.setAttribute('href',data);
            notices.get(source)?.();
          }
          attached = true;
          dialog.close();
        } catch (error) {
          status.textContent = `Could not read ${selected.name} as an image. ${error.message}`;
        } finally {
          file.value = '';
          file.disabled = false;
        }
      });
      dialog.addEventListener('close',() => {
        dialog.remove();
        resolve(attached);
      },{once:true});
      // A modal Dashboard can host the picker above itself.
      const parent = host.closest('dialog[open]') ?? host;
      parent.append(dialog);
      dialog.showModal();
    });
  }

  return {mount,choose,run};
}
