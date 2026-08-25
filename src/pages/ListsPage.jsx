import React, { useEffect, useState } from "react";
import { doc, addDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { useApp, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import { IconPlus, IconX, IconTrash } from "../components/Icons.jsx";

const EMOJIS = ["🛒", "🧾", "🎂", "🎁", "🧳", "🏡", "💡", "📦"];

export default function ListsPage() {
  const { user, activeCode } = useApp();
  const { docs: lists, loading } = useCollection(activeCode, "lists");
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  const selected = lists.find((l) => l.id === selectedId) || lists[0] || null;

  async function createList(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const ref = await addDoc(famCol(activeCode, "lists"), {
      name: newName.trim(),
      emoji,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setNewName("");
    setSelectedId(ref.id);
  }

  async function deleteList(id) {
    if (!confirm("Delete this whole list?")) return;
    await deleteDoc(doc(db, "families", activeCode, "lists", id));
    setSelectedId(null);
  }

  return (
    <div className="page">
      <h2 className="page-title">Lists</h2>
      <div className="split">
        <aside className="panel side-panel">
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
            <input
              placeholder="New list name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="btn primary">
              <IconPlus size={16} /> Create
            </button>
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
            {!loading && !lists.length && <p className="empty">No lists yet.</p>}
          </ul>
        </aside>

        {selected ? (
          <ListDetail code={activeCode} list={selected} onDelete={deleteList} />
        ) : (
          !loading && (
            <div className="panel empty-panel">
              <p>Create your first list — groceries, packing, wishlists…</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ListDetail({ code, list, onDelete }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(famCol(code, `lists/${list.id}/items`), (snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [code, list.id]);

  function itemDoc(id) {
    return doc(db, "families", code, "lists", list.id, "items", id);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(famCol(code, `lists/${list.id}/items`), {
      text: text.trim(),
      checked: false,
      createdAt: Date.now(),
    });
    setText("");
  }

  const open = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <section className="panel">
      <header className="panel-head">
        <h3>
          {list.emoji} {list.name}
        </h3>
        <button className="icon-btn danger" title="Delete list" onClick={() => onDelete(list.id)}>
          <IconTrash size={16} />
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
        <button className="btn primary">
          <IconPlus size={16} />
        </button>
      </form>

      <ul className="row-list">
        {open.map((i) => (
          <li key={i.id} className="check-row">
            <input type="checkbox" onChange={() => updateDoc(itemDoc(i.id), { checked: true })} />
            <span className="row-title">{i.text}</span>
            <button className="icon-btn danger" onClick={() => deleteDoc(itemDoc(i.id))}>
              <IconX size={16} />
            </button>
          </li>
        ))}
        {!open.length && !checked.length && <p className="empty">Nothing here yet.</p>}
      </ul>

      {checked.length > 0 && (
        <>
          <h4 className="muted-head">Checked off · {checked.length}</h4>
          <ul className="row-list dim">
            {checked.map((i) => (
              <li key={i.id} className="check-row is-done">
                <input
                  type="checkbox"
                  checked
                  onChange={() => updateDoc(itemDoc(i.id), { checked: false })}
                />
                <span className="row-title">{i.text}</span>
                <button className="icon-btn danger" onClick={() => deleteDoc(itemDoc(i.id))}>
                  <IconX size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
