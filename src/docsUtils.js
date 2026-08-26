import { doc, getDoc } from "firebase/firestore";
import { ref, getBytes } from "firebase/storage";
import { db, storage } from "./firebase.js";
import { getDocKey, decryptBuffer } from "./crypto.js";

export function getSavedPin(code) {
  return localStorage.getItem(`fh_pin_${code}`);
}

export async function openDocById(code, docId, mode = "auto") {
  try {
    const snap = await getDoc(doc(db, "families", code, "documents", docId));
    if (!snap.exists()) return { error: "File not found." };
    const meta = snap.data();
    const pin = getSavedPin(code);
    if (!pin) return { needPin: true };
    const key = await getDocKey(code, pin);
    const buf = await getBytes(ref(storage, meta.path));
    const pt = await decryptBuffer(key, buf);
    const mime = meta.mime || "application/octet-stream";
    const blob = new Blob([pt], { type: mime });
    const url = URL.createObjectURL(blob);
    if (mode === "download" || !mime.startsWith("image/")) {
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(url, "_blank");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { ok: true };
  } catch (e) {
    return { error: e?.message || "Could not open the file (wrong PIN?)." };
  }
}
