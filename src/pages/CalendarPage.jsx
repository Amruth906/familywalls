import React, { useMemo, useState } from "react";
import { doc, addDoc, deleteDoc } from "firebase/firestore";
import { useFamily, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { session, members, me } = useFamily();
  const { docs: events } = useCollection(session.code, "events");
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(ymd(today.getFullYear(), today.getMonth(), today.getDate()));

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!ev.date) continue;
      (map[ev.date] ||= []).push(ev);
    }
    return map;
  }, [events]);

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function nav(delta) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const upcoming = events
    .filter((e) => e.date >= ymd(today.getFullYear(), today.getMonth(), today.getDate()))
    .sort((a, b) => (a.date + (a.time || "") > b.date + (b.time || "") ? 1 : -1))
    .slice(0, 8);

  const dayEvents = (eventsByDate[selected] || []).sort((a, b) =>
    (a.time || "") > (b.time || "") ? 1 : -1
  );

  return (
    <div className="page">
      <h2>Calendar</h2>
      <div className="split cal-split">
        <section className="card">
          <div className="cal-head">
            <button className="btn ghost" onClick={() => nav(-1)}>‹</button>
            <h3>
              {MONTHS[view.m]} {view.y}
            </h3>
            <button className="btn ghost" onClick={() => nav(1)}>›</button>
          </div>

          <div className="cal-grid">
            {WEEK.map((w) => (
              <div key={w} className="dow">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={"e" + i} />;
              const dateStr = ymd(view.y, view.m, d);
              const isToday = dateStr === ymd(today.getFullYear(), today.getMonth(), today.getDate());
              const evs = eventsByDate[dateStr] || [];
              return (
                <button
                  key={dateStr}
                  className={
                    "day" +
                    (dateStr === selected ? " sel" : "") +
                    (isToday ? " today" : "")
                  }
                  onClick={() => setSelected(dateStr)}
                >
                  {d}
                  {evs.length > 0 && (
                    <span className="dots">
                      {evs.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className="dot"
                          style={{ background: memberById[ev.memberId]?.color || "#ff7a59" }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <AddEvent code={session.code} date={selected} meId={me?.id} members={members} />
        </section>

        <aside className="side card grow-card">
          <h3>{selected} · {dayEvents.length}</h3>
          <ul className="todo-list">
            {dayEvents.map((ev) => (
              <li key={ev.id}>
                <span className="dot big-dot" style={{ background: memberById[ev.memberId]?.color || "#ff7a59" }} />
                <div className="todo-body">
                  <span className="todo-text">
                    {ev.time && <b className="time">{ev.time}</b>} {ev.title}
                  </span>
                  {ev.note && <span className="todo-meta">{ev.note}</span>}
                </div>
                <button
                  className="x"
                  onClick={() => deleteDoc(doc(db, "families", session.code, "events", ev.id))}
                  title="Delete event"
                >
                  ✕
                </button>
              </li>
            ))}
            {!dayEvents.length && <p className="muted">No plans this day. Add one above 👆</p>}
          </ul>

          <h4 className="muted-head">Coming up</h4>
          <ul className="upcoming">
            {upcoming.map((ev) => (
              <li key={ev.id}>
                <button onClick={() => setSelected(ev.date)}>
                  <span className="dot" style={{ background: memberById[ev.memberId]?.color || "#ff7a59" }} />
                  <b>{ev.date}</b> {ev.time && <span>({ev.time})</span>} — {ev.title}
                </button>
              </li>
            ))}
            {!upcoming.length && <p className="muted">Nothing scheduled yet.</p>}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function AddEvent({ code, date, meId, members }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [memberId, setMemberId] = useState("");

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await addDoc(famCol(code, "events"), {
      title: title.trim(),
      date,
      time,
      memberId: memberId || meId || null,
      createdBy: meId || null,
      createdAt: Date.now(),
    });
    setTitle("");
    setTime("");
    setMemberId("");
  }

  return (
    <form className="add-row slim top-gap" onSubmit={add}>
      <input
        className="grow"
        placeholder={`New event on ${date}…`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
        <option value="">Whose?</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button className="btn primary">Add</button>
    </form>
  );
}
