import { initializeApp } from "firebase/app";
import { initializeFirestore, terminate, clearIndexedDbPersistence } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";

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

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export async function resetAppData() {
  try {
    await terminate(db);
  } catch {}
  try {
    await clearIndexedDbPersistence(db);
  } catch {}
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
  location.reload();
}
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).catch(() => {});
