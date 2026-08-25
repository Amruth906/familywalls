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
  apiKey: "AIzaSyDwORr8j6cU3XeWMMYB2xiUCTRLhdSI3Qo",
  authDomain: "familywall-cc987.firebaseapp.com",
  projectId: "familywall-cc987",
  storageBucket: "familywall-cc987.firebasestorage.app",
  messagingSenderId: "803853686644",
  appId: "1:803853686644:web:efb298f52ede3a2a09be21",
};

export const isConfigured = !Object.values(firebaseConfig).some((v) =>
  String(v).startsWith("PASTE_")
);

let db = null;
if (isConfigured) {
  db = getFirestore(initializeApp(firebaseConfig));
}

export { db };
