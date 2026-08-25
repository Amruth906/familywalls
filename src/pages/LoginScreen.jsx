import React, { useState } from "react";
import { useApp } from "../store.jsx";
import { GoogleIcon, Logo, IconHeart, IconCalendar, IconCheckSquare, IconCart } from "../components/Icons.jsx";

export default function LoginScreen() {
  const { signInWithGoogle } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user") setError("Sign-in was closed before finishing.");
      else if (e.code === "auth/popup-blocked")
        setError("Your browser blocked the popup — allow popups and try again.");
      else if (e.code === "auth/unauthorized-domain")
        setError("This website domain isn't authorized in Firebase yet. See README step 1.4.");
      else setError(e.message || "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-bg">
      <div className="blob blob-a" />
      <div className="blob blob-b" />

      <div className="auth-card">
        <div className="auth-logo">
          <Logo size={56} />
        </div>
        <h1 className="auth-title">
          Family<span>Hub</span>
        </h1>
        <p className="auth-sub">
          One shared wall for your family — tasks, lists and dates, synced live on everyone's phone.
        </p>

        <button className="google-btn" onClick={login} disabled={busy}>
          <GoogleIcon size={22} />
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        {error && <div className="error">{error}</div>}

        <div className="auth-features">
          <div>
            <IconCheckSquare size={18} />
            <span>Shared to-dos</span>
          </div>
          <div>
            <IconCart size={18} />
            <span>Family lists</span>
          </div>
          <div>
            <IconCalendar size={18} />
            <span>Dates & events</span>
          </div>
          <div>
            <IconHeart size={18} />
            <span>Real-time sync</span>
          </div>
        </div>
      </div>

      <p className="auth-foot">Free forever · Your own private family space</p>
    </div>
  );
}
