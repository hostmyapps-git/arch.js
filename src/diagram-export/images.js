import { ArchError } from '../errors.js';
import { embeddedBackgroundImage } from '../background-images.js';

const raster = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/]+={0,2}$/i;
const numeric = (node,name) => Number(node.getAttribute(name));
export const decodePNG = data => Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),char=>char.charCodeAt(0));

function cropImage(image, item, owner, edit) {
  const width = edit ? numeric(item,'width') : image.naturalWidth;
  const height = edit ? numeric(item,'height') : image.naturalHeight;
  const canvas = owner.createElement('canvas');
  // Bound decoded output even when a diagram uses very large layout units.
  const scale = Math.min(Math.max(1,Math.min(image.naturalWidth/width,image.naturalHeight/height)),2048/Math.max(width,height));
  canvas.width = Math.max(1,Math.round(width*scale));
  canvas.height = Math.max(1,Math.round(height*scale));
  const context = canvas.getContext('2d');
  context.scale(canvas.width/width,canvas.height/height);
  if (edit) {
    const clip = item.getAttribute('clip-path')?.match(/^url\(#([^)]*)\)$/)?.[1];
    const shape = clip && item.ownerDocument.getElementById(clip)?.firstElementChild;
    if (shape) {
      context.translate(-numeric(item,'x'),-numeric(item,'y'));
      if (shape.localName==='path') context.clip(new owner.defaultView.Path2D(shape.getAttribute('d')));
      else if (shape.localName==='rect') {
        context.beginPath();
        const args = ['x','y','width','height','rx'].map(name=>numeric(shape,name));
        context.roundRect(...args);
        context.clip();
      }
      context.translate(numeric(item,'x'),numeric(item,'y'));
    }
    context.globalAlpha = item.hasAttribute('opacity') ? numeric(item,'opacity') : 1;
  }
  const fit = Math.max(width/image.naturalWidth,height/image.naturalHeight);
  const w = image.naturalWidth*fit, h = image.naturalHeight*fit;
  context.drawImage(image,(width-w)/2,(height-h)/2,w,h);
  return canvas.toDataURL('image/png');
}

export function imageBaker({document:owner = globalThis.document,baseURL,loadImage} = {}) {
  const loaded = new Map();
  const decoded = new Map();
  const browser = owner?.defaultView;
  async function load(source) {
    const embedded = embeddedBackgroundImage(source);
    if (embedded) return embedded;
    if (raster.test(source)) return source;
    if (loadImage) {
      const data = await loadImage(source);
      if (!raster.test(data)) throw new Error('Expected a raster image data URL');
      return data;
    }
    const response = await fetch(new URL(source,baseURL ?? owner?.baseURI));
    if (!response.ok) throw new Error(`Image request returned ${response.status}`);
    const blob = await response.blob();
    if (/^image\/(?:png|jpeg|gif|webp|avif)$/i.test(blob.type)) {
      return new Promise((resolve,reject) => {
        const reader = new browser.FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
    // SVG and other formats are decoded in image mode, which disables scripts.
    return browser.URL.createObjectURL(blob);
  }
  function decode(url) {
    if (!decoded.has(url)) decoded.set(url,(async () => {
      const image = new browser.Image();
      try { image.src=url; await image.decode(); }
      finally { if (url.startsWith('blob:')) browser.URL.revokeObjectURL(url); }
      return image;
    })());
    return decoded.get(url);
  }
  async function resolve(source, item) {
    try {
      if (!loaded.has(source)) loaded.set(source,load(source));
      const url = await loaded.get(source);
      if (!item && raster.test(url)) return url;
      if (browser) return cropImage(await decode(url),item,owner,Boolean(item));
      if (url.startsWith('data:image/png;')) return url;
      throw new Error('Image conversion requires a browser');
    } catch (cause) {
      const name = source && !source.startsWith('data:') ? source : 'embedded image';
      throw new ArchError(`Could not embed background image ${name}. ${cause.message}`,{},'ARCH_DIAGRAM_EXPORT');
    }
  }
  return {resolve, async bake(root, editable) {
    const items = Array.from(root.getElementsByTagName('image'));
    await Promise.all(items.map(async item => {
        const source = item.getAttribute('href') || item.getAttribute('xlink:href');
        const embedded = await resolve(source,editable ? item : undefined);
        item.removeAttribute('xlink:href');
        item.setAttribute('href',embedded);
    }));
  }};
}
