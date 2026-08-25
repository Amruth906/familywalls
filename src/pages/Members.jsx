import React, { useState } from "react";
import { useApp } from "../store.jsx";
import Avatar from "../components/Avatar.jsx";
import { IconCopy, IconLink, IconCheck, IconLogout, IconUsers } from "../components/Icons.jsx";

export default function Members() {
  const { user, activeCode, members, me, familyName, leaveFamily } = useApp();
  const [copied, setCopied] = useState("");
  const [leaving, setLeaving] = useState(false);

  async function copy(text, tag) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopied(tag);
    setTimeout(() => setCopied(""), 1800);
  }

  return (
    <div className="page narrow">
      <h2 className="page-title">Family</h2>

      <div className="panel invite-panel">
        <div className="invite-badge">
          <IconLink size={18} />
        </div>
        <h3>Invite your family</h3>
        <p className="muted">
          They open the app, sign in with Google, tap <b>Join</b> and enter this code:
        </p>
        <div className="code-display">{activeCode}</div>
        <div className="invite-actions">
          <button className="btn primary" onClick={() => copy(activeCode, "code")}>
            {copied === "code" ? <IconCheck size={16} /> : <IconCopy size={16} />}
            {copied === "code" ? "Copied!" : "Copy code"}
          </button>
          <button
            className="btn"
            onClick={() => copy(`${location.origin}${location.pathname}#${activeCode}`, "link")}
          >
            {copied === "link" ? <IconCheck size={16} /> : <IconLink size={16} />}
            {copied === "link" ? "Copied!" : "Copy invite link"}
          </button>
        </div>
      </div>

      <section className="panel">
        <header className="panel-head">
          <h3>
            <IconUsers size={18} /> {familyName || activeCode}
          </h3>
          <span className="count-pill">{members.length}</span>
        </header>
        <ul className="row-list">
          {members.map((m) => (
            <li key={m.id}>
              <Avatar src={m.photoURL} name={m.name} color={m.color} size={38} />
              <div className="row-body">
                <span className="row-title">
                  {m.name}
                  {m.id === user.uid && <span className="you-tag">you</span>}
                </span>
                {m.id === me?.id && <span className="row-sub">Signed in on this device</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="panel leave-panel">
        <div>
          <b>Leave this family</b>
          <p className="muted small">
            You'll be removed from {familyName || activeCode}. You can rejoin with the code anytime.
          </p>
        </div>
        <button
          className="btn danger"
          disabled={leaving}
          onClick={async () => {
            if (!confirm(`Leave ${familyName || activeCode}?`)) return;
            setLeaving(true);
            await leaveFamily();
          }}
        >
          <IconLogout size={16} /> Leave
        </button>
      </div>
    </div>
  );
}
