# 🏠 FamilyHub

A free FamilyWall-style app for your family — **Google sign-in, to-dos, shared lists, budget, meal planner, encrypted documents, map, end-to-end encrypted chat, calendar**, all synced in real time on everyone's phones.

Built with **React + Vite + Firebase (free tier)** and deployed on **Netlify**.

---

## ✨ Features

| Module | Highlights |
|---|---|
| 🔐 Auth | Google sign-in · custom family code you choose · stays logged in |
| 👑 Creator role | Approve/reject join requests · remove members (admin-style) |
| ✅ To-Dos | Assign to members, due dates, overdue highlights, per-member filters |
| 🛒 Lists | Multiple lists, check-off items |
| 💰 Budget | Income/expense tracker, monthly limits with alerts, bill reminders ("Paid ✓"), 6-month analytics, top spenders |
| 🍱 Meal Planner | Weekly grid (breakfast/lunch/dinner/snacks), ingredients → shopping list in one tap, web recipe import |
| 🔐 Documents | Browser-encrypted vault (AES-256), shared + **truly private** files, folders with emoji/colors, event attachments |
| 🗺️ Map | Live location sharing with duration control, place arrival/left alerts, one-tap directions |
| 💬 Chat | **End-to-end encrypted** group + private chats, emoji, GIFs, read receipts (✓✓) |
| 📅 Calendar | Month view, events with time & member colors |

---

## 🚀 Setup Guide

### Part 1 — Firebase (one time, ~10 minutes, free)

Your config is already pasted into `src/firebase.js`. Still needed in the Firebase console:

1. **Enable Google sign-in**
   **Build → Authentication → Get started → Sign-in method** → Add provider → **Google** → Enable → Save
2. **Authorize your website domain**
   **Authentication → Settings → Authorized domains → Add domain** → add your Netlify domain (e.g. `familywalls.netlify.app`)
3. **Create the database**
   **Build → Firestore Database → Create database → Start in production mode** → pick a location → Enable
4. **Publish security rules**
   Firestore → **Rules** tab → paste contents of [`firestore.rules`](firestore.rules) → **Publish**

> No Storage/billing needed — documents are stored encrypted inside Firestore itself.

### Part 2 — Run locally (optional)

```bash
npm install
npm run dev
```

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
2. Pick your repo → **Deploy** (settings come from `netlify.toml`)
3. Add your Netlify URL to Firebase authorized domains (Part 1, step 2)

Every `git push` auto-redeploys. On phones: open the URL → **Add to Home Screen**.

---

## 👑 How families & permissions work

```
Creator / Owner 👑
├── special permission ONLY: approve/reject join requests + remove members
├── (otherwise a normal member)
Member ──── normal access
Member ──── normal access
```

1. First person picks a family name **and their own family code** (e.g. `GADALA-7`) when creating
2. Others: sign in with Google → **Join** → enter the code → a **join request** is sent
3. The **creator sees the request** on their Family page → **Accept** = instant access, **Reject** = locked out
4. The creator can also **✕ remove** any member anytime — they lose access immediately and see
   *"You were removed from the family by its creator"* on their device
5. Multiple families supported — switch in the sidebar

Access is enforced by **Firestore security rules** server-side — joining requires creator approval, and removed members are blocked at the database level, not just hidden in the UI.

## 🔐 How the Document Safe works

- Every file is **encrypted in your browser (AES-256-GCM)** before upload — Firebase only ever stores unreadable ciphertext
- **Shared files**: encrypted with the family safe PIN — everyone in the family can open them
- **🔒 Private files**: encrypted with **your personal PIN** (separate key, unique per user) and stored in a
  per-user collection that **only you** can read — enforced by security rules. Other members never receive
  them, not even as ciphertext
- Max ~700 KB per file; photos are auto-compressed in-browser first

## 💬 How chat encryption works

Messages use **end-to-end encryption** (ECDH P-256 key exchange + AES-256-GCM). Each device generates a
secret key that never leaves it; Firebase only ever stores ciphertext. Back up your key from the 🔑 button
in the chat list to keep history readable on new devices.

## 🗄 Data model (Firestore)

```
users/{uid}                              → profile, chat public key, families: { CODE: true }
families/{CODE}                          → name, code, createdBy (the owner)
families/{CODE}/members/{uid}            → member profiles (created ONLY on owner approval)
families/{CODE}/joinRequests/{uid}       → pending join requests
families/{CODE}/todos · lists(+items) · budget(+limits,+reminders) · meals · events · locations · chats/messages
families/{CODE}/documents/{id}           → family-shared encrypted files
families/{CODE}/privateDocs/{uid}/...    → per-user encrypted files (owner-only by rules)
```

## ❓ FAQ

**Is Firebase really free?** Yes — Spark plan. A family app uses a tiny fraction of its limits.
(No Firebase Storage needed — files live encrypted inside Firestore.)

**Removed member wants back in?** They just send a new join request — approve it and they're restored.

**Someone forgot the safe PIN?** Shared files need the family PIN (whoever set it knows).
Private files need that person's own PIN — there's no reset (that's what makes it private).

**Change the app name?** Edit `<title>` in `index.html` and the wordmark in `App.jsx`.
