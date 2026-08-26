import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
} from "firebase/firestore";
import { useApp, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import {
  getDocKey,
  getPrivateDocKey,
  encryptBuffer,
  decryptBuffer,
  makeVerifier,
  checkVerifier,
  bufToB64,
  b64ToBuf,
} from "../crypto.js";
import { openDocById } from "../docsUtils.js";
import Avatar from "../components/Avatar.jsx";
import { IconPlus, IconX, IconTrash, IconLock } from "../components/Icons.jsx";

const FOLDER_EMOJIS = ["📁", "🪪", "🏥", "🎓", "🚗", "🏠", "💼", "🧾", "✈️", "🐾"];
const FOLDER_COLORS = ["#ff6b4a", "#4f8cff", "#22b07d", "#9b59f6", "#f2b705", "#e84393", "#00b8d4"];
const MAX_BYTES = 700 * 1024;

function fmtSize(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function typeIcon(mime, name) {
  if ((mime || "").startsWith("image/")) return "🖼️";
  if ((mime || "").includes("pdf") || (name || "").toLowerCase().endsWith(".pdf")) return "📄";
  return "📎";
}

async function maybeCompress(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size < 350 * 1024) return file;
  try {
    const img = await createImageBitmap(file);
    const max = 1600;
    let { width, height } = img;
    if (width > max || height > max) {
      const r = Math.min(max / width, max / height);
      width = Math.round(width * r);
      height = Math.round(height * r);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (blob && blob.size < file.size) {
      return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    }
    return file;
  } catch {
    return file;
  }
}

export default function Documents() {
  const { user, activeCode, members } = useApp();
  const [pin, setPinState] = useState(() => localStorage.getItem(`fh_pin_${activeCode}`));
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [privPin, setPrivPinState] = useState(
    () => localStorage.getItem(`fh_privpin_${activeCode}_${user.uid}`) || ""
  );
  const [privInput, setPrivInput] = useState("");
  const [privErr, setPrivErr] = useState("");
  const [privUnlocking, setPrivUnlocking] = useState(false);
  const migratedRef = useRef(false);

  const { docs: folders } = useCollection(activeCode, "docFolders");
  const { docs: sharedDocs } = useCollection(activeCode, "documents");
  const { docs: privateDocs } = useCollection(
    activeCode,
    `privateDocs/${user.uid}/documents`
  );
  const { docs: events } = useCollection(activeCode, "events");

  const [activeFolder, setActiveFolder] = useState("all");
  const [newFolder, setNewFolder] = useState("");
  const [fEmoji, setFEmoji] = useState(FOLDER_EMOJIS[0]);
  const [fColor, setFColor] = useState(FOLDER_COLORS[0]);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((e) => e.date >= todayStr())
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .slice(0, 15),
    [events]
  );

  useEffect(() => {
    setPrivPinState(localStorage.getItem(`fh_privpin_${activeCode}_${user.uid}`) || "");
  }, [activeCode, user.uid]);

  async function unlock(e) {
    e.preventDefault();
    if (pinInput.trim().length < 4) return setPinErr("PIN must be at least 4 characters.");
    setUnlocking(true);
    setPinErr("");
    try {
      const key = await getDocKey(activeCode, pinInput);
      const famRef = doc(db, "families", activeCode);
      const snap = await getDoc(famRef);
      const verifier = snap.data()?.docsVerifier;
      if (verifier) {
        if (!(await checkVerifier(key, verifier))) {
          setPinErr("Wrong PIN — ask the family member who set up the safe.");
          setUnlocking(false);
          return;
        }
      } else {
        const ver = await makeVerifier(key);
        await setDoc(famRef, { docsVerifier: ver }, { merge: true });
      }
      localStorage.setItem(`fh_pin_${activeCode}`, pinInput);
      setPinState(pinInput);
    } catch (err) {
      setPinErr(err.message || "Could not unlock.");
    }
    setUnlocking(false);
  }

  async function unlockPrivate(e) {
    e.preventDefault();
    if (privInput.trim().length < 4) return setPrivErr("PIN must be at least 4 characters.");
    setPrivUnlocking(true);
    setPrivErr("");
    try {
      const key = await getPrivateDocKey(activeCode, user.uid, privInput);
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const v = userSnap.data()?.privateVerifier;
      if (v) {
        if (!(await checkVerifier(key, v))) {
          setPrivErr("Wrong private PIN.");
          setPrivUnlocking(false);
          return;
        }
      } else {
        const ver = await makeVerifier(key);
        await setDoc(doc(db, "users", user.uid), { privateVerifier: ver }, { merge: true });
      }
      localStorage.setItem(`fh_privpin_${activeCode}_${user.uid}`, privInput);
      setPrivPinState(privInput);
      setPrivInput("");
    } catch (err) {
      setPrivErr(err.message || "Could not unlock.");
    }
    setPrivUnlocking(false);
  }

  async function addFolder(ev) {
    ev.preventDefault();
    if (!newFolder.trim()) return;
    await addDoc(famCol(activeCode, "docFolders"), {
      name: newFolder.trim(),
      emoji: fEmoji,
      color: fColor,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setNewFolder("");
    setShowFolderForm(false);
  }

  async function renameFolder(f) {
    const name = prompt("Rename folder:", f.name);
    if (name && name.trim())
      await updateDoc(doc(db, "families", activeCode, "docFolders", f.id), { name: name.trim() });
  }

  async function deleteFolder(f) {
    if (!confirm(`Delete folder "${f.name}"? Documents inside move to All files.`)) return;
    for (const d of sharedDocs.filter((x) => x.folderId === f.id)) {
      await updateDoc(doc(db, "families", activeCode, "documents", d.id), { folderId: null });
    }
    await deleteDoc(doc(db, "families", activeCode, "docFolders", f.id));
    if (activeFolder === f.id) setActiveFolder("all");
  }

  async function uploadFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    if (isPrivate && !privPin) {
      setMsg("Set your private PIN first 🔐");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    setUploading(files.length);
    const failed = [];
    try {
      const key = isPrivate
        ? await getPrivateDocKey(activeCode, user.uid, privPin)
        : await getDocKey(activeCode, pin);
      for (const file of files) {
        const f = await maybeCompress(file);
        if (f.size > MAX_BYTES) {
          failed.push(`${file.name} (too big — max ~700 KB)`);
          setUploading((n) => n - 1);
          continue;
        }
        const plain = await f.arrayBuffer();
        const enc = await encryptBuffer(key, plain);
        const meta = {
          name: f.name,
          size: f.size,
          mime: f.type || "",
          data: bufToB64(enc),
          createdBy: user.uid,
          createdAt: Date.now(),
          encrypted: true,
        };
        if (isPrivate) {
          await addDoc(famCol(activeCode, `privateDocs/${user.uid}/documents`), meta);
        } else {
          await addDoc(famCol(activeCode, "documents"), {
            ...meta,
            folderId: activeFolder === "all" || activeFolder === "mine" ? null : activeFolder,
          });
        }
        setUploading((n) => n - 1);
      }
      setMsg(
        failed.length
          ? "⚠️ Skipped: " + failed.join(", ")
          : isPrivate
            ? "✓ Uploaded privately — encrypted with YOUR key, visible only to you"
            : "✓ Uploaded & encrypted for the family"
      );
      setTimeout(() => setMsg(""), 4000);
    } catch (err) {
      setMsg("Upload failed: " + (err.message || "try again"));
      setUploading(0);
    }
  }

  async function removeDoc(d, isPrivateDoc) {
    if (!confirm(`Delete "${d.name}" permanently?`)) return;
    if (isPrivateDoc) {
      await deleteDoc(doc(db, "families", activeCode, "privateDocs", user.uid, "documents", d.id));
    } else {
      await deleteDoc(doc(db, "families", activeCode, "documents", d.id));
    }
  }

  async function attachToEvent(d, isPrivateDoc, eventId) {
    if (!eventId) return;
    await updateDoc(doc(db, "families", activeCode, "events", eventId), {
      attachments: arrayUnion({ id: d.id, priv: isPrivateDoc }),
    });
    setMsg("✓ Attached to event — see it in Calendar");
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleOpen(d, isPrivateDoc) {
    const res = await openDocById(activeCode, user.uid, d.id);
    if (res.error) {
      setMsg(res.error);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  useEffect(() => {
    if (!pin || !privPin || migratedRef.current) return;
    const old = sharedDocs.filter((d) => d.isPrivate && d.createdBy === user.uid);
    if (!old.length) return;
    migratedRef.current = true;
    (async () => {
      let moved = 0;
      for (const d of old) {
        try {
          const famKey = await getDocKey(activeCode, pin);
          const pt = await decryptBuffer(famKey, b64ToBuf(d.data));
          const pKey = await getPrivateDocKey(activeCode, user.uid, privPin);
          const enc = await encryptBuffer(pKey, pt);
          const { isPrivate, folderId, path, ...meta } = d;
          await addDoc(famCol(activeCode, `privateDocs/${user.uid}/documents`), {
            ...meta,
            data: bufToB64(enc),
          });
          await deleteDoc(doc(db, "families", activeCode, "documents", d.id));
          moved++;
        } catch {}
      }
      if (moved) {
        setMsg(`🔒 Moved ${moved} old private file(s) into your personal vault`);
        setTimeout(() => setMsg(""), 4000);
      }
    })();
  }, [pin, privPin, sharedDocs, activeCode, user.uid]);

  if (!pin) {
    return (
      <div className="page narrow">
        <h2 className="page-title">Documents</h2>
        <form className="panel pin-gate" onSubmit={unlock}>
          <div className="pin-lock">🔐</div>
          <h3>Your family Document Safe</h3>
          <p className="muted small">
            Files are <b>encrypted in your browser</b> with a secret PIN before upload — even Firebase can't
            read them. <b>Share the same PIN with your family</b> so everyone can open shared files.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            placeholder="Family safe PIN (min 4)"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
          />
          {pinErr && <div className="error">{pinErr}</div>}
          <button className="btn primary big" disabled={unlocking}>
            {unlocking ? "Unlocking…" : "Open the safe 🔓"}
          </button>
        </form>
      </div>
    );
  }

  const sharedVisible = sharedDocs.filter(
    (d) => !query || (d.name || "").toLowerCase().includes(query.toLowerCase())
  );
  const privateVisible = privateDocs.filter(
    (d) => !query || (d.name || "").toLowerCase().includes(query.toLowerCase())
  );

  let listRows = [];
  let listTitle = "";
  if (activeFolder === "mine") {
    listRows = privateVisible.map((d) => ({ ...d, isPrivateDoc: true }));
    listTitle = `🔒 Private vault · ${listRows.length}`;
  } else if (activeFolder === "all") {
    listRows = [
      ...sharedVisible.map((d) => ({ ...d, isPrivateDoc: false })),
      ...privateVisible.map((d) => ({ ...d, isPrivateDoc: true })),
    ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    listTitle = `All files · ${listRows.length}`;
  } else {
    listRows = sharedVisible
      .filter((d) => d.folderId === activeFolder)
      .map((d) => ({ ...d, isPrivateDoc: false }));
    const f = folders.find((x) => x.id === activeFolder);
    listTitle = `${f ? f.emoji + " " + f.name : "Folder"} · ${listRows.length}`;
  }

  const recent = [...listRows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);

  function DocRow({ d }) {
    const m = memberById[d.createdBy];
    const isMine = d.createdBy === user.uid;
    return (
      <li className="doc-row">
        <span className="doc-icon">{typeIcon(d.mime, d.name)}</span>
        <div className="row-body">
          <span className="row-title">
            {d.name}
            {d.isPrivateDoc && <span className="you-tag">🔒 private</span>}
          </span>
          <span className="row-sub">
            {fmtSize(d.size)} · <span className="dot" style={{ background: m?.color || "#ccc" }} />
            {m?.name.split(" ")[0] || "—"} · {timeAgo(d.createdAt)}
          </span>
          {isMine && (
            <span className="doc-actions">
              <button className="linklike" onClick={() => handleOpen(d, d.isPrivateDoc)}>
                Open
              </button>
              <select
                className="attach-select"
                value=""
                onChange={(e) => attachToEvent(d, d.isPrivateDoc, e.target.value)}
                title="Attach to a calendar event"
              >
                <option value="">📎 Attach to event…</option>
                {upcomingEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.date})
                  </option>
                ))}
              </select>
            </span>
          )}
        </div>
        {isMine && (
          <button
            className="icon-btn danger"
            title="Delete"
            onClick={() => removeDoc(d, d.isPrivateDoc)}
          >
            <IconTrash size={15} />
          </button>
        )}
        {!isMine && (
          <button className="btn tiny" onClick={() => handleOpen(d, false)}>
            Open
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="page">
      <h2 className="page-title">Documents 🔐</h2>

      <div className="doc-toolbar">
        <input
          className="grow"
          placeholder="Search files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="btn primary upload-btn">
          <IconPlus size={16} /> Upload
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <label className="priv-toggle">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        🔒 Upload as private — encrypted with YOUR pin, only you ever see it
      </label>

      {isPrivate && !privPin && (
        <form className="panel priv-pin-form" onSubmit={unlockPrivate}>
          <h4>
            <IconLock size={16} /> Set your personal private PIN
          </h4>
          <p className="muted small">
            Private files use <b>your own secret PIN</b> — different from the family PIN. Nobody else can
            open them, not even with the family PIN. Don't lose it!
          </p>
          <input
            type="password"
            inputMode="numeric"
            placeholder="Your private PIN (min 4)"
            value={privInput}
            onChange={(e) => setPrivInput(e.target.value)}
          />
          {privErr && <div className="error">{privErr}</div>}
          <button className="btn primary" disabled={privUnlocking}>
            {privUnlocking ? "Saving…" : "Save private PIN"}
          </button>
        </form>
      )}

      {uploading > 0 && (
        <div className="transfer-msg">Encrypting & uploading… {uploading} file(s) left</div>
      )}
      {msg && <div className="transfer-msg">{msg}</div>}

      <div className="folder-chips">
        <button className={"chip" + (activeFolder === "all" ? " on" : "")} onClick={() => setActiveFolder("all")}>
          🗂️ All files
        </button>
        <button className={"chip" + (activeFolder === "mine" ? " on" : "")} onClick={() => setActiveFolder("mine")}>
          🔒 Private
        </button>
        {folders.map((f) => (
          <span key={f.id} className="folder-chip-wrap">
            <button
              className={"chip" + (activeFolder === f.id ? " on" : "")}
              style={activeFolder === f.id ? { background: f.color, borderColor: f.color, color: "#fff" } : {}}
              onClick={() => setActiveFolder(f.id)}
              onDoubleClick={() => renameFolder(f)}
              title="Double-click to rename"
            >
              {f.emoji} {f.name}
            </button>
            <button className="folder-x" title="Delete folder" onClick={() => deleteFolder(f)}>
              <IconX size={11} />
            </button>
          </span>
        ))}
        <button className="chip add-folder" onClick={() => setShowFolderForm((s) => !s)}>
          <IconPlus size={13} /> Folder
        </button>
      </div>

      {showFolderForm && (
        <form className="panel folder-form" onSubmit={addFolder}>
          <input
            className="grow"
            placeholder="Folder name… e.g. Aadhaar & IDs"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
          />
          <div className="emoji-row">
            {FOLDER_EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                className={"emoji" + (fEmoji === e ? " on" : "")}
                onClick={() => setFEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="swatches">
            {FOLDER_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={"swatch" + (fColor === c ? " on" : "")}
                style={{ background: c }}
                onClick={() => setFColor(c)}
              />
            ))}
          </div>
          <button className="btn primary">Create folder</button>
        </form>
      )}

      <section className="panel">
        <header className="panel-head">
          <h3>{listTitle}</h3>
        </header>
        <ul className="row-list">
          {listRows.map((d) => (
            <DocRow key={d.id} d={d} />
          ))}
          {!listRows.length && (
            <p className="empty">No files here yet — hit Upload. Files are encrypted before they leave this device.</p>
          )}
        </ul>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h3>🔔 Recent additions</h3>
        </header>
        <ul className="row-list">
          {recent.map((d) => {
            const m = memberById[d.createdBy];
            return (
              <li key={d.id}>
                <Avatar src={m?.photoURL} name={m?.name} color={m?.color} size={30} />
                <div className="row-body">
                  <span className="row-title">
                    <b>{m?.name.split(" ")[0] || "Someone"}</b> added {typeIcon(d.mime, d.name)} {d.name}
                    {d.isPrivateDoc && <span className="you-tag">🔒 private</span>}
                  </span>
                  <span className="row-sub">{timeAgo(d.createdAt)}</span>
                </div>
              </li>
            );
          })}
          {!recent.length && <p className="empty">Nothing yet.</p>}
        </ul>
      </section>
    </div>
  );
}

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
