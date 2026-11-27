import { backgroundImageURL, readImageFile } from './diagram-export/images.js';

// Each architecture gets its own attachment map. Two Markdown blocks can
// refer to the same relative filename without sharing a selected local file.
export function createImageSession(host, {baseURL,loadImage} = {}) {
  const document = host.ownerDocument;
  const imageFiles = new Map();
  const options = {baseURL:baseURL ?? host.closest('[data-arch-image-base]')?.getAttribute('data-arch-image-base') ?? undefined,
    document,loadImage,imageFiles};
  const mounted = new Map();
  const pending = new Map();
  let queue = Promise.resolve();

  function mount(container, unavailable) {
    const images = new Map();
    const notices = new Map();
    mounted.set(container,{images,notices});
    const report = (source,message) => {
      if (!notices.has(source)) notices.set(source,unavailable?.(source,message));
    };
    for (const image of container.querySelectorAll('svg image[data-background-image]')) {
      const source = image.getAttribute('href');
      if (!source || /^data:/i.test(source)) continue;
      if (!images.has(source)) images.set(source,[]);
      images.get(source).push(image);
      const data = imageFiles.get(source);
      if (data) { image.setAttribute('href',data); continue; }
      let url;
      try { url = backgroundImageURL(source,document,options.baseURL); }
      catch (error) { report(source,error.message); continue; }
      image.addEventListener('error', () => {
        if (!imageFiles.has(source) && image.isConnected) report(source,`Image could not be loaded from ${url.href}`);
      }, {once:true});
      image.setAttribute('href',url.href);
    }
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
          for (const [container,{images,notices}] of mounted) {
            if (!container.isConnected) { mounted.delete(container); continue; }
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
