import React, { createContext, useContext, useEffect, useState } from "react";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase.js";

const FamilyContext = createContext(null);

export const MEMBER_COLORS = [
  "#ff7a59",
  "#4f8cff",
  "#22b07d",
  "#9b59f6",
  "#f2b705",
  "#e84393",
  "#00b8d4",
  "#8bc34a",
];

const SESSION_KEY = "fh_session";

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function makeCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function FamilyProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [familyName, setFamilyName] = useState("");
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!session?.code) {
      setFamilyName("");
      setMembers([]);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    const unsubFam = onSnapshot(doc(db, "families", session.code), (snap) => {
      if (!snap.exists()) return;
      setFamilyName(snap.data().name || "My Family");
    });

    const unsubMembers = onSnapshot(
      query(collection(db, "families", session.code, "members"), orderBy("createdAt", "asc")),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubFam();
      unsubMembers();
    };
  }, [session?.code]);

  async function createFamily(name, memberName) {
    const code = makeCode();
    await setDoc(doc(db, "families", code), {
      name: name.trim() || "My Family",
      createdAt: serverTimestamp(),
    });
    const memberId = await joinFamily(code, memberName);
    return { code, memberId };
  }

  async function joinFamily(code, memberName) {
    const ref = doc(db, "families", code.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("No family found with that code.");
    const membersRef = collection(ref, "members");
    const color = MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
    const mRef = await addDoc(membersRef, {
      name: memberName.trim(),
      color,
      createdAt: Date.now(),
    });
    setSession({ code: code.toUpperCase(), memberId: mRef.id });
    return mRef.id;
  }

  function switchMember(memberId) {
    setSession((s) => ({ ...s, memberId }));
  }

  function leaveFamily() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  const value = {
    session,
    familyName,
    members,
    me: members.find((m) => m.id === session?.memberId) || null,
    createFamily,
    joinFamily,
    switchMember,
    leaveFamily,
  };

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  return useContext(FamilyContext);
}

// ---------- shared data helpers ----------

export function famCol(code, path) {
  return collection(db, "families", code, path);
}

export { doc, collection, onSnapshot, setDoc, addDoc, getDoc, deleteDoc, updateDoc, serverTimestamp, query, orderBy };
