import React, { useMemo, useRef, useState } from "react";
import { doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, deleteObject } from "firebase/storage";
import { useApp, famCol } from "../store.jsx";
import { db, storage } from "../firebase.js";
import { useCollection } from "../useData.js";
import { getDocKey, encryptBuffer, makeVerifier, checkVerifier } from "../crypto.js";
import { openDocById } from "../docsUtils.js";
import Avatar from "../components/Avatar.jsx";
import { IconPlus, IconX, IconTrash, IconSearch } from "../components/Icons.jsx";

const FOLDER_EMOJIS = ["📁", "🪪", "🏥", "🎓", "🚗", "🏠", "💼", "🧾", "✈️", "🐾"];
const FOLDER_COLORS = ["#ff6b4a", "#4f8cff", "#22b07d", "#9b59f6", "#f2b705", "#e84393", "#00b8d4"];

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

export default function Documents() {
  const { user, activeCode, members } = useApp();
  const [pin, setPinState] = useState(() => localStorage.getItem(`fh_pin_${activeCode}`));
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const { docs: folders } = useCollection(activeCode, "docFolders");
  const { docs: docs } = useCollection(activeCode, "documents");
  const { docs: events } = useCollection(activeCode, "events");

  const [activeFolder, setActiveFolder] = useState("all");
  const [newFolder, setNewFolder] = useState("");
  const [fEmoji, setFEmoji] = useState(FOLDER_EMOJIS[0]);
  const [fColor, setFColor] = useState(FOLDER_COLORS[0]);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [query, setQuery] = useState("");
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
    if (name && name.trim()) await updateDoc(doc(db, "families", activeCode, "docFolders", f.id), { name: name.trim() });
  }

  async function deleteFolder(f) {
    if (!confirm(`Delete folder "${f.name}"? Documents inside move to All files.`)) return;
    for (const d of docs.filter((x) => x.folderId === f.id)) {
      await updateDoc(doc(db, "families", activeCode, "documents", d.id), { folderId: null });
    }
    await deleteDoc(doc(db, "families", activeCode, "docFolders", f.id));
    if (activeFolder === f.id) setActiveFolder("all");
  }

  async function uploadFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    setUploading(files.length);
    try {
      const key = await getDocKey(activeCode, pin);
      for (const file of files) {
        const plain = await file.arrayBuffer();
        const enc = await encryptBuffer(key, plain);
        const path = `families/${activeCode}/docs/${crypto.randomUUID()}`;
        await uploadBytes(ref(storage, path), enc, { contentType: "application/octet-stream" });
        await addDoc(famCol(activeCode, "documents"), {
          name: file.name,
          size: file.size,
          mime: file.type || "",
          path,
          folderId: activeFolder === "all" || activeFolder === "mine" ? null : activeFolder,
          isPrivate: isPrivate,
          createdBy: user.uid,
          createdAt: Date.now(),
          encrypted: true,
        });
        setUploading((n) => n - 1);
      }
      setMsg(isPrivate ? "✓ Uploaded privately (only you can see it)" : "✓ Uploaded & encrypted");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg("Upload failed: " + (err.message || "try again"));
      setUploading(0);
    }
  }

  async function removeDoc(d) {
    if (!confirm(`Delete "${d.name}" permanently?`)) return;
    try {
      await deleteObject(ref(storage, d.path));
    } catch {}
    await deleteDoc(doc(db, "families", activeCode, "documents", d.id));
  }

  async function togglePrivate(d) {
    await updateDoc(doc(db, "families", activeCode, "documents", d.id), { isPrivate: !d.isPrivate });
  }

  async function attachToEvent(docId, eventId) {
    if (!eventId) return;
    await updateDoc(doc(db, "families", activeCode, "events", eventId), {
      attachments: arrayUnion(docId),
    });
    setMsg("✓ Attached to event — see it in Calendar");
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleOpen(d) {
    const res = await openDocById(activeCode, d.id);
    if (res.error) {
      setMsg(res.error);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  if (!pin) {
    return (
      <div className="page narrow">
        <h2 className="page-title">Documents</h2>
        <form className="panel pin-gate" onSubmit={unlock}>
          <div className="pin-lock">🔐</div>
          <h3>Your family Document Safe</h3>
          <p className="muted small">
            Files are <b>encrypted in your browser</b> with a secret PIN before upload — even Firebase can't
            read them. <b>Share the same PIN with your family</b> so everyone can open shared files. Private
            files stay visible only to you.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            placeholder="Create/enter safe PIN (min 4)"
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

  const visible = docs.filter((d) => !d.isPrivate || d.createdBy === user.uid);
  const filtered = visible
    .filter((d) => {
      if (activeFolder === "mine") return d.isPrivate && d.createdBy === user.uid;
      if (activeFolder === "all") return true;
      return d.folderId === activeFolder;
    })
    .filter((d) => !query || (d.name || "").toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const recent = [...visible].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);

  return (
    <div className="page">
      <h2 className="page-title">Documents 🔐</h2>

      <div className="doc-toolbar">
        <input className="grow" placeholder="Search files…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
        🔒 Upload as private (only I can see it)
      </label>

      {uploading > 0 && <div className="transfer-msg">Encrypting & uploading… {uploading} file(s) left</div>}
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
          <input className="grow" placeholder="Folder name… e.g. Aadhaar & IDs" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
          <div className="emoji-row">
            {FOLDER_EMOJIS.map((e) => (
              <button type="button" key={e} className={"emoji" + (fEmoji === e ? " on" : "")} onClick={() => setFEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
          <div className="swatches">
            {FOLDER_COLORS.map((c) => (
              <button type="button" key={c} className={"swatch" + (fColor === c ? " on" : "")} style={{ background: c }} onClick={() => setFColor(c)} />
            ))}
          </div>
          <button className="btn primary">Create folder</button>
        </form>
      )}

      <section className="panel">
        <header className="panel-head">
          <h3>
            {filtered.length} file{filtered.length === 1 ? "" : "s"}
          </h3>
        </header>
        <ul className="row-list">
          {filtered.map((d) => {
            const m = memberById[d.createdBy];
            return (
              <li key={d.id} className="doc-row">
                <span className="doc-icon">{typeIcon(d.mime, d.name)}</span>
                <div className="row-body">
                  <span className="row-title">
                    {d.name}
                    {d.isPrivate && <span className="you-tag">🔒 private</span>}
                  </span>
                  <span className="row-sub">
                    {fmtSize(d.size)} · <span className="dot" style={{ background: m?.color || "#ccc" }} />
                    {m?.name.split(" ")[0] || "—"} · {timeAgo(d.createdAt)}
                  </span>
                  {d.createdBy === user.uid && (
                    <span className="doc-actions">
                      <button className="linklike" onClick={() => handleOpen(d)}>
                        Open
                      </button>
                      <select
                        className="attach-select"
                        value=""
                        onChange={(e) => attachToEvent(d.id, e.target.value)}
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
                {d.createdBy === user.uid && (
                  <>
                    <button className="icon-btn" title={d.isPrivate ? "Make shared" : "Make private"} onClick={() => togglePrivate(d)}>
                      {d.isPrivate ? "🔓" : "🔒"}
                    </button>
                    <button className="icon-btn danger" title="Delete" onClick={() => removeDoc(d)}>
                      <IconTrash size={15} />
                    </button>
                  </>
                )}
                {d.createdBy !== user.uid && (
                  <button className="btn tiny" onClick={() => handleOpen(d)}>
                    Open
                  </button>
                )}
              </li>
            );
          })}
          {!filtered.length && (
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
