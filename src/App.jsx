import React, { useEffect, useState } from "react";
import { AppProvider, useApp } from "./store.jsx";
import { isConfigured } from "./firebase.js";
import { onDbError } from "./dbError.js";
import { Logo, IconHome, IconCheckSquare, IconCart, IconCalendar, IconUsers, IconLogout, IconCopy, IconWallet, IconMeal, IconFolder, IconMap, IconChat, IconGrid } from "./components/Icons.jsx";
import LoginScreen from "./pages/LoginScreen.jsx";
import FamilySetup from "./pages/FamilySetup.jsx";
import Home from "./pages/Home.jsx";
import Todos from "./pages/Todos.jsx";
import ListsPage from "./pages/ListsPage.jsx";
import Budget from "./pages/Budget.jsx";
import MealPlanner from "./pages/MealPlanner.jsx";
import Documents from "./pages/Documents.jsx";
import MapPage from "./pages/MapPage.jsx";
import Messages from "./pages/Messages.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import Members from "./pages/Members.jsx";
import Avatar from "./components/Avatar.jsx";
import "./styles.css";

const NAV = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "todos", label: "To-Dos", Icon: IconCheckSquare },
  { id: "lists", label: "Lists", Icon: IconCart },
  { id: "budget", label: "Budget", Icon: IconWallet },
  { id: "meals", label: "Meals", Icon: IconMeal },
  { id: "docs", label: "Docs", Icon: IconFolder },
  { id: "map", label: "Map", Icon: IconMap },
  { id: "chat", label: "Chat", Icon: IconChat },
  { id: "calendar", label: "Calendar", Icon: IconCalendar },
  { id: "members", label: "Family", Icon: IconUsers },
];

export const VERSION = "2.1.0";

function Splash() {
  return (
    <div className="splash">
      <Logo size={64} />
      <div className="splash-ring" />
    </div>
  );
}

function SetupGate() {
  const { authLoading, profileLoading, user, families, activeCode, familyName } = useApp();

  if (!isConfigured)
    return (
      <div className="auth-bg">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="setup-card">
          <div className="setup-head">
            <Logo size={34} />
            <h2>Quick setup needed</h2>
          </div>
          <ol className="setup-steps">
            <li>Create a free project at console.firebase.google.com</li>
            <li>Register a web app and copy the firebaseConfig</li>
            <li>Paste it into <code>src/firebase.js</code></li>
            <li>Create a Firestore database and publish the rules from <code>firestore.rules</code></li>
          </ol>
          <p className="ver">v{VERSION}</p>
        </div>
      </div>
    );

  if (authLoading || (user && profileLoading)) return <Splash />;
  if (!user) return <LoginScreen />;
  if (!families.length && !activeCode) return <FamilySetup />;
  if (!activeCode) return <Splash />;
  return <Shell key={activeCode} />;
}

function Shell() {
  const { user, familyName, activeCode, families, setActiveCode, signOut } = useApp();
  const [tab, setTab] = useState("home");
  const [islandOpen, setIslandOpen] = useState(false);

  function goto(id) {
    setTab(id);
    setIslandOpen(false);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <Logo size={34} />
          <div className="side-wordmark">
            Family<span>Hub</span>
          </div>
        </div>

        {families.length > 1 && (
          <select
            className="fam-switch"
            value={activeCode}
            onChange={(e) => setActiveCode(e.target.value)}
          >
            {families.map((c) => (
              <option key={c} value={c}>
                {c === activeCode ? familyName || c : c}
              </option>
            ))}
          </select>
        )}

        <nav className="side-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} className={"nav-item" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div className="side-user">
            <Avatar src={user.photoURL} name={user.displayName} color="#4f8cff" size={36} />
            <div className="side-user-info">
              <b>{user.displayName}</b>
              <span className="muted">{activeCode}</span>
            </div>
          </div>
          <button className="icon-btn" title="Sign out" onClick={signOut}>
            <IconLogout size={18} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="mobile-top">
          <div className="mobile-brand">
            <Logo size={30} />
            <div>
              <div className="mobile-fam">{familyName}</div>
              <button
                className="invite-btn"
                onClick={() => navigator.clipboard?.writeText(activeCode)}
                title="Copy family code"
              >
                <IconCopy size={12} /> {activeCode}
              </button>
            </div>
          </div>
          <button className={"family-top-btn" + (tab === "members" ? " on" : "")} onClick={() => goto("members")}>
            <IconUsers size={16} /> Family
          </button>
        </header>

        <div className="island-bar">
          <div className="island">
            <button className={"island-seg" + (tab === "home" && !islandOpen ? " on" : "")} onClick={() => goto("home")}>
              <IconHome size={17} /> Home
            </button>
            <button className={"island-seg" + (islandOpen ? " on" : "")} onClick={() => setIslandOpen((o) => !o)}>
              <IconGrid size={16} /> More
            </button>
          </div>
          {islandOpen && (
            <>
              <div className="island-backdrop" onClick={() => setIslandOpen(false)} />
              <div className="island-menu">
                {NAV.filter((t) => t.id !== "home").map(({ id, label, Icon }) => (
                  <button key={id} className={"island-item" + (tab === id ? " on" : "")} onClick={() => goto(id)}>
                    <Icon size={21} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <main className="content">
          <div className="page-anim" key={tab}>
            {tab === "home" && <Home goto={setTab} />}
            {tab === "todos" && <Todos />}
            {tab === "lists" && <ListsPage />}
            {tab === "budget" && <Budget />}
            {tab === "meals" && <MealPlanner />}
            {tab === "docs" && <Documents />}
            {tab === "map" && <MapPage />}
            {tab === "chat" && <Messages />}
            {tab === "calendar" && <CalendarPage />}
            {tab === "members" && <Members />}
          </div>
        </main>
      </div>
    </div>
  );
}

function DbBanner() {
  const [msg, setMsg] = useState(null);
  useEffect(() => onDbError(setMsg), []);
  if (!msg) return null;
  return (
    <div className="db-banner" onClick={() => setMsg(null)}>
      <span>⚠️ {msg}</span>
      <b>✕</b>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <DbBanner />
      <SetupGate />
    </AppProvider>
  );
}
