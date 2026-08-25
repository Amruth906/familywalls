import React, { useState } from "react";
import { FamilyProvider, useFamily } from "./store.jsx";
import { isConfigured } from "./firebase.js";
import JoinScreen from "./pages/JoinScreen.jsx";
import Home from "./pages/Home.jsx";
import Todos from "./pages/Todos.jsx";
import ListsPage from "./pages/ListsPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import Members from "./pages/Members.jsx";

const TABS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "todos", label: "To-Dos", icon: "✅" },
  { id: "lists", label: "Lists", icon: "🛒" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "members", label: "Family", icon: "👨‍👩‍👧‍👦" },
];

function SetupScreen() {
  return (
    <div className="center-screen">
      <div className="card setup-card">
        <div className="logo-big">🏠</div>
        <h1>FamilyHub needs a quick setup</h1>
        <ol>
          <li>
            Go to{" "}
            <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
              console.firebase.google.com
            </a>{" "}
            and create a free project.
          </li>
          <li>
            Click the <b>&lt;/&gt;</b> (web) icon, register an app, and copy the{" "}
            <b>firebaseConfig</b> object.
          </li>
          <li>
            Open <code>src/firebase.js</code> and paste your values over the
            PASTE_YOUR_... placeholders.
          </li>
          <li>
            In Firebase console: <b>Build → Firestore Database → Create database</b>.
          </li>
          <li>Restart / redeploy the app.</li>
        </ol>
        <p className="muted">Full guide with pictures-free steps is in README.md</p>
      </div>
    </div>
  );
}

function Shell() {
  const { session, familyName, members, me, switchMember, leaveFamily } = useFamily();
  const [tab, setTab] = useState("home");

  if (!session) return <JoinScreen />;

  const code = session.code;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🏠</span>
          <div>
            <div className="fam-name">{familyName}</div>
            <button
              className="invite-btn"
              title="Copy invite code"
              onClick={() => navigator.clipboard?.writeText(code)}
            >
              Code: <b>{code}</b> 📋
            </button>
          </div>
        </div>

        {me && (
          <div className="top-right">
            <select
              className="who"
              value={me.id}
              onChange={(e) => switchMember(e.target.value)}
              style={{ borderColor: me.color }}
              title="Who are you?"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button className="leave" onClick={leaveFamily} title="Leave family">
              ⎋
            </button>
          </div>
        )}
      </header>

      <main className="content">
        {tab === "home" && <Home goto={setTab} />}
        {tab === "todos" && <Todos />}
        {tab === "lists" && <ListsPage />}
        {tab === "calendar" && <CalendarPage />}
        {tab === "members" && <Members />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  if (!isConfigured) return <SetupScreen />;
  return (
    <FamilyProvider>
      <Shell />
    </FamilyProvider>
  );
}
