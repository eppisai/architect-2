// Minimal "stored" ZIP writer (no compression) so generated source can be
// downloaded as a real archive without any dependency.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    let c = (crc ^ bytes[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const u16 = (n) => [n & 255, (n >> 8) & 255];
const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

export function zipBytes(files) {
  const enc = new TextEncoder();
  const parts = [],
    central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.path),
      data = enc.encode(f.text),
      crc = crc32(data);
    const head = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
    ]);
    parts.push(head, name, data);
    central.push(
      new Uint8Array([
        0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ]),
      name,
    );
    offset += head.length + name.length + data.length;
  }
  const cdSize = central.reduce((s, x) => s + x.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);
  const all = [...parts, ...central, eocd];
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
  let pos = 0;
  for (const x of all) {
    out.set(x, pos);
    pos += x.length;
  }
  return out;
}
