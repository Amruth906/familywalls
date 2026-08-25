import React, { useMemo, useState } from "react";
import { doc, addDoc, deleteDoc } from "firebase/firestore";
import { useApp, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import { IconChevronLeft, IconChevronRight, IconPlus, IconX } from "../components/Icons.jsx";

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { user, activeCode, members, me } = useApp();
  const { docs: events } = useCollection(activeCode, "events");
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
      <h2 className="page-title">Calendar</h2>
      <div className="split cal-split">
        <section className="panel">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => nav(-1)}>
              <IconChevronLeft size={18} />
            </button>
            <h3>
              {MONTHS[view.m]} <span className="muted">{view.y}</span>
            </h3>
            <button className="icon-btn" onClick={() => nav(1)}>
              <IconChevronRight size={18} />
            </button>
          </div>

          <div className="cal-grid">
            {WEEK.map((w, i) => (
              <div key={i} className="dow">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={"e" + i} />;
              const dateStr = ymd(view.y, view.m, d);
              const isToday = dateStr === ymd(today.getFullYear(), today.getMonth(), today.getDate());
              const evs = eventsByDate[dateStr] || [];
              return (
                <button
                  key={dateStr}
                  className={"day" + (dateStr === selected ? " sel" : "") + (isToday ? " today" : "")}
                  onClick={() => setSelected(dateStr)}
                >
                  <span>{d}</span>
                  {evs.length > 0 && (
                    <span className="dots">
                      {evs.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className="dot"
                          style={{ background: memberById[ev.memberId]?.color || "#ff6b4a" }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <AddEvent code={activeCode} date={selected} meId={user.uid} members={members} fallbackColor={me?.color} />
        </section>

        <aside className="panel side-panel">
          <header className="panel-head">
            <h3>
              {new Date(selected + "T00:00").toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </h3>
            <span className="count-pill">{dayEvents.length}</span>
          </header>

          <ul className="row-list">
            {dayEvents.map((ev) => (
              <li key={ev.id}>
                <span
                  className="dot big-dot"
                  style={{ background: memberById[ev.memberId]?.color || "#ff6b4a" }}
                />
                <div className="row-body">
                  <span className="row-title">
                    {ev.time && <b className="time">{ev.time}</b>} {ev.title}
                  </span>
                  {ev.note && <span className="row-sub">{ev.note}</span>}
                </div>
                <button
                  className="icon-btn danger"
                  onClick={() => deleteDoc(doc(db, "families", activeCode, "events", ev.id))}
                  title="Delete event"
                >
                  <IconX size={16} />
                </button>
              </li>
            ))}
            {!dayEvents.length && <p className="empty">No plans this day.</p>}
          </ul>

          <h4 className="muted-head">Coming up</h4>
          <ul className="upcoming">
            {upcoming.map((ev) => (
              <li key={ev.id}>
                <button onClick={() => setSelected(ev.date)}>
                  <span className="dot" style={{ background: memberById[ev.memberId]?.color || "#ff6b4a" }} />
                  <b>{ev.date.slice(5)}</b>
                  {ev.time && <span className="time"> {ev.time}</span>}
                  <span className="up-title"> — {ev.title}</span>
                </button>
              </li>
            ))}
            {!upcoming.length && <p className="empty">Nothing scheduled.</p>}
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
      memberId: memberId || meId,
      createdBy: meId,
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
            {m.name.split(" ")[0]}
          </option>
        ))}
      </select>
      <button className="btn primary">
        <IconPlus size={16} />
      </button>
    </form>
  );
}
