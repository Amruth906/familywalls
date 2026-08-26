import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";

const ALGO = { name: "ECDH", namedCurve: "P-256" };
const enc = new TextEncoder();

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function fingerprint(pubJwk) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(JSON.stringify(pubJwk)));
  return [...new Uint8Array(h)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

export async function getMyKeyPair(uid) {
  const raw = localStorage.getItem(`fh_chat_priv_${uid}`);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }
  const pair = await crypto.subtle.generateKey(ALGO, true, ["deriveKey"]);
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const pubJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const fp = await fingerprint(pubJwk);
  const kp = { privJwk, pubJwk, fp };
  localStorage.setItem(`fh_chat_priv_${uid}`, JSON.stringify(kp));
  await setDoc(doc(db, "users", uid), { chatPub: pubJwk, chatFp: fp }, { merge: true });
  return kp;
}

export async function exportMyKeyPair(uid) {
  const kp = await getMyKeyPair(uid);
  return JSON.stringify(kp, null, 2);
}

export async function importMyKeyPair(uid, json) {
  const kp = JSON.parse(json);
  if (!kp.privJwk || !kp.pubJwk) throw new Error("Invalid key file.");
  localStorage.setItem(`fh_chat_priv_${uid}`, JSON.stringify(kp));
  await setDoc(doc(db, "users", uid), { chatPub: kp.pubJwk, chatFp: kp.fp }, { merge: true });
  return kp;
}

async function importPub(jwk) {
  return crypto.subtle.importKey("jwk", jwk, ALGO, false, []);
}

async function importPriv(jwk) {
  return crypto.subtle.importKey("jwk", jwk, ALGO, false, ["deriveKey"]);
}

async function deriveChatKey(privJwk, pubJwk) {
  const priv = await importPriv(privJwk);
  const pub = await importPub(pubJwk);
  return crypto.subtle.deriveKey({ name: "ECDH", public: pub }, priv, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptFor(privJwk, memberPubs, text) {
  const priv = await importPriv(privJwk);
  const msgKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, msgKey, enc.encode(text));
  const rawKey = await crypto.subtle.exportKey("raw", msgKey);
  const keys = {};
  for (const [uid, pubJwk] of Object.entries(memberPubs)) {
    try {
      const k = await deriveChatKey(privJwk, pubJwk);
      const kiv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv: kiv }, k, rawKey);
      keys[uid] = b64(new Uint8Array([...kiv, ...new Uint8Array(wrapped)]));
    } catch {}
  }
  return { cipher: b64(new Uint8Array([...iv, ...new Uint8Array(ct)])), keys };
}

export async function decryptFor(privJwk, senderPubJwk, cipherB64, wrappedB64) {
  const k = await deriveChatKey(privJwk, senderPubJwk);
  const w = unb64(wrappedB64);
  const rawKey = await crypto.subtle.decrypt({ name: "AES-GCM", iv: w.slice(0, 12) }, k, w.slice(12));
  const msgKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const c = unb64(cipherB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: c.slice(0, 12) }, msgKey, c.slice(12));
  return new TextDecoder().decode(pt);
}
