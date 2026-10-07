// Independent verification of a dsh-our-free-model payload against its signed manifest.
// usage: node verify.cjs <repoDir> <manifestPath> [pubkeyBase64]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoDir = path.resolve(process.argv[2]);
const manifestPath = path.resolve(process.argv[3]);
const PINNED_KEY = process.argv[4] || 'MCowBQYDK2VwAyEAeLdSVwYFyazc2PIBC0oLsvo4LghGEQz9iXIl3CqRuXI=';

const SIGNED_FIELDS = ['version', 'base', 'publishedAt', 'notes', 'files', 'minSupported'];

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(row => stableStringify(row ?? null)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
function signaturePayload(o) {
  const src = o !== null && typeof o === 'object' ? o : {};
  const picked = {};
  for (const k of SIGNED_FIELDS) if (src[k] !== undefined) picked[k] = src[k];
  return picked;
}
function verifyManifestSignature(payload, pubB64) {
  const sig = payload && typeof payload.signature === 'string' ? payload.signature : '';
  if (!sig || !pubB64) return false;
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(pubB64, 'base64'), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(stableStringify(signaturePayload(payload))), key, Buffer.from(sig, 'base64'));
  } catch { return false; }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log('manifest version   :', manifest.version);
console.log('manifest published :', manifest.publishedAt);
console.log('manifest files     :', manifest.files.length);
console.log('Ed25519 signature  :', verifyManifestSignature(manifest, PINNED_KEY) ? 'VALID (pinned release key)' : 'INVALID');

let ok = 0, bad = 0, missing = 0;
for (const f of manifest.files) {
  const p = path.join(repoDir, f.path);
  if (!fs.existsSync(p)) { console.log('MISSING  ', f.path); missing++; continue; }
  const b = fs.readFileSync(p);
  const h = crypto.createHash('sha256').update(b).digest('hex');
  if (h === f.sha256 && b.length === f.size) { ok++; }
  else {
    bad++;
    console.log(`MISMATCH ${f.path} size=${b.length}/${f.size} sha=${h.slice(0, 16)}/${f.sha256.slice(0, 16)}`);
  }
}
console.log(`hash check: ok=${ok} mismatch=${bad} missing=${missing}`);
process.exit(bad === 0 && missing === 0 && verifyManifestSignature(manifest, PINNED_KEY) ? 0 : 2);
