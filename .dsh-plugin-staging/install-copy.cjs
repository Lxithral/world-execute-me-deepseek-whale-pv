// Copy the release payload (exactly the files listed in feed/manifest.json) into the
// desktop profile as a REAL directory, then re-verify every hash at the destination.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SRC = process.argv[2];
const DEST = process.argv[3];
const MANIFEST = process.argv[4];

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

if (fs.existsSync(DEST)) {
  const st = fs.lstatSync(DEST);
  console.log('DEST already exists ->', DEST, 'isSymbolicLink=', st.isSymbolicLink());
  process.exit(2);
}

let copied = 0;
const problems = [];
for (const entry of manifest.files) {
  const from = path.join(SRC, entry.path);
  const to = path.join(DEST, entry.path);
  if (!fs.existsSync(from)) { problems.push(`MISSING SRC ${entry.path}`); continue; }
  const buf = fs.readFileSync(from);
  if (buf.length !== entry.size) problems.push(`SIZE ${entry.path} ${buf.length} != ${entry.size}`);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== entry.sha256) problems.push(`SHA ${entry.path}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, buf);
  copied++;
}
console.log('copied files:', copied, 'of', manifest.files.length);
console.log('problems during copy:', problems.length ? problems : 'none');

// independent re-verification from disk
let ok = 0;
const bad = [];
for (const entry of manifest.files) {
  const to = path.join(DEST, entry.path);
  if (!fs.existsSync(to)) { bad.push(`MISSING ${entry.path}`); continue; }
  const buf = fs.readFileSync(to);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha === entry.sha256 && buf.length === entry.size) ok++; else bad.push(`BAD ${entry.path}`);
}
console.log('verified at destination: ok=' + ok, 'bad=' + bad.length, bad.length ? bad : '');

// any reparse point inside the installed tree?
function scanLink(p) {
  for (const name of fs.readdirSync(p)) {
    const full = path.join(p, name);
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) bad.push('SYMLINK ' + full);
    else if (st.isDirectory()) scanLink(full);
  }
}
scanLink(DEST);
console.log('symlinks in installed tree:', bad.filter((b) => b.startsWith('SYMLINK')).length);
