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
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function unb64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function makeVerifier(key) {
  return b64(await encryptBuffer(key, enc.encode("familyhub-docs-ok")));
}

export async function checkVerifier(key, v64) {
  try {
    const pt = await decryptBuffer(key, unb64(v64));
    return new TextDecoder().decode(pt) === "familyhub-docs-ok";
  } catch {
    return false;
  }
}
