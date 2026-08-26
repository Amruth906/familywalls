# 🏠 FamilyHub

A free FamilyWall-style app for your family — **Google sign-in, to-dos, shared lists, calendar/dates**, all synced in real time on everyone's phones.

Built with **React + Vite + Firebase (free tier)** and deployed on **Netlify**.

---

## ✨ Features

- 🔐 **Login with Google** — each family member has their own secure account
- 🧾 **Your own family code** — you choose it when you create your family
- ⚡ **Stay logged in** — open the app and you're straight into your family wall
- ✅ **To-Dos** — assign to family members, due dates, overdue highlights
- 🛒 **Lists** — groceries, packing, wishlists with check-off items
- 📅 **Calendar** — month view, events with time & person colors
- 👨‍👩‍👧‍👦 **Family** — invite code/link, Google avatars, multiple families supported

---

## 🚀 Setup Guide

### Part 1 — Firebase (one time, ~10 minutes, free)

Your config is already pasted into `src/firebase.js`. Still needed in the Firebase console:

1. **Enable Google sign-in**
   Firebase console → **Build → Authentication → Get started → Sign-in method** tab
   → **Add new provider → Google → Enable → Save**
2. **Authorize your website domain**
   **Authentication → Settings → Authorized domains → Add domain**
   → add your Netlify domain, e.g. `familywalls.netlify.app`
   (localhost is already allowed for testing)
3. **Create the database**
   **Build → Firestore Database → Create database → Start in production mode** → pick a location → **Enable**
4. **Publish security rules**
   In Firestore → **Rules** tab → paste the contents of [`firestore.rules`](firestore.rules) → **Publish**
5. **Documents vault — no extra setup needed**
   Encrypted files are stored directly in Firestore (free 1GB). Max ~700 KB per
   file; photos are auto-compressed in the browser before upload.

### Part 2 — Run locally (optional)

```bash
npm install
npm run dev
```

Open http://localhost:5173 → **Continue with Google** → create your family with a custom code.

### Part 3 — GitHub

```bash
git init
git add .
git commit -m "FamilyHub"
git remote add origin https://github.com/YOUR-USERNAME/familywalls.git
git branch -M main
git push -u origin main
```

### Part 4 — Netlify (free)

1. https://app.netlify.com → **Add new site → Import an existing project → GitHub**
2. Pick your repo → **Deploy** (build settings come from `netlify.toml`)
3. Copy your site URL (e.g. `https://familywalls.netlify.app`) → add it to Firebase authorized domains (Part 1, step 2)

Every `git push` auto-redeploys. On each phone: open the URL → **Add to Home Screen**.

---

## 🔑 How login & family codes work

1. First open → **Continue with Google** (no passwords, managed by Firebase)
2. No family yet → **Create** (pick any code you like, e.g. `GADALA-7`) or **Join** with the family code
3. Your login is remembered on that device forever — next time it opens straight to Home
4. Family members join by entering your code — the code is just an invite token, all data access still requires a signed-in Google account

## 🗄 Data model (Firestore)

```
users/{uid}                          → name, email, photoURL, families: { CODE: true }
families/{CODE}                      → name, code, createdBy
families/{CODE}/members/{uid}        → name, photoURL, color, joinedAt
families/{CODE}/todos/{id}           → text, assigneeId, dueDate, done
families/{CODE}/lists/{id}           → name, emoji
families/{CODE}/lists/{id}/items/{id}→ text, checked
families/{CODE}/events/{id}          → title, date, time, memberId
```

## ❓ FAQ

**Is Firebase free?** Yes — the Spark plan is free forever, plenty for a family.

**Changed the old code-based app to this version?** Old test data (created before
Google login) isn't linked to your account. Just create a fresh family — takes 10 seconds.

**Multiple families?** Yes — create/join as many as you like and switch in the sidebar.
