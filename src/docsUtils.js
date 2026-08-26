import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { getDocKey, getPrivateDocKey, decryptBuffer, b64ToBuf } from "./crypto.js";

export function getSavedPin(code) {
  return localStorage.getItem(`fh_pin_${code}`);
}

export async function openDocById(code, uid, docId, mode = "auto") {
  try {
    let snap = await getDoc(doc(db, "families", code, "documents", docId));
    let isPrivate = false;
    if (!snap.exists()) {
      snap = await getDoc(doc(db, "families", code, "privateDocs", uid, "documents", docId));
      isPrivate = true;
    }
    if (!snap.exists()) return { error: "File not found." };
    const meta = snap.data();
    const pin = isPrivate
      ? localStorage.getItem(`fh_privpin_${code}_${uid}`)
      : localStorage.getItem(`fh_pin_${code}`);
    if (!pin) return { needPin: true, private: isPrivate };
    const key = isPrivate
      ? await getPrivateDocKey(code, uid, pin)
      : await getDocKey(code, pin);
    const pt = await decryptBuffer(key, b64ToBuf(meta.data));
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
