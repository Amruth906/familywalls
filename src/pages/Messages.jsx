import React, { useEffect, useMemo, useRef, useState } from "react";
import { doc, setDoc, addDoc, updateDoc, getDoc } from "firebase/firestore";
import { useApp, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import { getMyKeyPair, encryptFor, decryptFor, exportMyKeyPair, importMyKeyPair } from "../chatCrypto.js";
import Avatar from "../components/Avatar.jsx";
import { IconPlus } from "../components/Icons.jsx";

const EMOJIS = [
  "😀","😂","🥲","😍","🤗","😎","🥳","😴","🤒","🤩","😅","😭","😡","🤔","🙌","👏",
  "👍","👎","🙏","💪","❤️","🧡","💛","💚","💙","🔥","🎉","🎂","🎁","🍕","☕","🍛",
  "🚗","🏠","📅","✅","💡","💰","🛒","📞","📸","⚡","🌟","🐶","🐱","🌸","🌙","☀️",
];

const GIPHY_KEY_STORAGE = "fh_giphy_key";

function dmId(a, b) {
  return [a, b].sort().join("__");
}

function timeShort(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  const { user, activeCode, members } = useApp();
  const [kp, setKp] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [decrypted, setDecrypted] = useState({});
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [giphyKey, setGiphyKey] = useState(() => localStorage.getItem(GIPHY_KEY_STORAGE) || "");
  const [giphyKeyInput, setGiphyKeyInput] = useState("");
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [gifSearching, setGifSearching] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [keyMsg, setKeyMsg] = useState("");
  const scrollRef = useRef(null);
  const pubRef = useRef({});

  const { docs: rawChats } = useCollection(activeCode, "chats");
  const { docs: msgs } = useCollection(activeCode, activeChat ? `chats/${activeChat.id}/messages` : null);

  useEffect(() => {
    getMyKeyPair(user.uid).then(setKp).catch(() => {});
  }, [user.uid]);

  useEffect(() => {
    const ref = doc(db, "families", activeCode, "chats", "family");
    setDoc(
      ref,
      {
        type: "group",
        title: "Family group",
        memberIds: members.map((m) => m.id),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  }, [activeCode, members.length]);

  useEffect(() => {
    setChats(rawChats);
  }, [rawChats]);

  async function getPub(uid) {
    if (pubRef.current[uid]) return pubRef.current[uid];
    const snap = await getDoc(doc(db, "users", uid));
    const jwk = snap.data()?.chatPub || null;
    pubRef.current[uid] = jwk;
    return jwk;
  }

  function openFamilyChat() {
    const chat = { id: "family", type: "group", title: "Family group", memberIds: members.map((m) => m.id) };
    setActiveChat(chat);
  }

  async function openDm(member) {
    const id = dmId(user.uid, member.id);
    const ref = doc(db, "families", activeCode, "chats", id);
    await setDoc(
      ref,
      { type: "dm", title: member.name, memberIds: [user.uid, member.id], updatedAt: Date.now() },
      { merge: true }
    );
    setActiveChat({ id, type: "dm", title: member.name, memberIds: [user.uid, member.id] });
  }

  const sortedMsgs = useMemo(
    () => [...msgs].sort((a, b) => (a.ts || 0) - (b.ts || 0)),
    [msgs]
  );

  useEffect(() => {
    if (!activeChat || !kp) return;
    let cancelled = false;
    (async () => {
      const out = { ...decrypted };
      for (const m of sortedMsgs) {
        if (out[m.id] != null) continue;
        try {
          const senderPub = await getPub(m.from);
          if (!senderPub || !m.keys || !m.keys[user.uid]) {
            out[m.id] = "🔒 Can't decrypt (sent before you joined / key changed)";
            continue;
          }
          out[m.id] = await decryptFor(kp.privJwk, senderPub, m.cipher, m.keys[user.uid]);
        } catch {
          out[m.id] = "🔒 Can't decrypt";
        }
      }
      if (!cancelled) setDecrypted(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [sortedMsgs, activeChat, kp]);

  useEffect(() => {
    if (!activeChat) return;
    const chatRef = doc(db, "families", activeCode, "chats", activeChat.id);
    setDoc(chatRef, { [`lastRead.${user.uid}`]: Date.now() }, { merge: true }).catch(() => {});
    for (const m of sortedMsgs) {
      if (m.from !== user.uid && !(m.readBy || {})[user.uid]) {
        updateDoc(doc(db, "families", activeCode, "chats", activeChat.id, "messages", m.id), {
          [`readBy.${user.uid}`]: Date.now(),
        }).catch(() => {});
      }
    }
  }, [sortedMsgs.length, activeChat]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sortedMsgs.length, decrypted, activeChat]);

  async function send(textOrGif, isGif = false) {
    if (!activeChat || !textOrGif.trim()) return;
    const memberIds = activeChat.memberIds || [user.uid];
    const pubs = {};
    for (const uid of memberIds) {
      const p = await getPub(uid);
      if (p) pubs[uid] = p;
    }
    const payload = isGif ? "gif:" + textOrGif : textOrGif;
    const { cipher, keys } = await encryptFor(kp.privJwk, pubs, payload);
    await addDoc(famCol(activeCode, `chats/${activeChat.id}/messages`), {
      from: user.uid,
      ts: Date.now(),
      cipher,
      keys,
      isGif,
    });
    await setDoc(
      doc(db, "families", activeCode, "chats", activeChat.id),
      { lastMessage: { from: user.uid, ts: Date.now() }, updatedAt: Date.now() },
      { merge: true }
    );
  }

  function sendText(e) {
    e.preventDefault();
    if (!text.trim()) return;
    send(text.trim());
    setText("");
  }

  async function searchGifs(e) {
    e.preventDefault();
    if (!giphyKey || !gifQuery.trim()) return;
    setGifSearching(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(gifQuery)}&limit=12&rating=pg`
      );
      const data = await res.json();
      setGifResults(
        (data.data || []).map((g) => ({
          id: g.id,
          url: g.images?.fixed_height?.url || g.images?.original?.url,
        }))
      );
    } catch {
      setGifResults([]);
    }
    setGifSearching(false);
  }

  const dmPartners = members.filter((m) => m.id !== user.uid);
  const existingDmIds = chats.filter((c) => c.type === "dm").map((c) => c.id);
  const newDmMembers = dmPartners.filter((m) => !existingDmIds.includes(dmId(user.uid, m.id)));

  function unreadFor(chat) {
    const lm = chat.lastMessage;
    if (!lm || lm.from === user.uid) return false;
    const lr = (chat.lastRead || {})[user.uid] || 0;
    return (lm.ts || 0) > lr;
  }

  function chatTitle(chat) {
    if (chat.type === "group") return chat.title || "Family group";
    const other = (chat.memberIds || []).find((id) => id !== user.uid);
    return members.find((m) => m.id === other)?.name || "Chat";
  }

  const activeMemberPubMissing = activeChat
    ? (activeChat.memberIds || []).filter((id) => id !== user.uid && !pubRef.current[id])
    : [];

  return (
    <div className="page msg-page">
      <div className="msg-layout">
        <aside className={"msg-list" + (activeChat ? " hide-mobile" : "")}>
          <header className="msg-list-head">
            <h3>💬 Chats</h3>
            <button className="icon-btn" title="My encryption key" onClick={() => setShowKeys((s) => !s)}>
              🔑
            </button>
          </header>

          {showKeys && (
            <div className="keys-box">
              <p className="small">
                Your key fingerprint: <b>{kp?.fp || "…"}</b>. Compare it with family to verify. Back up this key
                to read old messages on a new device:
              </p>
              <div className="keys-actions">
                <button
                  className="btn tiny"
                  onClick={async () => {
                    const data = await exportMyKeyPair(user.uid);
                    const blob = new Blob([data], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "familyhub-chat-key.json";
                    a.click();
                  }}
                >
                  Backup key
                </button>
                <label className="btn tiny">
                  Import key
                  <input
                    type="file"
                    accept=".json"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      try {
                        const kp2 = await importMyKeyPair(user.uid, await f.text());
                        setKp(kp2);
                        setKeyMsg("✓ Key imported");
                      } catch {
                        setKeyMsg("Invalid key file");
                      }
                      setTimeout(() => setKeyMsg(""), 3000);
                    }}
                  />
                </label>
              </div>
              {keyMsg && <p className="small ok-text">{keyMsg}</p>}
            </div>
          )}

          <button className={"chat-item" + (activeChat?.id === "family" ? " on" : "")} onClick={openFamilyChat}>
            <span className="chat-avatar group">👨‍👩‍👧‍👦</span>
            <div className="row-body">
              <span className="row-title">Family group</span>
              <span className="row-sub">Everyone · end-to-end encrypted</span>
            </div>
            {unreadFor(chats.find((c) => c.id === "family") || {}) && <span className="unread-dot" />}
          </button>

          {chats
            .filter((c) => c.type === "dm")
            .map((c) => {
              const other = (c.memberIds || []).find((id) => id !== user.uid);
              const m = members.find((x) => x.id === other);
              if (!m) return null;
              return (
                <button
                  key={c.id}
                  className={"chat-item" + (activeChat?.id === c.id ? " on" : "")}
                  onClick={() => setActiveChat({ id: c.id, type: "dm", title: m.name, memberIds: c.memberIds })}
                >
                  <Avatar src={m.photoURL} name={m.name} color={m.color} size={38} />
                  <div className="row-body">
                    <span className="row-title">{m.name}</span>
                    <span className="row-sub">Private chat</span>
                  </div>
                  {unreadFor(c) && <span className="unread-dot" />}
                </button>
              );
            })}

          {newDmMembers.length > 0 && (
            <>
              <h4 className="muted-head">Start a private chat</h4>
              {newDmMembers.map((m) => (
                <button key={m.id} className="chat-item" onClick={() => openDm(m)}>
                  <Avatar src={m.photoURL} name={m.name} color={m.color} size={38} />
                  <div className="row-body">
                    <span className="row-title">{m.name}</span>
                    <span className="row-sub">Say hi 👋</span>
                  </div>
                  <IconPlus size={16} />
                </button>
              ))}
            </>
          )}
        </aside>

        <section className={"msg-view" + (activeChat ? "" : " hide-mobile")}>
          {!activeChat ? (
            <div className="msg-empty">
              <div className="logo-big">💬</div>
              <h3>Your messages</h3>
              <p className="muted small">End-to-end encrypted — only your family can read them.</p>
            </div>
          ) : (
            <>
              <header className="msg-head">
                <button className="back-btn mobile-only" onClick={() => setActiveChat(null)}>
                  ←
                </button>
                <div className="row-title">{chatTitle(activeChat)}</div>
                <span className="lock-tag">🔐 end-to-end encrypted</span>
              </header>

              {activeMemberPubMissing.length > 0 && (
                <p className="small muted warn-line">
                  ⚠️ Some members haven't opened Messages yet — they'll receive new messages once they do.
                </p>
              )}

              <div className="msg-scroll" ref={scrollRef}>
                {sortedMsgs.map((m) => {
                  const mine = m.from === user.uid;
                  const sender = members.find((x) => x.id === m.from);
                  const body = decrypted[m.id];
                  const isGif = body && body.startsWith("gif:");
                  const read = Object.keys(m.readBy || {}).some((uid) => uid !== user.uid);
                  return (
                    <div key={m.id} className={"msg-row" + (mine ? " mine" : "")}>
                      {!mine && (
                        <Avatar src={sender?.photoURL} name={sender?.name} color={sender?.color} size={26} />
                      )}
                      <div className={"bubble" + (mine ? " my-bubble" : "")}>
                        {!mine && activeChat.type === "group" && (
                          <div className="bubble-name" style={{ color: sender?.color }}>
                            {sender?.name.split(" ")[0]}
                          </div>
                        )}
                        {body == null ? (
                          <span className="muted small">🔒 decrypting…</span>
                        ) : isGif ? (
                          <img className="gif-img" src={body.slice(4)} alt="GIF" loading="lazy" />
                        ) : (
                          <span className="bubble-text">{body}</span>
                        )}
                        <span className="bubble-meta">
                          {timeShort(m.ts || 0)} {mine && (read ? "✓✓" : "✓")}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!sortedMsgs.length && <p className="empty center">Say hello 👋 — messages are encrypted end-to-end.</p>}
              </div>

              {showGiphy && (
                <div className="giphy-panel">
                  {!giphyKey ? (
                    <div className="small">
                      <p className="muted">
                        GIFs need a free Giphy API key (30-second signup at{" "}
                        <a href="https://developers.giphy.com" target="_blank" rel="noreferrer">
                          developers.giphy.com
                        </a>
                        ). Paste it here — it stays on your device:
                      </p>
                      <div className="tx-fields">
                        <input
                          className="grow"
                          placeholder="Paste Giphy API key…"
                          value={giphyKeyInput}
                          onChange={(e) => setGiphyKeyInput(e.target.value)}
                        />
                        <button
                          className="btn primary tiny"
                          onClick={() => {
                            localStorage.setItem(GIPHY_KEY_STORAGE, giphyKeyInput.trim());
                            setGiphyKey(giphyKeyInput.trim());
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <form className="tx-fields" onSubmit={searchGifs}>
                        <input
                          className="grow"
                          placeholder="Search GIFs…"
                          value={gifQuery}
                          onChange={(e) => setGifQuery(e.target.value)}
                        />
                        <button className="btn tiny primary">Search</button>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => {
                            localStorage.removeItem(GIPHY_KEY_STORAGE);
                            setGiphyKey("");
                            setGifResults([]);
                          }}
                        >
                          Reset key
                        </button>
                      </form>
                      {gifSearching && <p className="muted small">Searching…</p>}
                      <div className="gif-grid">
                        {gifResults.map((g) => (
                          <button key={g.id} className="gif-thumb" onClick={() => { send(g.url, true); setShowGiphy(false); }}>
                            <img src={g.url} alt="gif" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {showEmoji && (
                <div className="emoji-panel">
                  {EMOJIS.map((e) => (
                    <button key={e} className="emoji-pick" onClick={() => setText((t) => t + e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <form className="composer" onSubmit={sendText}>
                <button type="button" className="icon-btn" onClick={() => { setShowEmoji((s) => !s); setShowGiphy(false); }}>
                  😊
                </button>
                <button type="button" className="icon-btn" onClick={() => { setShowGiphy((s) => !s); setShowEmoji(false); }}>
                  GIF
                </button>
                <input
                  className="grow"
                  placeholder="Type a message…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button className="btn primary" disabled={!text.trim()}>
                  Send ➤
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
