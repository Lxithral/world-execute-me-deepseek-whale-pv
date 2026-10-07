// Minimal asar reader: list entries matching a regex, or extract one entry to stdout.
// usage: node asar.cjs list <asar> <regex>
//        node asar.cjs dump <asar> <entryPath>
const fs = require('node:fs');

const [, , mode, asarPath, arg] = process.argv;
const fd = fs.openSync(asarPath, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const headerSize = head.readUInt32LE(4);
const jsonSize = head.readUInt32LE(8);
const jsonBuf = Buffer.alloc(jsonSize);
fs.readSync(fd, jsonBuf, 0, jsonSize, 16);
const raw = jsonBuf.toString('utf8');
const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
const base = 8 + headerSize;

const files = [];
(function walk(node, prefix) {
  for (const [name, v] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name;
    if (v.files) walk(v, p);
    else files.push({ p, size: Number(v.size), offset: Number(v.offset) });
  }
})(json, '');

if (mode === 'list') {
  const re = new RegExp(arg, 'i');
  for (const f of files.filter((f) => re.test(f.p))) console.log(f.size.toString().padStart(9), f.p);
  console.log('total entries:', files.length, '| headerSize', headerSize, '| base', base);
} else if (mode === 'dump') {
  const f = files.find((f) => f.p === arg || f.p.replace(/^\//, '') === arg.replace(/^\//, ''));
  if (!f) { console.error('not found'); process.exit(2); }
  const buf = Buffer.alloc(f.size);
  fs.readSync(fd, buf, 0, f.size, base + f.offset);
  process.stdout.write(buf.toString('utf8'));
} else if (mode === 'find') {
  // raw byte search of the whole archive, mapped back to owning entries
  const needle = Buffer.from(arg, 'utf8');
  const fstat = fs.fstatSync(fd);
  const CH = 8 * 1024 * 1024;
  const buf = Buffer.alloc(CH + needle.length);
  let carry = 0;
  let pos = 0;
  const owner = (abs) => files.find((f) => abs >= base + f.offset && abs < base + f.offset + f.size);
  const found = new Map();
  while (pos < fstat.size) {
    const n = fs.readSync(fd, buf, carry, CH, pos);
    if (n <= 0) break;
    const total = carry + n;
    const hay = buf.subarray(0, total);
    let idx = hay.indexOf(needle);
    while (idx !== -1) {
      const abs = pos - carry + idx;
      const f = owner(abs);
      const key = (f ? f.p : '(header)');
      found.set(key, (found.get(key) || 0) + 1);
      idx = hay.indexOf(needle, idx + 1);
    }
    carry = Math.min(needle.length - 1, total);
    buf.copy(buf, 0, total - carry, total);
    pos += n;
  }
  const totalHits = [...found.values()].reduce((a, b) => a + b, 0);
  for (const [k, v] of [...found.entries()].sort((a, b) => b[1] - a[1])) console.log(v, k);
  console.log('total hits:', totalHits);
} else if (mode === 'grep') {
  // grep every text-ish entry for a literal string, print file + line
  const needle = arg;
  let hits = 0;
  for (const f of files) {
    if (f.size > 4_000_000) continue;
    const buf = Buffer.alloc(f.size);
    fs.readSync(fd, buf, 0, f.size, base + f.offset);
    const txt = buf.toString('utf8');
    if (txt.includes(needle)) {
      txt.split('\n').forEach((line, i) => {
        if (line.includes(needle)) { console.log(`${f.p}:${i + 1}: ${line.trim().slice(0, 240)}`); hits++; }
      });
    }
  }
  console.log('hits:', hits);
}
