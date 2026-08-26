import React, { useState } from "react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { useApp, colorForUid } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import Avatar from "../components/Avatar.jsx";
import { IconCopy, IconLink, IconCheck, IconLogout, IconUsers, IconX } from "../components/Icons.jsx";

export default function Members() {
  const { user, activeCode, members, me, familyName, familyCreatedBy, leaveFamily, signOut, approveJoinRequest, rejectJoinRequest } = useApp();
  const { docs: joinRequests } = useCollection(activeCode, "joinRequests");
  const isCreator = familyCreatedBy === user.uid;
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

      <div className="fam-info-bar">
        <span className="fam-info-name">👨‍👩‍👧‍👦 {familyName || "My Family"}</span>
        <button
          className="fam-info-code"
          onClick={() => copy(activeCode, "top")}
          title="Copy family code"
        >
          code: <b>{activeCode}</b> {copied === "top" ? "✓" : "📋"}
        </button>
      </div>

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

      {isCreator && (
        <section className="panel">
          <header className="panel-head">
            <h3>
              🔔 Join requests {joinRequests.length > 0 && <span className="count-pill">{joinRequests.length}</span>}
            </h3>
          </header>
          <ul className="row-list">
            {joinRequests.map((r) => (
              <li key={r.uid}>
                <Avatar src={r.photoURL} name={r.name} color={colorForUid(r.uid)} size={38} />
                <div className="row-body">
                  <span className="row-title">
                    <b>{r.name}</b> wants to join your family
                  </span>
                  <span className="row-sub">Approving gives them full access</span>
                </div>
                <button
                  className="btn tiny primary"
                  onClick={async () => {
                    try {
                      await approveJoinRequest(r);
                    } catch (e) {
                      alert("Couldn't approve: " + (e.message || e));
                    }
                  }}
                >
                  <IconCheck size={14} /> Accept
                </button>
                <button
                  className="icon-btn danger"
                  title="Reject"
                  onClick={async () => {
                    try {
                      await rejectJoinRequest(r);
                    } catch (e) {
                      alert("Couldn't reject: " + (e.message || e));
                    }
                  }}
                >
                  <IconX size={15} />
                </button>
              </li>
            ))}
            {!joinRequests.length && <p className="empty">No pending requests. Share your code above 👆</p>}
          </ul>
        </section>
      )}

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
          <b>{user.displayName}</b>
          <p className="muted small">{user.email || "Signed in with Google"}</p>
        </div>
        <button className="btn danger" onClick={signOut}>
          <IconLogout size={16} /> Sign out
        </button>
      </div>

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
