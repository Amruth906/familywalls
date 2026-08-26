import React, { useMemo, useState } from "react";
import { doc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { useApp, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import { IconChevronLeft, IconChevronRight, IconPlus, IconX, IconTrash } from "../components/Icons.jsx";

const CATEGORIES = {
  expense: [
    { id: "food", label: "Food", emoji: "🍔", color: "#ff6b4a" },
    { id: "groceries", label: "Groceries", emoji: "🛒", color: "#22b07d" },
    { id: "travel", label: "Travel", emoji: "🚗", color: "#4f8cff" },
    { id: "bills", label: "Bills", emoji: "💡", color: "#f2b705" },
    { id: "health", label: "Health", emoji: "🏥", color: "#e84393" },
    { id: "education", label: "Education", emoji: "📚", color: "#9b59f6" },
    { id: "shopping", label: "Shopping", emoji: "🛍️", color: "#00b8d4" },
    { id: "rent", label: "Rent", emoji: "🏠", color: "#6c5ce7" },
    { id: "fun", label: "Fun", emoji: "🎮", color: "#fd79a8" },
    { id: "other", label: "Other", emoji: "📦", color: "#82858f" },
  ],
  income: [
    { id: "salary", label: "Salary", emoji: "💼", color: "#22b07d" },
    { id: "business", label: "Business", emoji: "🏪", color: "#4f8cff" },
    { id: "gift", label: "Gift", emoji: "🎁", color: "#e84393" },
    { id: "other-in", label: "Other", emoji: "💰", color: "#f2b705" },
  ],
};

const ALL_CATS = Object.fromEntries(
  [...CATEGORIES.expense, ...CATEGORIES.income].map((c) => [c.id, c])
);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function inr(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Budget() {
  const { user, activeCode, members } = useApp();
  const { docs: txs, loading } = useCollection(activeCode, "budget");
  const { docs: limits } = useCollection(activeCode, "budgetLimits");
  const { docs: reminders } = useCollection(activeCode, "budgetReminders");
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [note, setNote] = useState("");
  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [filter, setFilter] = useState("all");

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  function nav(delta) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const prefix = `${view.y}-${String(view.m + 1).padStart(2, "0")}`;
  const monthTx = txs
    .filter((t) => (t.date || "").startsWith(prefix))
    .sort((a, b) => (b.date + (b.createdAt || "") > a.date + (a.createdAt || "") ? 1 : -1));

  const shown = monthTx.filter((t) => (filter === "all" ? true : t.memberId === filter));

  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);

  const byCat = useMemo(() => {
    const map = {};
    for (const t of monthTx) {
      if (t.type !== "expense") continue;
      map[t.category] = (map[t.category] || 0) + Number(t.amount || 0);
    }
    return Object.entries(map)
      .map(([id, amt]) => ({ ...(ALL_CATS[id] || ALL_CATS.other), amount: amt }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTx]);

  const maxCat = byCat[0]?.amount || 1;

  const spentByCat = useMemo(() => {
    const map = {};
    for (const t of monthTx) {
      if (t.type !== "expense") continue;
      map[t.category] = (map[t.category] || 0) + Number(t.amount || 0);
    }
    return map;
  }, [monthTx]);

  const overBudget = useMemo(
    () =>
      limits
        .filter((l) => l.scope !== "overall" && Number(l.amount) > 0 && (spentByCat[l.scope] || 0) > Number(l.amount))
        .map((l) => ({ ...(ALL_CATS[l.scope] || ALL_CATS.other), spent: spentByCat[l.scope] || 0, limit: Number(l.amount) })),
    [limits, spentByCat]
  );

  const trend = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(view.y, view.m - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const rows = txs.filter((t) => (t.date || "").startsWith(key));
      out.push({
        label: MONTHS_SHORT[d.getMonth()],
        income: rows.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0),
        expense: rows.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0),
      });
    }
    return out;
  }, [txs, view]);

  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.income, t.expense)));

  const memberSpend = useMemo(() => {
    const map = {};
    for (const t of monthTx) {
      if (t.type !== "expense" || !t.memberId) continue;
      map[t.memberId] = (map[t.memberId] || 0) + Number(t.amount || 0);
    }
    return Object.entries(map)
      .map(([id, amt]) => ({ member: memberById[id], amount: amt }))
      .filter((x) => x.member)
      .sort((a, b) => b.amount - a.amount);
  }, [monthTx, memberById]);
  const maxMemberSpend = memberSpend[0]?.amount || 1;

  async function addTx(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    await addDoc(famCol(activeCode, "budget"), {
      type,
      amount: amt,
      category: type === "income" && !CATEGORIES.income.find((c) => c.id === category) ? "other-in" : category,
      note: note.trim(),
      memberId: memberId || user.uid,
      date,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setAmount("");
    setNote("");
  }

  function pickType(t) {
    setType(t);
    setCategory(t === "expense" ? "food" : "salary");
  }

  const today = todayStr();

  return (
    <div className="page">
      <h2 className="page-title">Budget</h2>

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

        <div className="bud-summary">
          <div className="bud-card inc">
            <span className="bud-label">Income</span>
            <span className="bud-amt">{inr(income)}</span>
          </div>
          <div className="bud-card exp">
            <span className="bud-label">Expenses</span>
            <span className="bud-amt">{inr(expense)}</span>
          </div>
          <div className={"bud-card bal " + (income - expense < 0 ? "neg" : "")}>
            <span className="bud-label">Balance</span>
            <span className="bud-amt">{inr(income - expense)}</span>
          </div>
        </div>

        {byCat.length > 0 && (
          <div className="cat-break">
            <h4 className="muted-head">Where money went</h4>
            {byCat.map((c) => (
              <div key={c.id} className="cat-row">
                <span className="cat-emoji">{c.emoji}</span>
                <div className="cat-info">
                  <div className="cat-top">
                    <span>{c.label}</span>
                    <b>{inr(c.amount)}</b>
                  </div>
                  <div className="cat-track">
                    <div
                      className="cat-fill"
                      style={{ width: `${(c.amount / maxCat) * 100}%`, background: c.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <LimitsPanel
        code={activeCode}
        limits={limits}
        spentByCat={spentByCat}
        totalExpense={expense}
      />

      <RemindersPanel
        code={activeCode}
        reminders={reminders}
        user={user}
        members={members}
        today={today}
      />

      <form className="panel add-tx" onSubmit={addTx}>
        <div className="type-toggle">
          <button type="button" className={type === "expense" ? "on exp" : ""} onClick={() => pickType("expense")}>
            − Expense
          </button>
          <button type="button" className={type === "income" ? "on inc" : ""} onClick={() => pickType("income")}>
            + Income
          </button>
        </div>

        <div className="tx-fields">
          <input
            className="amt-input"
            type="number"
            min="0"
            step="any"
            placeholder="₹ Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="grow"
            placeholder={type === "expense" ? "What did you spend on?" : "Source…"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Me</option>
            {members
              .filter((m) => m.id !== user.uid)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name.split(" ")[0]}
                </option>
              ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn primary">
            <IconPlus size={16} /> Add
          </button>
        </div>

        <div className="cat-pick">
          {CATEGORIES[type].map((c) => (
            <button
              type="button"
              key={c.id}
              className={"cat-chip" + (category === c.id ? " on" : "")}
              style={category === c.id ? { background: c.color, borderColor: c.color } : {}}
              onClick={() => setCategory(c.id)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </form>

      <div className="chips">
        <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
          Whole family
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            className={"chip" + (filter === m.id ? " on" : "")}
            style={filter === m.id ? { background: m.color, borderColor: m.color, color: "#fff" } : {}}
            onClick={() => setFilter(m.id)}
          >
            <span className="dot" style={{ background: m.color }} /> {m.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <section className="panel">
        <header className="panel-head">
          <h3>
            {MONTHS[view.m]} transactions · {shown.length}
          </h3>
        </header>
        <ul className="row-list">
          {loading && <p className="muted">Loading…</p>}
          {shown.map((t) => {
            const c = ALL_CATS[t.category] || ALL_CATS.other;
            const m = memberById[t.memberId];
            return (
              <li key={t.id} className="tx-row">
                <span className="cat-emoji big" style={{ background: (c.color || "#888") + "1f" }}>
                  {c.emoji}
                </span>
                <div className="row-body">
                  <span className="row-title">{t.note || c.label}</span>
                  <span className="row-sub">
                    <span className="dot" style={{ background: m?.color || "#ccc" }} />
                    {m?.name.split(" ")[0] || "—"} · {t.date}
                  </span>
                </div>
                <b className={"tx-amt " + (t.type === "income" ? "pos" : "")}>
                  {t.type === "income" ? "+" : "−"}
                  {inr(t.amount)}
                </b>
                <button
                  className="icon-btn danger"
                  onClick={() => deleteDoc(doc(db, "families", activeCode, "budget", t.id))}
                  title="Delete"
                >
                  <IconX size={16} />
                </button>
              </li>
            );
          })}
          {!loading && !shown.length && (
            <p className="empty">No transactions this month yet — add one above ☝️</p>
          )}
        </ul>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h3>Analytics</h3>
          <span className="muted small">last 6 months</span>
        </header>

        <div className="trend">
          {trend.map((t) => (
            <div key={t.label} className="trend-col">
              <div className="trend-bars">
                <div
                  className="trend-bar inc"
                  style={{ height: `${Math.max(3, (t.income / maxTrend) * 100)}%` }}
                  title={`Income ${inr(t.income)}`}
                />
                <div
                  className="trend-bar exp"
                  style={{ height: `${Math.max(3, (t.expense / maxTrend) * 100)}%` }}
                  title={`Expenses ${inr(t.expense)}`}
                />
              </div>
              <span className="trend-label">{t.label}</span>
            </div>
          ))}
        </div>
        <div className="trend-legend">
          <span><i className="lg inc" /> Income</span>
          <span><i className="lg exp" /> Expenses</span>
        </div>

        {overBudget.length > 0 && (
          <div className="over-budget">
            <h4 className="muted-head">⚠️ Over budget this month</h4>
            {overBudget.map((c) => (
              <p key={c.id} className="over-line">
                {c.emoji} <b>{c.label}</b> — spent {inr(c.spent)} of your {inr(c.limit)} limit
              </p>
            ))}
          </div>
        )}

        {memberSpend.length > 0 && (
          <>
            <h4 className="muted-head">Top spenders this month</h4>
            {memberSpend.map(({ member, amount }) => (
              <div key={member.id} className="cat-row">
                <span className="dot big-dot" style={{ background: member.color }} />
                <div className="cat-info">
                  <div className="cat-top">
                    <span>{member.name}</span>
                    <b>{inr(amount)}</b>
                  </div>
                  <div className="cat-track">
                    <div
                      className="cat-fill"
                      style={{ width: `${(amount / maxMemberSpend) * 100}%`, background: member.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

function LimitsPanel({ code, limits, spentByCat, totalExpense }) {
  const [scope, setScope] = useState("overall");
  const [amount, setAmount] = useState("");

  async function add(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const existing = limits.find((l) => l.scope === scope);
    if (existing) {
      await updateDoc(doc(db, "families", code, "budgetLimits", existing.id), { amount: amt });
    } else {
      await addDoc(famCol(code, "budgetLimits"), { scope, amount: amt, createdAt: Date.now() });
    }
    setAmount("");
  }

  async function remove(id) {
    await deleteDoc(doc(db, "families", code, "budgetLimits", id));
  }

  const rows = limits
    .map((l) => {
      const isOverall = l.scope === "overall";
      const cat = ALL_CATS[l.scope];
      const spent = isOverall ? totalExpense : spentByCat[l.scope] || 0;
      return { id: l.id, isOverall, cat, spent, limit: Number(l.amount) };
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  return (
    <section className="panel">
      <header className="panel-head">
        <h3>🎯 Budget limits</h3>
        <span className="muted small">monthly</span>
      </header>

      <form className="tx-fields limit-form" onSubmit={add}>
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="overall">Overall budget</option>
          {CATEGORIES.expense.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
        <input
          className="amt-input"
          type="number"
          min="0"
          step="any"
          placeholder="₹ limit"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="btn primary">Set</button>
      </form>

      {rows.map((r) => {
        const pct = Math.min(100, (r.spent / r.limit) * 100);
        const over = r.spent > r.limit;
        const warn = !over && pct >= 80;
        return (
          <div key={r.id} className="limit-row">
            <span className="cat-emoji">{r.isOverall ? "🧮" : r.cat?.emoji}</span>
            <div className="cat-info">
              <div className="cat-top">
                <span>
                  {r.isOverall ? "Overall" : r.cat?.label}
                  {over && <span className="badge-over">over!</span>}
                  {warn && <span className="badge-warn">close</span>}
                </span>
                <b>
                  {inr(r.spent)} <span className="muted">/ {inr(r.limit)}</span>
                </b>
              </div>
              <div className="cat-track">
                <div
                  className="cat-fill"
                  style={{
                    width: `${pct}%`,
                    background: over ? "#e23670" : warn ? "#f2b705" : "#22b07d",
                  }}
                />
              </div>
            </div>
            <button className="icon-btn danger" onClick={() => remove(r.id)} title="Remove limit">
              <IconTrash size={15} />
            </button>
          </div>
        );
      })}
      {!limits.length && (
        <p className="empty">No limits set. Try an overall monthly limit — bars turn amber at 80% and red when crossed.</p>
      )}
    </section>
  );
}

function RemindersPanel({ code, reminders, user, members, today }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("bills");
  const [dueDate, setDueDate] = useState(today);
  const [recurring, setRecurring] = useState(true);
  const [memberId, setMemberId] = useState("");

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await addDoc(famCol(code, "budgetReminders"), {
      title: title.trim(),
      amount: parseFloat(amount) || 0,
      category,
      dueDate,
      recurring,
      memberId: memberId || user.uid,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setTitle("");
    setAmount("");
    setDueDate(today);
    setRecurring(true);
  }

  async function markPaid(r) {
    await addDoc(famCol(code, "budget"), {
      type: "expense",
      amount: Number(r.amount) || 0,
      category: r.category,
      note: r.title,
      memberId: r.memberId || user.uid,
      date: today,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    if (r.recurring) {
      const d = new Date(r.dueDate + "T00:00");
      d.setMonth(d.getMonth() + 1);
      await updateDoc(doc(db, "families", code, "budgetReminders", r.id), { dueDate: ymd(d) });
    } else {
      await deleteDoc(doc(db, "families", code, "budgetReminders", r.id));
    }
  }

  const sorted = [...reminders].sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  return (
    <section className="panel">
      <header className="panel-head">
        <h3>🔔 Reminders & upcoming bills</h3>
      </header>

      <form className="tx-fields limit-form" onSubmit={add}>
        <input
          className="grow"
          placeholder="e.g. Electricity bill"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="amt-input"
          type="number"
          min="0"
          step="any"
          placeholder="₹ amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.expense.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">Me</option>
          {members
            .filter((m) => m.id !== user.uid)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name.split(" ")[0]}
              </option>
            ))}
        </select>
        <button className="btn primary">Add</button>
        <label className="recur-toggle">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          Repeats monthly
        </label>
      </form>

      <ul className="row-list">
        {sorted.map((r) => {
          const overdue = r.dueDate < today;
          const soon = !overdue && r.dueDate <= ymd(new Date(Date.now() + 3 * 86400000));
          const c = ALL_CATS[r.category] || ALL_CATS.other;
          const m = memberById[r.memberId];
          return (
            <li key={r.id} className={"tx-row" + (overdue ? " overdue-row" : "")}>
              <span className="cat-emoji big" style={{ background: (c.color || "#888") + "1f" }}>
                {c.emoji}
              </span>
              <div className="row-body">
                <span className="row-title">
                  {r.title}
                  {r.recurring && <span className="recur-tag">monthly</span>}
                  {overdue && <span className="badge-over">overdue</span>}
                  {soon && !overdue && <span className="badge-warn">due soon</span>}
                </span>
                <span className="row-sub">
                  due {r.dueDate} · <span className="dot" style={{ background: m?.color || "#ccc" }} />
                  {m?.name.split(" ")[0] || "—"}
                </span>
              </div>
              <b className="tx-amt">{inr(r.amount)}</b>
              <button className="btn tiny" onClick={() => markPaid(r)} title="Log as paid expense">
                Paid ✓
              </button>
              <button
                className="icon-btn danger"
                onClick={() => deleteDoc(doc(db, "families", code, "budgetReminders", r.id))}
                title="Delete reminder"
              >
                <IconX size={16} />
              </button>
            </li>
          );
        })}
        {!reminders.length && (
          <p className="empty">No reminders yet — add rent, EMIs, subscriptions so nobody misses a payment.</p>
        )}
      </ul>
    </section>
  );
}
