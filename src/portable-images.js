// This function is also serialized into standalone Dashboard HTML. Keep the
// local lookup tied to the downloaded document, even when it has a <base>.
export function preferLocalImages(container, owner = container.ownerDocument) {
  if (owner.location?.protocol !== 'file:') return;
  for (const image of container.querySelectorAll('svg image[data-arch-image-source]')) {
    const source = image.getAttribute('data-arch-image-source');
    const embedded = image.getAttribute('href');
    if (!source || /^(?:[a-z][a-z\d+.-]*:|[/?#])/i.test(source) || !/^data:image\//i.test(embedded)) continue;
    const local = new URL(source,owner.location.href);
    if (local.protocol !== 'file:' || local.host !== new URL(owner.location.href).host) continue;
    image.addEventListener('error',() => image.setAttribute('href',embedded),{once:true});
    image.setAttribute('href',local.href);
  }
}
