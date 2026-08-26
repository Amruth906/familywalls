import React, { useMemo, useState } from "react";
import { doc, addDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { useApp, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import { IconChevronLeft, IconChevronRight, IconPlus, IconX, IconCart, IconSearch } from "../components/Icons.jsx";

const SLOTS = [
  { id: "breakfast", label: "Breakfast", emoji: "☀️" },
  { id: "lunch", label: "Lunch", emoji: "🍽️" },
  { id: "dinner", label: "Dinner", emoji: "🌙" },
  { id: "snacks", label: "Snacks", emoji: "🍪" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(date) {
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  return ymd(new Date());
}

export default function MealPlanner() {
  const { user, activeCode } = useApp();
  const { docs: meals } = useCollection(activeCode, "meals");
  const { docs: lists } = useCollection(activeCode, "lists");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [targetList, setTargetList] = useState("");
  const [transferMsg, setTransferMsg] = useState("");
  const [transferring, setTransferring] = useState(false);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return ymd(d);
    });
  }, [weekStart]);

  const mealsByKey = useMemo(() => {
    const map = {};
    for (const m of meals) {
      if (!m.date || !m.slot) continue;
      map[`${m.date}|${m.slot}`] = m;
    }
    return map;
  }, [meals]);

  const today = todayStr();

  function navWeek(delta) {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }

  function openSlot(date, slot) {
    const existing = mealsByKey[`${date}|${slot}`];
    setEditor({
      date,
      slot,
      mealId: existing?.id || null,
      title: existing?.title || "",
      ingredients: (existing?.ingredients || []).join("\n"),
    });
  }

  async function saveMeal() {
    if (!editor || !editor.title.trim()) return;
    const ingredients = editor.ingredients
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const data = {
      title: editor.title.trim(),
      ingredients,
      date: editor.date,
      slot: editor.slot,
      updatedBy: user.uid,
    };
    if (editor.mealId) {
      await updateDoc(doc(db, "families", activeCode, "meals", editor.mealId), data);
    } else {
      await addDoc(famCol(activeCode, "meals"), { ...data, createdBy: user.uid, createdAt: Date.now() });
    }
    setEditor(null);
  }

  async function removeMeal() {
    if (editor?.mealId) await deleteDoc(doc(db, "families", activeCode, "meals", editor.mealId));
    setEditor(null);
  }

  function collectIngredients(dateList) {
    const map = new Map();
    for (const m of meals) {
      if (dateList && !dateList.includes(m.date)) continue;
      for (const ing of m.ingredients || []) {
        const v = ing.trim();
        if (!v) continue;
        const k = v.toLowerCase();
        if (!map.has(k)) map.set(k, v);
      }
    }
    return [...map.values()];
  }

  async function ensureTargetList() {
    if (targetList) {
      const found = lists.find((l) => l.id === targetList);
      if (found) return found;
    }
    const groceries = lists.find((l) => /grocer/i.test(l.name));
    if (groceries) {
      setTargetList(groceries.id);
      return groceries;
    }
    const ref = await addDoc(famCol(activeCode, "lists"), {
      name: "Groceries",
      emoji: "🛒",
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setTargetList(ref.id);
    return { id: ref.id, name: "Groceries", emoji: "🛒" };
  }

  async function transfer(dateList, label) {
    const ings = collectIngredients(dateList);
    if (!ings.length) {
      setTransferMsg("No ingredients found for that range.");
      setTimeout(() => setTransferMsg(""), 2500);
      return;
    }
    setTransferring(true);
    try {
      const list = await ensureTargetList();
      const itemsRef = famCol(activeCode, `lists/${list.id}/items`);
      for (const text of ings) {
        await addDoc(itemsRef, { text, checked: false, createdAt: Date.now() });
      }
      setTransferMsg(`✓ ${ings.length} ingredients added to ${list.emoji} ${list.name} (${label})`);
      setTimeout(() => setTransferMsg(""), 3500);
    } finally {
      setTransferring(false);
    }
  }

  async function searchRecipes(e) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(search.trim())}`
      );
      const data = await res.json();
      setResults((data.meals || []).slice(0, 12));
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  function useRecipe(meal) {
    const ings = [];
    for (let i = 1; i <= 20; i++) {
      const name = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (name && name.trim()) ings.push(`${(measure || "").trim()} ${name.trim()}`.trim());
    }
    setEditor({
      date: days[0],
      slot: "dinner",
      mealId: null,
      title: meal.strMeal,
      ingredients: ings.join("\n"),
    });
    setResults(null);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const dayNames = useMemo(() => {
    return days.map((d) => {
      const dt = new Date(d + "T00:00");
      return { short: DAY_NAMES[dt.getDay()], num: dt.getDate(), date: d };
    });
  }, [days]);

  return (
    <div className="page wide">
      <h2 className="page-title">Meal Planner</h2>

      <section className="panel">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => navWeek(-1)}>
            <IconChevronLeft size={18} />
          </button>
          <h3>
            {new Date(days[0] + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            {" – "}
            {new Date(days[6] + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </h3>
          <button className="icon-btn" onClick={() => navWeek(1)}>
            <IconChevronRight size={18} />
          </button>
        </div>

        <div className="transfer-row">
          <select value={targetList} onChange={(e) => setTargetList(e.target.value)}>
            <option value="">Auto-pick/create Groceries list</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.emoji} {l.name}
              </option>
            ))}
          </select>
          <button
            className="btn primary"
            disabled={transferring}
            onClick={() => transfer(days, "this week")}
          >
            <IconCart size={16} /> Week's ingredients → shopping list
          </button>
          <button className="btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </button>
        </div>
        {transferMsg && <div className="transfer-msg">{transferMsg}</div>}

        {editor && (
          <div className="meal-editor">
            <h4>
              {editor.mealId ? "Edit" : "Add"} meal ·{" "}
              {new Date(editor.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}{" "}
              · {SLOTS.find((s) => s.id === editor.slot)?.label}
            </h4>
            <input
              autoFocus
              placeholder="Dish name… e.g. Paneer butter masala"
              value={editor.title}
              onChange={(e) => setEditor({ ...editor, title: e.target.value })}
            />
            <textarea
              rows="4"
              placeholder={"Ingredients (one per line)…\n200 g paneer\n2 onions\n1 cup cream"}
              value={editor.ingredients}
              onChange={(e) => setEditor({ ...editor, ingredients: e.target.value })}
            />
            <div className="meal-editor-actions">
              <button className="btn primary" onClick={saveMeal} disabled={!editor.title.trim()}>
                Save meal
              </button>
              {editor.mealId && (
                <button className="btn danger" onClick={removeMeal}>
                  <IconX size={15} /> Remove
                </button>
              )}
              <button className="btn" onClick={() => setEditor(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="week-grid">
          {days.map((date, i) => (
            <div key={date} className={"day-col" + (date === today ? " today" : "")}>
              <div className="day-col-head">
                <span>{dayNames[i].short}</span>
                <b>{dayNames[i].num}</b>
              </div>
              {SLOTS.map((s) => {
                const meal = mealsByKey[`${date}|${s.id}`];
                return (
                  <div key={s.id} className="slot-cell">
                    <div className="slot-label">
                      {s.emoji} {s.label}
                    </div>
                    {meal ? (
                      <button className="meal-chip" onClick={() => openSlot(date, s.id)} title="Edit meal">
                        <span className="meal-name">{meal.title}</span>
                        {!!meal.ingredients?.length && (
                          <span className="meal-ing">{meal.ingredients.length} ing.</span>
                        )}
                      </button>
                    ) : (
                      <button className="slot-add" onClick={() => openSlot(date, s.id)} title={`Add ${s.label}`}>
                        <IconPlus size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                className="day-transfer"
                title="Add this day's ingredients to shopping list"
                onClick={() => transfer([date], DAY_NAMES[i])}
              >
                <IconCart size={13} /> to list
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h3>📖 Import recipe from the web</h3>
        </header>
        <form className="tx-fields" onSubmit={searchRecipes}>
          <input
            className="grow"
            placeholder="Search any recipe… e.g. biryani, pancakes, pasta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn primary">
            <IconSearch size={16} /> Search
          </button>
        </form>
        {searching && <p className="muted">Searching…</p>}
        {results && !results.length && <p className="empty">No recipes found — try another word.</p>}
        {results && results.length > 0 && (
          <div className="recipe-grid">
            {results.map((r) => (
              <button key={r.idMeal} className="recipe-card" onClick={() => useRecipe(r)} title="Use this recipe">
                <img src={r.strMealThumb} alt={r.strMeal} loading="lazy" referrerPolicy="no-referrer" />
                <span>{r.strMeal}</span>
              </button>
            ))}
          </div>
        )}
        <p className="muted small">
          Pick a recipe → its ingredients fill the meal editor → save to a day, then send everything to your shopping list.
        </p>
      </section>
    </div>
  );
}
