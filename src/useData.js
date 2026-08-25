import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { famCol } from "./store.jsx";

export function useCollection(code, subPath) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(famCol(code, subPath), (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [code, subPath]);

  return { docs, loading };
}
