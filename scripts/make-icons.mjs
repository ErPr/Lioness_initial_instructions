// Generates the PWA icons with zero dependencies (only node's zlib), so the
// fork needs no image library. Draws a solid amber rounded field with a
// lighter "L" glyph — enough identity for the launcher + share sheet.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, draw) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y);
      const i = (y * size + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
  // Add filter byte (0) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Amber field (#b45309) with a soft rounded margin and a cream "L".
function drawIcon(size) {
  const amber = [180, 83, 9, 255];
  const cream = [254, 243, 226, 255];
  const clear = [0, 0, 0, 0];
  const r = size * 0.18; // corner radius
  const inRound = (x, y) => {
    const cx = Math.min(x, size - 1 - x);
    const cy = Math.min(y, size - 1 - y);
    if (cx >= r || cy >= r) return true;
    const dx = r - cx,
      dy = r - cy;
    return dx * dx + dy * dy <= r * r;
  };
  // "L" strokes, proportional.
  const lx0 = size * 0.34,
    lx1 = size * 0.44,
    ly0 = size * 0.26,
    ly1 = size * 0.74,
    lxr = size * 0.66;
  return (x, y) => {
    if (!inRound(x, y)) return clear;
    const vert = x >= lx0 && x <= lx1 && y >= ly0 && y <= ly1;
    const horiz = y >= ly1 - (lx1 - lx0) && y <= ly1 && x >= lx0 && x <= lxr;
    return vert || horiz ? cream : amber;
  };
}

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, png(size, drawIcon(size)));
  console.log(`wrote public/icons/icon-${size}.png`);
}
