import React, { createContext, useContext, useEffect, useState } from "react";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { db, auth, googleProvider } from "./firebase.js";
import { setDbError } from "./dbError.js";

const AppContext = createContext(null);

export const MEMBER_COLORS = [
  "#ff6b4a",
  "#4f8cff",
  "#22b07d",
  "#9b59f6",
  "#f2b705",
  "#e84393",
  "#00b8d4",
  "#8bc34a",
];

export function colorForUid(uid) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
}

export function friendly(e) {
  const code = String(e?.code || "");
  if (code.includes("permission-denied"))
    return "Firestore rules blocked this. Firebase console → Firestore Database → Rules → paste the rules from the firestore.rules file → Publish, then reload.";
  if (code.includes("unavailable") || code.includes("network-request-failed") || code.includes("internal"))
    return "Can't reach Firebase. Check your internet, disable ad-blockers for this site, and try again.";
  if (code.includes("unauthenticated"))
    return "Your session expired — please sign in again.";
  return e?.message || "Something went wrong.";
}

function withTimeout(p, ms = 15000, msg) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);
}

const NET_TIMEOUT_MSG =
  "This is taking unusually long — the database isn't responding. Check your internet, disable ad-blockers for this site, then reload and try again.";

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [families, setFamilies] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeCode, setActiveCode] = useState(
    () => localStorage.getItem("fh_active_code") || null
  );
  const [familyName, setFamilyName] = useState("");
  const [familyCreatedBy, setFamilyCreatedBy] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    let unsubProfile = null;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setFamilies(null);
        setProfileLoading(false);
        return;
      }
      try {
        await withTimeout(
          setDoc(
            doc(db, "users", u.uid),
            {
              name: u.displayName || "Member",
              email: u.email || null,
              photoURL: u.photoURL || null,
              lastLogin: serverTimestamp(),
            },
            { merge: true }
          ),
          15000,
          NET_TIMEOUT_MSG
        );
      } catch (e) {
        setDbError(friendly(e));
      }
      unsubProfile = onSnapshot(
        doc(db, "users", u.uid),
        (snap) => {
          const fams = snap.exists() ? Object.keys(snap.data().families || {}) : [];
          setFamilies(fams);
          setProfileLoading(false);
        },
        (e) => {
          setDbError(friendly(e));
          setProfileLoading(false);
        }
      );
    });
    return () => {
      unsub();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    if (!user || !families) return;
    let code = activeCode;
    if (families.length) {
      if (!code || !families.includes(code)) code = families[0];
    }
    if (code !== activeCode) setActiveCode(code);
    if (!code) {
      setFamilyName("");
      setMembers([]);
      return;
    }
    localStorage.setItem("fh_active_code", code);
    const unsubFam = onSnapshot(
      doc(db, "families", code),
      (snap) => {
        setFamilyName(snap.exists() ? snap.data().name : "");
        setFamilyCreatedBy(snap.exists() ? snap.data().createdBy || null : null);
      },
      (e) => setDbError(friendly(e))
    );
    const unsubMembers = onSnapshot(
      collection(db, "families", code, "members"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => !m.removed);
        list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        setMembers(list);
        if (user && families.includes(code) && !list.some((m) => m.id === user.uid)) {
          sessionStorage.setItem("fh_kicked", "1");
          setDoc(
            doc(db, "users", user.uid),
            { [`families.${code}`]: deleteField() },
            { merge: true }
          )
            .catch(() => {})
            .then(() => {
              setActiveCode(null);
              localStorage.removeItem("fh_active_code");
            });
        }
      },
      (e) => setDbError(friendly(e))
    );
    return () => {
      unsubFam();
      unsubMembers();
    };
  }, [user, families, activeCode]);

  async function signInWithGoogle() {
    const res = await signInWithPopup(auth, googleProvider);
    return res.user;
  }

  async function signOut() {
    setActiveCode(null);
    localStorage.removeItem("fh_active_code");
    await fbSignOut(auth);
  }

  function normalizeCode(code) {
    return String(code || "").trim().toUpperCase();
  }

  async function createFamily(name, code, onStep = () => {}) {
    const c = normalizeCode(code);
    if (!/^[A-Z0-9-]{3,16}$/.test(c))
      throw new Error("Code must be 3–16 letters, numbers or dashes.");
    const famRef = doc(db, "families", c);
    console.info("[FamilyHub] creating family", c);
    onStep("Checking the code…");
    let existing;
    try {
      existing = await withTimeout(getDoc(famRef), 12000, NET_TIMEOUT_MSG);
    } catch (e) {
      throw new Error(friendly(e));
    }
    let alreadyMine = false;
    if (existing.exists()) {
      if (existing.data().createdBy === user.uid) alreadyMine = true;
      else throw new Error("That code is already taken — try another.");
    }
    if (!alreadyMine) {
      onStep("Creating your family…");
      try {
        await withTimeout(
          setDoc(famRef, {
            name: (name || "").trim() || "My Family",
            code: c,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          }),
          12000,
          NET_TIMEOUT_MSG
        );
        console.info("[FamilyHub] family doc written");
      } catch (e) {
        throw new Error(friendly(e));
      }
    }
    onStep("Adding your profile…");
    try {
      await withTimeout(
        setDoc(
          doc(db, "families", c, "members", user.uid),
          {
            name: user.displayName || "Member",
            photoURL: user.photoURL || null,
            color: colorForUid(user.uid),
            joinedAt: Date.now(),
          },
          { merge: true }
        ),
        12000,
        NET_TIMEOUT_MSG
      );
      console.info("[FamilyHub] member doc written");
    } catch (e) {
      throw new Error(friendly(e));
    }
    onStep("Linking to your account…");
    setActiveCode(c);
    setDoc(doc(db, "users", user.uid), { [`families.${c}`]: true }, { merge: true })
      .catch((e) => setDbError(friendly(e)));
    console.info("[FamilyHub] family created — entering");
    return c;
  }

  async function requestJoin(code) {
    const c = normalizeCode(code);
    const famRef = doc(db, "families", c);
    let snap;
    try {
      snap = await withTimeout(getDoc(famRef), 12000, NET_TIMEOUT_MSG);
    } catch (e) {
      throw new Error(friendly(e));
    }
    if (!snap.exists()) throw new Error("No family found with that code.");
    if (snap.data().createdBy === user.uid)
      throw new Error("That's your own family — open it from the sidebar.");
    const memberSnap = await withTimeout(
      getDoc(doc(db, "families", c, "members", user.uid)),
      12000,
      NET_TIMEOUT_MSG
    );
    if (memberSnap.exists()) {
      setActiveCode(c);
      setDoc(doc(db, "users", user.uid), { [`families.${c}`]: true }, { merge: true })
        .catch((e) => setDbError(friendly(e)));
      return { alreadyMember: true };
    }
    try {
      await withTimeout(
        setDoc(doc(db, "families", c, "joinRequests", user.uid), {
          uid: user.uid,
          name: user.displayName || "Member",
          photoURL: user.photoURL || null,
          createdAt: Date.now(),
        }),
        12000,
        NET_TIMEOUT_MSG
      );
    } catch (e) {
      throw new Error(
        "The request may or may not have reached the family. Wait a moment, then enter the same code again — the app will detect it."
      );
    }
  }

  async function cancelJoinRequest(code) {
    const c = normalizeCode(code);
    await deleteDoc(doc(db, "families", c, "joinRequests", user.uid)).catch(() => {});
    localStorage.removeItem("fh_requested_code");
  }

  async function approveJoinRequest(r) {
    await setDoc(doc(db, "families", activeCode, "members", r.uid), {
      name: r.name || "Member",
      photoURL: r.photoURL || null,
      color: colorForUid(r.uid),
      joinedAt: Date.now(),
    });
    await deleteDoc(doc(db, "families", activeCode, "joinRequests", r.uid));
  }

  async function rejectJoinRequest(r) {
    await deleteDoc(doc(db, "families", activeCode, "joinRequests", r.uid));
  }

  async function removeMember(memberId) {
    await deleteDoc(doc(db, "families", activeCode, "members", memberId));
  }

  async function leaveFamily() {
    if (!activeCode) return;
    await deleteDoc(doc(db, "families", activeCode, "members", user.uid)).catch(() => {});
    await setDoc(
      doc(db, "users", user.uid),
      { [`families.${activeCode}`]: deleteField() },
      { merge: true }
    );
    setActiveCode(null);
    localStorage.removeItem("fh_active_code");
  }

  const me = user ? members.find((m) => m.id === user.uid) || null : null;

  const value = {
    user,
    authLoading,
    profileLoading,
    families: families || [],
    activeCode,
    familyName,
    familyCreatedBy,
    members,
    me,
    signInWithGoogle,
    signOut,
    createFamily,
    requestJoin,
    cancelJoinRequest,
    approveJoinRequest,
    rejectJoinRequest,
    removeMember,
    leaveFamily,
    setActiveCode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

export function famCol(code, path) {
  return collection(db, "families", code, path);
}

export { doc, collection, onSnapshot, setDoc, addDoc, getDoc, getDocs, deleteDoc, updateDoc, serverTimestamp, query, where };
