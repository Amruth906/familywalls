import React, { useMemo, useState } from "react";
import { doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useApp, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import { IconPlus, IconX } from "../components/Icons.jsx";

export default function Todos() {
  const { user, activeCode, members, me } = useApp();
  const { docs: todos, loading } = useCollection(activeCode, "todos");
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState("all");

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  function todoDoc(id) {
    return doc(db, "families", activeCode, "todos", id);
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(famCol(activeCode, "todos"), {
      text: text.trim(),
      assigneeId: assignee || user.uid,
      dueDate: due || null,
      done: false,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setText("");
    setDue("");
    setAssignee("");
  }

  function byFilter(t) {
    if (filter === "all") return true;
    if (filter === "mine") return t.assigneeId === user.uid;
    return t.assigneeId === filter;
  }

  const filtered = todos.filter(byFilter);
  const open = filtered
    .filter((t) => !t.done)
    .sort((a, b) => ((a.dueDate || "9999") > (b.dueDate || "9999") ? 1 : -1));
  const done = filtered.filter((t) => t.done).sort((a, b) => b.createdAt - a.createdAt);
  const myOpenCount = todos.filter((t) => !t.done && t.assigneeId === user.uid).length;

  return (
    <div className="page">
      <h2 className="page-title">To-Dos</h2>

      <form className="add-row panel" onSubmit={addTodo}>
        <input
          className="grow"
          placeholder="Add a task… e.g. Pay electricity bill"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Assign to me</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === user.uid ? `${m.name} (me)` : m.name}
            </option>
          ))}
        </select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="btn primary">
          <IconPlus size={17} /> Add
        </button>
      </form>

      <div className="chips">
        <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
          All
        </button>
        <button className={"chip" + (filter === "mine" ? " on" : "")} onClick={() => setFilter("mine")}>
          Mine ({myOpenCount})
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            className={"chip" + (filter === m.id ? " on" : "")}
            style={
              filter === m.id
                ? { background: m.color, borderColor: m.color, color: "#fff" }
                : {}
            }
            onClick={() => setFilter(m.id)}
          >
            <span className="dot" style={{ background: m.color }} /> {m.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}

      <TodoList title={`Open · ${open.length}`} items={open} memberById={memberById} code={activeCode} />
      <TodoList title={`Done · ${done.length}`} items={done} memberById={memberById} code={activeCode} />
    </div>
  );
}

function TodoList({ title, items, memberById, code }) {
  const today = new Date().toISOString().slice(0, 10);
  if (!items.length) return null;
  return (
    <section className="panel">
      <header className="panel-head">
        <h3>{title}</h3>
      </header>
      <ul className="row-list">
        {items.map((t) => {
          const m = memberById[t.assigneeId];
          return (
            <li key={t.id} className={"check-row" + (t.done ? " is-done" : "")}>
              <input
                type="checkbox"
                checked={!!t.done}
                onChange={() =>
                  updateDoc(doc(db, "families", code, "todos", t.id), { done: !t.done })
                }
              />
              <div className="row-body">
                <span className="row-title">{t.text}</span>
                <span className="row-sub">
                  {m && (
                    <>
                      <span className="dot" style={{ background: m.color }} /> {m.name.split(" ")[0]}
                    </>
                  )}
                  {t.dueDate && (
                    <span className={"due" + (!t.done && t.dueDate < today ? " overdue" : "")}>
                      · {t.dueDate}
                    </span>
                  )}
                </span>
              </div>
              <button
                className="icon-btn danger"
                onClick={() => deleteDoc(doc(db, "families", code, "todos", t.id))}
                title="Delete"
              >
                <IconX size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
