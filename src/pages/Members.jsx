import React, { useState } from "react";
import { doc, addDoc, deleteDoc } from "firebase/firestore";
import { useFamily, famCol, MEMBER_COLORS } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";

export default function Members() {
  const { session, me, familyName, switchMember } = useFamily();
  const { docs: members } = useCollection(session.code, "members");
  const [name, setName] = useState("");
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [copied, setCopied] = useState(false);

  async function addMember(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await addDoc(famCol(session.code, "members"), {
      name: name.trim(),
      color,
      createdAt: Date.now(),
    });
    setName("");
  }

  async function copyInvite() {
    const link = `${location.origin}${location.pathname}#${session.code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard may be blocked; code copy still works in header */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page narrow">
      <h2>Family</h2>

      <div className="card invite-card">
        <h3>Invite your family 💌</h3>
        <p className="muted">
          Share this code — they tap <b>"Join with a family code"</b> on their phone and enter it:
        </p>
        <div className="code-display">{session.code}</div>
        <button className="btn primary" onClick={copyInvite}>
          {copied ? "Copied! ✓" : "Copy invite link"}
        </button>
      </div>

      <section className="card list-card">
        <h3>{familyName} ({members.length})</h3>
        <ul className="todo-list">
          {members.map((m) => (
            <li key={m.id} className={m.id === me?.id ? "me-row" : ""}>
              <span className="avatar" style={{ background: m.color }}>
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="todo-body">
                <span className="todo-text">
                  {m.name} {m.id === me?.id && <span className="you-tag">you</span>}
                </span>
              </div>
              {m.id !== me?.id && (
                <>
                  <button
                    className="btn tiny"
                    title="Switch to this person on this device"
                    onClick={() => switchMember(m.id)}
                  >
                    Switch
                  </button>
                  <button
                    className="x"
                    title="Remove member"
                    onClick={async () => {
                      if (confirm(`Remove ${m.name}?`))
                        await deleteDoc(doc(db, "families", session.code, "members", m.id));
                    }}
                  >
                    ✕
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form className="card add-member" onSubmit={addMember}>
        <h3>Add a family member</h3>
        <input placeholder="Name…" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="swatches">
          {MEMBER_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              className={"swatch" + (color === c ? " on" : "")}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button className="btn primary">Add member</button>
        <p className="muted small">Tip: add everyone's profile once — then each person just taps "who am I" on their device.</p>
      </form>
    </div>
  );
}
