// These exporters use uncompressed ZIP members and DEFLATE stored blocks.
// Both formats can be generated synchronously in a browser without a ZIP dependency.
const encode = value => new TextEncoder().encode(value);
const crcTable = Uint32Array.from({length:256}, (_,index) => {
  let crc = index;
  for (let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc;
});
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
};
const header = (length,word,dwords) => {
  const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
  for (const [offset,value] of word) view.setUint16(offset,value,true);
  for (const [offset,value] of dwords) view.setUint32(offset,value,true);
  return bytes;
};
function concatenate(parts) {
  const result = new Uint8Array(parts.reduce((size,bytes) => size+bytes.length,0));
  let offset = 0;
  for (const bytes of parts) { result.set(bytes,offset); offset += bytes.length; }
  return result;
}
export function zipEntries(entries) {
  const parts = [], directory = [];
  let position = 0, directorySize = 0;
  for (const [name,data] of entries) {
    const filename = encode(name), content = typeof data==='string' ? encode(data) : data;
    const size = content.length, crc = crc32(content);
    const local = header(30,[[4,20],[6,0x800],[12,33],[26,filename.length]],
      [[0,0x04034b50],[14,crc],[18,size],[22,size]]);
    const central = header(46,[[4,20],[6,20],[8,0x800],[14,33],[28,filename.length]],
      [[0,0x02014b50],[16,crc],[20,size],[24,size],[42,position]]);
    parts.push(local,filename,content);
    directory.push(central,filename);
    position += local.length+filename.length+size;
    directorySize += central.length+filename.length;
  }
  const end = header(22,[[8,entries.length],[10,entries.length]],[[0,0x06054b50],[12,directorySize],[16,position]]);
  return concatenate([...parts,...directory,end]);
}
export function drawioStencil(text) {
  const bytes = encode(encodeURIComponent(text));
  const parts = [];
  for (let offset=0;offset<bytes.length;) {
    const size = Math.min(65535,bytes.length-offset);
    parts.push(header(5,[[1,size],[3,0xffff ^ size]],[]),bytes.subarray(offset,offset+size));
    offset += size;
  }
  parts.at(-2)[0] = 1;
  let binary = '';
  for (const part of parts) for (let i=0;i<part.length;i+=8192)
    binary += String.fromCharCode(...part.subarray(i,i+8192));
  return btoa(binary);
}
