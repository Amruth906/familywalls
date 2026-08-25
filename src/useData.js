import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { famCol, friendly } from "./store.jsx";
import { setDbError } from "./dbError.js";

export function useCollection(code, subPath) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      famCol(code, subPath),
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        setDbError(friendly(e));
        setLoading(false);
      }
    );
    return unsub;
  }, [code, subPath]);

  return { docs, loading };
}
