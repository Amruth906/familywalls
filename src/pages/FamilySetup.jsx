import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../store.jsx";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../firebase.js";
import { Logo, IconArrowLeft, IconSparkles, IconLink, IconCheck } from "../components/Icons.jsx";
import { VERSION } from "../App.jsx";

export default function FamilySetup() {
  const { user, createFamily, joinFamily, signOut } = useApp();
  const [mode, setMode] = useState("create");
  const [famName, setFamName] = useState("");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState(
    () => (location.hash || "").replace("#", "").toUpperCase().slice(0, 16)
  );
  const [avail, setAvail] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setAvail(null);
    if (mode !== "create" || code.trim().length < 3) return;
    setChecking(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, "families", code.trim().toUpperCase()));
        setAvail(snap.exists() ? "taken" : "free");
      } catch {
        setAvail(null);
      }
      setChecking(false);
    }, 450);
    return () => clearTimeout(timer.current);
  }, [code, mode]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "create") await createFamily(famName, code);
      else await joinFamily(joinCode);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setBusy(false);
      setAvail(null);
    }
  }

  const codeOk = /^[A-Za-z0-9-]{3,16}$/.test(code.trim());

  return (
    <div className="auth-bg">
      <div className="blob blob-a" />
      <div className="blob blob-b" />

      <div className="setup-card">
        <div className="setup-head">
          <Logo size={34} />
          <div>
            <h2>{mode === "create" ? "Start your family wall" : "Join your family"}</h2>
            <p className="muted">
              Signed in as <b>{user.displayName}</b> ·{" "}
              <button className="linklike" onClick={signOut}>
                switch account
              </button>
            </p>
          </div>
        </div>

        <div className="seg">
          <button className={mode === "create" ? "on" : ""} onClick={() => setMode("create")}>
            <IconSparkles size={16} /> Create
          </button>
          <button className={mode === "join" ? "on" : ""} onClick={() => setMode("join")}>
            <IconLink size={16} /> Join
          </button>
        </div>

        <form onSubmit={submit} className="setup-form">
          {mode === "create" ? (
            <>
              <label className="field">
                Family name
                <input
                  autoFocus
                  placeholder="The Gadala Family"
                  value={famName}
                  onChange={(e) => setFamName(e.target.value)}
                  maxLength={40}
                />
              </label>
              <label className="field">
                Choose your family code
                <input
                  className={`code-input ${avail === "taken" ? "bad" : avail === "free" ? "good" : ""}`}
                  placeholder="e.g. GADALA-7"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  maxLength={16}
                />
              </label>
              <div className="code-hint">
                {code.trim().length >= 3 &&
                  (checking ? (
                    <span className="muted">Checking…</span>
                  ) : avail === "free" ? (
                    <span className="ok">
                      <IconCheck size={14} /> {code} is available
                    </span>
                  ) : avail === "taken" ? (
                    <span className="bad-text">That code is taken — try another</span>
                  ) : (
                    <span className="muted">3–16 letters, numbers or dashes</span>
                  ))}
                {code.trim().length < 3 && (
                  <span className="muted">This is the code your family will use to join</span>
                )}
              </div>
            </>
          ) : (
            <label className="field">
              Family code
              <input
                autoFocus
                className="code-input"
                placeholder="ABC-123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                maxLength={16}
              />
            </label>
          )}

          {error && <div className="error">{error}</div>}

          <button
            className="btn primary big"
            disabled={
              busy ||
              (mode === "create" ? !codeOk || !famName.trim() || avail === "taken" : joinCode.trim().length < 3)
            }
          >
            {busy ? "Please wait…" : mode === "create" ? "Create family wall" : "Join family"}
          </button>
        </form>

        <button className="back" onClick={() => setMode(mode === "create" ? "join" : "create")}>
          <IconArrowLeft size={16} />
          {mode === "create" ? "I have a code instead" : "Create a new family instead"}
        </button>

        <p className="ver">v{VERSION}</p>
      </div>
    </div>
  );
}
