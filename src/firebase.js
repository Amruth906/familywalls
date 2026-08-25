import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ============================================================
// SETUP (one time only):
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project" -> give it any name -> Create
// 3. In the project, click the web icon </> -> register an app
// 4. Copy the firebaseConfig object it shows you and PASTE it
//    below, replacing this placeholder.
// 5. In Firebase console go to: Build > Firestore Database >
//    Create database > Create database.
// Full step-by-step guide is in README.md
// ============================================================

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
};

export const isConfigured = !Object.values(firebaseConfig).some((v) =>
  String(v).startsWith("PASTE_")
);

let db = null;
if (isConfigured) {
  db = getFirestore(initializeApp(firebaseConfig));
}

export { db };
