const enc = new TextEncoder();

export async function getDocKey(code, pin) {
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("fh-docs-" + code), iterations: 150000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function getPrivateDocKey(code, uid, pin) {
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(`fh-priv-docs-${code}-${uid}`), iterations: 150000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBuffer(key, buf) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buf);
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return out;
}

export async function decryptBuffer(key, buf) {
  const iv = buf.slice(0, 12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, buf.slice(12));
}

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBuf(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export { b64 as bufToB64, b64ToBuf };

export async function makeVerifier(key) {
  return b64(await encryptBuffer(key, enc.encode("familyhub-docs-ok")));
}

export async function checkVerifier(key, v64) {
  try {
    const pt = await decryptBuffer(key, b64ToBuf(v64));
    return new TextDecoder().decode(pt) === "familyhub-docs-ok";
  } catch {
    return false;
  }
}
