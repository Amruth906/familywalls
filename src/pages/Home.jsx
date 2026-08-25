import React from "react";
import { useFamily } from "../store.jsx";
import { useCollection } from "../useData.js";

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export default function Home({ goto }) {
  const { session, members, me, familyName } = useFamily();
  const { docs: todos } = useCollection(session.code, "todos");
  const { docs: events } = useCollection(session.code, "events");

  const today = todayStr();
  const myOpen = todos.filter((t) => !t.done && t.assigneeId === session.memberId);
  const dueToday = myOpen.filter((t) => t.dueDate && t.dueDate <= today);
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + (a.time || "") > b.date + (b.time || "") ? 1 : -1))
    .slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="page">
      <h2>
        {greeting}, {me?.name || "there"} 👋
      </h2>
      <p className="muted sub">{new Date().toDateString()} · {familyName}</p>

      <div className="stats">
        <button className="stat card" onClick={() => goto("todos")}>
          <span className="stat-num">{myOpen.length}</span>
          <span>My open tasks</span>
          {dueToday.length > 0 && <span className="badge warm">{dueToday.length} due today</span>}
        </button>
        <button className="stat card" onClick={() => goto("calendar")}>
          <span className="stat-num">{upcoming.length}</span>
          <span>Upcoming dates</span>
        </button>
        <button className="stat card" onClick={() => goto("lists")}>
          <span className="stat-num">{members.length}</span>
          <span>Family members</span>
        </button>
      </div>

      <section className="card list-card">
        <h3>🗓 Coming up next</h3>
        <ul className="upcoming big">
          {upcoming.map((ev) => (
            <li key={ev.id}>
              <span className="dot big-dot" style={{ background: memberById[ev.memberId]?.color || "#ff7a59" }} />
              <b>{ev.date}</b>
              {ev.time && <span className="time"> {ev.time}</span>} — {ev.title}
            </li>
          ))}
          {!upcoming.length && <p className="muted">No events yet — add birthdays, appointments & plans in Calendar.</p>}
        </ul>
      </section>

      <section className="card list-card">
        <h3>✅ My tasks</h3>
        <ul className="todo-list">
          {myOpen.slice(0, 6).map((t) => (
            <li key={t.id}>
              <span className={"dot"} style={{ background: me?.color || "#4f8cff" }} />
              <span className="todo-text">{t.text}</span>
              {t.dueDate && <span className="due">{t.dueDate}</span>}
            </li>
          ))}
          {!myOpen.length && <p className="muted">All clear! Nothing assigned to you 🎉</p>}
        </ul>
        <button className="btn" onClick={() => goto("todos")}>
          See all to-dos →
        </button>
      </section>
    </div>
  );
}
