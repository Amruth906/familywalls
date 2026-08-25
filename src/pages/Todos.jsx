import React, { useMemo, useState } from "react";
import { doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useFamily, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";

export default function Todos() {
  const { session, members, me } = useFamily();
  const { docs: todos, loading } = useCollection(session.code, "todos");
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState("all");

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  function todoDoc(id) {
    return doc(db, "families", session.code, "todos", id);
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(famCol(session.code, "todos"), {
      text: text.trim(),
      assigneeId: assignee || me?.id || null,
      dueDate: due || null,
      done: false,
      createdBy: me?.id || null,
      createdAt: Date.now(),
    });
    setText("");
    setDue("");
    setAssignee("");
  }

  function byFilter(t) {
    if (filter === "all") return true;
    if (filter === "mine") return t.assigneeId === session.memberId;
    return t.assigneeId === filter;
  }

  const filtered = todos.filter(byFilter);
  const open = filtered
    .filter((t) => !t.done)
    .sort((a, b) => ((a.dueDate || "9999") > (b.dueDate || "9999") ? 1 : -1));
  const done = filtered.filter((t) => t.done).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="page">
      <h2>To-Dos</h2>

      <form className="add-row card" onSubmit={addTodo}>
        <input
          className="grow"
          placeholder="Add a task… e.g. Pay electricity bill"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Assign to…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === me?.id ? `${m.name} (me)` : m.name}
            </option>
          ))}
        </select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="btn primary">Add</button>
      </form>

      <div className="chips">
        <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
          All
        </button>
        <button
          className={"chip" + (filter === "mine" ? " on" : "")}
          onClick={() => setFilter("mine")}
        >
          Mine ({todos.filter((t) => !t.done && t.assigneeId === session.memberId).length})
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
            <span className="dot" style={{ background: m.color }} /> {m.name}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}

      <TodoList title={`Open (${open.length})`} items={open} memberById={memberById} code={session.code} />
      <TodoList title={`Done (${done.length})`} items={done} memberById={memberById} code={session.code} />
    </div>
  );
}

function TodoList({ title, items, memberById, code }) {
  const today = new Date().toISOString().slice(0, 10);
  if (!items.length) return null;
  return (
    <section className="card list-card">
      <h3>{title}</h3>
      <ul className="todo-list">
        {items.map((t) => {
          const m = memberById[t.assigneeId];
          return (
            <li key={t.id} className={"todo-item" + (t.done ? " is-done" : "")}>
              <input
                type="checkbox"
                checked={!!t.done}
                onChange={() =>
                  updateDoc(doc(db, "families", code, "todos", t.id), { done: !t.done })
                }
              />
              <div className="todo-body">
                <span className="todo-text">{t.text}</span>
                <span className="todo-meta">
                  {m && (
                    <>
                      <span className="dot" style={{ background: m.color }} /> {m.name}
                    </>
                  )}
                  {t.dueDate && (
                    <span className={"due" + (!t.done && t.dueDate < today ? " overdue" : "")}>
                      · 📅 {t.dueDate}
                    </span>
                  )}
                </span>
              </div>
              <button
                className="x"
                onClick={() => deleteDoc(doc(db, "families", code, "todos", t.id))}
                title="Delete"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
