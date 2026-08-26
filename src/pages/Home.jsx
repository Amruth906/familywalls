import React from "react";
import { useApp } from "../store.jsx";
import { useCollection } from "../useData.js";
import { IconCheckSquare, IconCalendar, IconUsers, IconChevronRight } from "../components/Icons.jsx";

const SLOTS = [
  { id: "breakfast", label: "Breakfast", emoji: "☀️" },
  { id: "lunch", label: "Lunch", emoji: "🍽️" },
  { id: "dinner", label: "Dinner", emoji: "🌙" },
  { id: "snacks", label: "Snacks", emoji: "🍪" },
];

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export default function Home({ goto }) {
  const { user, activeCode, members, me, familyName } = useApp();
  const { docs: todos } = useCollection(activeCode, "todos");
  const { docs: events } = useCollection(activeCode, "events");
  const { docs: meals } = useCollection(activeCode, "meals");

  const today = todayStr();
  const myOpen = todos.filter((t) => !t.done && t.assigneeId === user.uid);
  const dueToday = myOpen.filter((t) => t.dueDate && t.dueDate <= today);
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const todaysMeals = meals.filter((m) => m.date === today);

  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + (a.time || "") > b.date + (b.time || "") ? 1 : -1))
    .slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.displayName || "there").split(" ")[0];

  return (
    <div className="page">
      <section className="hero card-grad">
        <div>
          <p className="hero-hi">{greeting},</p>
          <h2 className="hero-name">{firstName} 👋</h2>
          <p className="hero-fam">{familyName} · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
      </section>

      <div className="stats">
        <button className="stat" onClick={() => goto("todos")}>
          <span className="stat-icon i1"><IconCheckSquare size={20} /></span>
          <span className="stat-num">{myOpen.length}</span>
          <span className="stat-label">My open tasks</span>
          {dueToday.length > 0 && <span className="badge warm">{dueToday.length} due today</span>}
        </button>
        <button className="stat" onClick={() => goto("calendar")}>
          <span className="stat-icon i2"><IconCalendar size={20} /></span>
          <span className="stat-num">{upcoming.length}</span>
          <span className="stat-label">Upcoming dates</span>
        </button>
        <button className="stat" onClick={() => goto("members")}>
          <span className="stat-icon i3"><IconUsers size={20} /></span>
          <span className="stat-num">{members.length}</span>
          <span className="stat-label">Family members</span>
        </button>
      </div>

      <section className="panel">
        <header className="panel-head">
          <h3>🍽️ Today's meals</h3>
          <button className="linklike" onClick={() => goto("meals")}>
            Plan week <IconChevronRight size={14} />
          </button>
        </header>
        <div className="meal-widget">
          {SLOTS.map((s) => {
            const m = todaysMeals.find((x) => x.slot === s.id);
            return (
              <div key={s.id} className={"meal-slot" + (m ? " has" : "")}>
                <span className="meal-slot-label">
                  {s.emoji} {s.label}
                </span>
                <span className="meal-slot-title">{m ? m.title : "—"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <header className="panel-head">
            <h3>Coming up next</h3>
            <button className="linklike" onClick={() => goto("calendar")}>
              All <IconChevronRight size={14} />
            </button>
          </header>
          <ul className="row-list">
            {upcoming.map((ev) => (
              <li key={ev.id}>
                <span className="dot big-dot" style={{ background: memberById[ev.memberId]?.color || "#ff6b4a" }} />
                <div className="row-body">
                  <span className="row-title">
                    {ev.time && <b className="time">{ev.time}</b>} {ev.title}
                  </span>
                  <span className="row-sub">{ev.date}</span>
                </div>
              </li>
            ))}
            {!upcoming.length && <p className="empty">No events yet — add birthdays, appointments & plans.</p>}
          </ul>
        </section>

        <section className="panel">
          <header className="panel-head">
            <h3>My tasks</h3>
            <button className="linklike" onClick={() => goto("todos")}>
              All <IconChevronRight size={14} />
            </button>
          </header>
          <ul className="row-list">
            {myOpen.slice(0, 6).map((t) => (
              <li key={t.id}>
                <span className="dot big-dot" style={{ background: me?.color || "#ff6b4a" }} />
                <div className="row-body">
                  <span className="row-title">{t.text}</span>
                  {t.dueDate && <span className="row-sub">{t.dueDate}</span>}
                </div>
              </li>
            ))}
            {!myOpen.length && <p className="empty">All clear! Nothing assigned to you 🎉</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}
