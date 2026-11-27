import { ArchError } from './errors.js';

const embeddedImages = new Map();
export const embeddedBackgroundImage = source => embeddedImages.get(source);

export function registerBackgroundImages(entries) {
  for (const [source, data] of entries) {
    validateBackgroundImage(source);
    validateBackgroundImage(data);
    if (!data?.startsWith('data:')) throw new ArchError('Embedded background images require raster data URLs');
    embeddedImages.set(source, data);
  }
}

export function validateBackgroundImage(source, loc) {
  if (source === undefined) return;
  if (typeof source === 'string' && source && source === source.trim() && !/[\u0000-\u001f\u007f\\]/.test(source)) {
    if (/^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/]+={0,2}$/i.test(source)) return;
    if (/^https?:\/\//i.test(source) || !/^(?:\/\/|[^/?#]*:|#|\?)/.test(source)) {
      try {
        const url = new URL(source, 'https://arch.invalid/');
        if (['http:', 'https:'].includes(url.protocol)) return;
      } catch {
        // Report invalid paths and URLs using the source location below.
      }
    }
  }
  throw new ArchError('backgroundImage requires a relative path, HTTP(S) URL or base64 raster image', loc, 'ARCH_VALIDATION');
}

export function backgroundImageMarkup(source, { x = 0, y = 0, width, height }, scope, clip) {
  if (!source) return '';
  const attribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const embedded = embeddedImages.get(source);
  const href = attribute(embedded ?? source);
  const original = embedded ? ` data-arch-image-source="${attribute(source)}"` : '';
  const clipMarkup = clip ? `<defs><clipPath id="${clip.id}">${clip.shape}</clipPath></defs>` : '';
  return `${clipMarkup}<image data-background-image="${scope}" href="${href}"${original} x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" overflow="hidden" opacity="${scope === 'node' ? 0.25 : 0.3}"${clip ? ` clip-path="url(#${clip.id})"` : ''} pointer-events="none" aria-hidden="true"/>`;
}

export function nodeBackgroundMarkup(node, id, width, height, shape) {
  if (!node.showBackgroundImage || !node.backgroundImage) return '';
  return backgroundImageMarkup(node.backgroundImage, { width, height }, 'node', { id, shape });
}
