import React, { useState } from "react";
import { useFamily } from "../store.jsx";

export default function JoinScreen() {
  const { createFamily, joinFamily } = useFamily();
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [familyName, setFamilyName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!memberName.trim()) return setError("Please enter your name.");
    if (mode === "join" && code.trim().length !== 6)
      return setError("Family code must be 6 characters.");
    setBusy(true);
    try {
      if (mode === "create") await createFamily(familyName, memberName);
      else await joinFamily(code.trim().toUpperCase(), memberName);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      {!mode && (
        <div className="card welcome-card">
          <div className="logo-big">🏠</div>
          <h1>FamilyHub</h1>
          <p className="tagline">Your family's shared wall — to-dos, lists & dates in one place.</p>
          <button className="btn primary big" onClick={() => setMode("create")}>
            Create a new family
          </button>
          <button className="btn big" onClick={() => setMode("join")}>
            Join with a family code
          </button>
        </div>
      )}

      {mode && (
        <form className="card welcome-card" onSubmit={submit}>
          <button type="button" className="back" onClick={() => setMode(null)}>
            ← Back
          </button>
          <h2>{mode === "create" ? "Start your family wall" : "Join your family"}</h2>

          {mode === "create" ? (
            <label className="field">
              Family name
              <input
                autoFocus
                placeholder="The Sharma Family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                maxLength={40}
              />
            </label>
          ) : (
            <label className="field">
              Family code
              <input
                autoFocus
                className="code-input"
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </label>
          )}

          <label className="field">
            Your name
            <input
              placeholder="Amrut"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              maxLength={24}
            />
          </label>

          {error && <div className="error">{error}</div>}
          <button className="btn primary big" disabled={busy}>
            {busy ? "Please wait…" : mode === "create" ? "Create family 🎉" : "Join family"}
          </button>

          {mode === "create" && (
            <p className="muted small">
              You'll get a 6-letter invite code to share with your family after creating.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
