# 🏠 FamilyHub

A free FamilyWall-style app for your family — **to-dos, shared lists, calendar/dates**, all synced in real time between everyone's phones.

Built with **React + Vite + Firebase (free tier)** and ready to deploy on **Netlify**.

---

## ✨ Features

| Feature | What it does |
|---|---|
| 🏠 Home | Greeting, your tasks due today, upcoming dates |
| ✅ To-Dos | Add tasks, assign to family members, due dates, filters |
| 🛒 Lists | Multiple lists (groceries, packing…) with check-off items |
| 📅 Calendar | Month view, events per day, "coming up" list |
| 👨‍👩‍👧‍👦 Family | Invite code, member profiles with colors |
| ⚡ Real-time | Everyone sees changes instantly (Firebase Firestore) |

Everything updates live on all devices — like FamilyWall, but **free**.

---

## 🚀 Setup Guide (step by step)

### Part 1 — Create your Firebase backend (5 minutes, free)

1. Go to <https://console.firebase.google.com> and sign in with Google.
2. Click **Add project** → name it anything (e.g. `my-family-hub`) → **Create**.
3. Inside the project, click the **web icon `</>`** to register a web app.
4. Firebase shows you a `firebaseConfig` object that looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "my-family-hub.firebaseapp.com",
     projectId: "my-family-hub",
     storageBucket: "my-family-hub.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:12345:web:abc123"
   };
   ```
5. Open **`src/firebase.js`** in this project and replace the placeholder values with yours.
6. In Firebase console sidebar: **Build → Firestore Database → Create database**
   → choose **Start in production mode** → pick a location → **Enable**.
7. Open the **Rules** tab of Firestore and paste this, then click **Publish**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /families/{familyCode}/{document=**} {
         allow read, write: if request.auth == null;
       }
     }
   }
   ```

> 💡 The 6-letter family code works like a shared password — share it only
> with your family. The free Spark plan is plenty for a whole family.

### Part 2 — Run it on your computer (optional)

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **Create a new family**, done.
You'll get an invite code to enter on other devices.

### Part 3 — Put it on GitHub

```bash
git init
git add .
git commit -m "FamilyHub app"
```

Then create a new repo at <https://github.com/new> (name it e.g. `familyhub`),
and push:

```bash
git remote add origin https://github.com/YOUR-USERNAME/familyhub.git
git branch -M main
git push -u origin main
```

### Part 4 — Deploy to Netlify (free)

1. Go to <https://app.netlify.com> and sign up with GitHub.
2. Click **Add new site → Import an existing project → GitHub**.
3. Pick your `familyhub` repo.
4. Netlify auto-detects Vite (build `npm run build`, publish `dist`).
   These are also pinned in `netlify.toml`, so just click **Deploy**.
5. Wait ~1 minute → you get a free URL like `https://your-site.netlify.app`.

> 🔁 Every time you `git push`, Netlify redeploys automatically.

### Part 5 — Add it to phones like an app

Open your Netlify link on each phone → browser menu → **"Add to Home Screen"**.
It behaves like a native app. Join with the same family code everywhere.

---

## 📁 Project structure

```
familyhub/
├── index.html
├── netlify.toml          # Netlify build settings + SPA redirects
├── package.json
├── src/
│   ├── main.jsx
│   ├── App.jsx           # layout, tabs, setup screen
│   ├── firebase.js       # ← paste your Firebase config here
│   ├── store.jsx         # session, family members context
│   ├── useData.js        # real-time collection hook
│   ├── styles.css
│   └── pages/
│       ├── JoinScreen.jsx   # create/join family
│       ├── Home.jsx
│       ├── Todos.jsx
│       ├── ListsPage.jsx
│       ├── CalendarPage.jsx
│       └── Members.jsx      # invite code, profiles
└── firestore.rules
```

## ❓ FAQ

**Is Firebase really free?** Yes — the Spark plan is free forever. A family app
uses a tiny fraction of its limits.

**Is my data safe?** It lives in your own Firebase project. Access requires your
family code; only share it with family. Don't store sensitive documents here.

**Can multiple families use one deployment?** Yes! Each family gets its own code,
and data is completely separated.

**Change the app name?** Edit `<title>` in `index.html` and the name in `App.jsx`.
