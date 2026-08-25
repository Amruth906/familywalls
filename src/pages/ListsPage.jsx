import React, { useEffect, useState } from "react";
import { doc, addDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { useFamily, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";

const EMOJIS = ["🛒", "🧾", "🎂", "🎁", "🧳", "🏡", "💡", "📦"];

export default function ListsPage() {
  const { session, me, members } = useFamily();
  const { docs: lists, loading } = useCollection(session.code, "lists");
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  const selected = lists.find((l) => l.id === selectedId) || lists[0] || null;
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  async function createList(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const ref = await addDoc(famCol(session.code, "lists"), {
      name: newName.trim(),
      emoji,
      createdBy: me?.id || null,
      createdAt: Date.now(),
    });
    setNewName("");
    setSelectedId(ref.id);
  }

  async function deleteList(id) {
    if (!confirm("Delete this whole list?")) return;
    await deleteDoc(doc(db, "families", session.code, "lists", id));
    setSelectedId(null);
  }

  return (
    <div className="page">
      <h2>Lists</h2>
      <div className="split">
        <aside className="side card">
          <form className="new-list" onSubmit={createList}>
            <div className="emoji-row">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  className={"emoji" + (emoji === e ? " on" : "")}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
            <input placeholder="New list name…" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn primary">Create</button>
          </form>

          <ul className="mini-nav">
            {loading && <p className="muted">Loading…</p>}
            {lists.map((l) => (
              <li key={l.id}>
                <button
                  className={"mini-item" + (selected?.id === l.id ? " on" : "")}
                  onClick={() => setSelectedId(l.id)}
                >
                  <span>{l.emoji}</span> {l.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {selected ? (
          <ListDetail code={session.code} list={selected} memberById={memberById} onDelete={deleteList} />
        ) : (
          !loading && (
            <div className="card empty-card">
              <p>No lists yet. Create one on the left 👈</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ListDetail({ code, list, memberById, onDelete }) {
  const [text, setText] = useState("");
  const { docs: items } = useSubItems(code, list.id);

  function itemDoc(id) {
    return doc(db, "families", code, "lists", list.id, "items", id);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(famCol(code, `lists/${list.id}/items`), {
      text: text.trim(),
      checked: false,
      addedBy: null,
      createdAt: Date.now(),
    });
    setText("");
  }

  const open = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <section className="card grow-card">
      <header className="detail-head">
        <h3>
          {list.emoji} {list.name}
        </h3>
        <button className="x big-x" title="Delete list" onClick={() => onDelete(list.id)}>
          🗑
        </button>
      </header>

      <form className="add-row slim" onSubmit={addItem}>
        <input
          className="grow"
          autoFocus
          placeholder={`Add to ${list.name}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn primary">Add</button>
      </form>

      <ul className="todo-list">
        {open.map((i) => (
          <li key={i.id}>
            <input
              type="checkbox"
              onChange={() => updateDoc(itemDoc(i.id), { checked: true })}
            />
            <span className="todo-text">{i.text}</span>
            <button className="x" onClick={() => deleteDoc(itemDoc(i.id))}>
              ✕
            </button>
          </li>
        ))}
        {!open.length && !checked.length && <p className="muted">Nothing here yet.</p>}
      </ul>

      {checked.length > 0 && (
        <>
          <h4 className="muted-head">Checked off ({checked.length})</h4>
          <ul className="todo-list dim">
            {checked.map((i) => (
              <li key={i.id} className="is-done">
                <input
                  type="checkbox"
                  checked
                  onChange={() => updateDoc(itemDoc(i.id), { checked: false })}
                />
                <span className="todo-text">{i.text}</span>
                <button className="x" onClick={() => deleteDoc(itemDoc(i.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function useSubItems(code, listId) {
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    if (!listId) return;
    const unsub = onSnapshot(famCol(code, `lists/${listId}/items`), (snap) =>
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [code, listId]);
  return { docs };
}
