import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { doc, setDoc, addDoc, deleteDoc } from "firebase/firestore";
import { useApp, famCol } from "../store.jsx";
import { db } from "../firebase.js";
import { useCollection } from "../useData.js";
import Avatar from "../components/Avatar.jsx";
import { IconNavigation, IconX } from "../components/Icons.jsx";

const PLACE_EMOJIS = ["🏠", "🏫", "💼", "🛒", "🏥", "🛝", "📍"];
const RADII = [
  { v: 150, label: "150 m" },
  { v: 300, label: "300 m" },
  { v: 750, label: "750 m" },
  { v: 2000, label: "2 km" },
];

function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function fmtDist(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function timeAgo(ts) {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function MapPage() {
  const { user, activeCode, members } = useApp();
  const { docs: locations } = useCollection(activeCode, "locations");
  const { docs: places } = useCollection(activeCode, "places");

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const placeMarkersRef = useRef({});
  const didFit = useRef(false);
  const watchRef = useRef(null);
  const lastWrite = useRef(0);
  const shareUntilRef = useRef(0);
  const pickRef = useRef(false);
  const insideRef = useRef({});

  const [sharing, setSharing] = useState(() => localStorage.getItem(`fh_sharing_${activeCode}`) === "1");
  const [shareUntil, setShareUntil] = useState(() => Number(localStorage.getItem(`fh_share_until_${activeCode}`) || 0));
  const [alerts, setAlerts] = useState([]);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [placing, setPlacing] = useState(null);
  const [pickMode, setPickMode] = useState(false);
  const [locErr, setLocErr] = useState("");

  useEffect(() => {
    shareUntilRef.current = shareUntil;
  }, [shareUntil]);

  useEffect(() => {
    const map = L.map(mapEl.current).setView([20.59, 78.96], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;
    map.on("click", (e) => {
      if (pickRef.current && placing) {
        setPlacing((p) => ({ ...p, lat: e.latlng.lat, lng: e.latlng.lng }));
        pickRef.current = false;
        setPickMode(false);
      }
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [activeCode]);

  const now = Date.now();
  const memberLocs = useMemo(() => {
    return members
      .map((m) => ({
        member: m,
        loc: locations.find((l) => l.id === m.id) || null,
      }))
      .filter(({ loc }) => loc && loc.lat != null);
  }, [members, locations]);

  const activeLocs = useMemo(
    () => memberLocs.filter(({ loc }) => !loc.sharingUntil || loc.sharingUntil > now),
    [memberLocs, now]
  );

  const myLoc = memberLocs.find(({ member }) => member.id === user.uid)?.loc || null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const { member, loc } of activeLocs) {
      const html = `<div class="map-pin" style="background:${member.color}">${(member.name || "?")[0].toUpperCase()}</div>`;
      const icon = L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 18] });
      let marker = markersRef.current[member.id];
      if (!marker) {
        marker = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: 500 }).addTo(map);
        markersRef.current[member.id] = marker;
        marker.bindTooltip(member.name, { permanent: false });
      } else {
        marker.setLatLng([loc.lat, loc.lng]).setIcon(icon);
      }
    }
    if (!didFit.current && activeLocs.length) {
      const pts = activeLocs.map(({ loc }) => [loc.lat, loc.lng]);
      map.fitBounds(L.latLngBounds(pts).pad(0.35));
      didFit.current = true;
    }
  }, [activeLocs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const p of places) {
      if (placeMarkersRef.current[p.id]) continue;
      const circle = L.circle([p.lat, p.lng], {
        radius: p.radius || 200,
        color: "#6c5ce7",
        fillColor: "#6c5ce7",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: `<div class="map-place">${p.emoji}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker([p.lat, p.lng], { icon, zIndexOffset: 300 }).addTo(map);
      marker.bindTooltip(`${p.emoji} ${p.name}`);
      placeMarkersRef.current[p.id] = { circle, marker };
    }
  }, [places]);

  function pushAlert(text) {
    setAlerts((a) => [{ id: Date.now() + Math.random(), text, at: Date.now() }, ...a].slice(0, 25));
  }

  useEffect(() => {
    for (const { member, loc } of activeLocs) {
      if (member.id === user.uid) continue;
      for (const p of places) {
        const key = `${member.id}|${p.id}`;
        const d = distanceM(loc.lat, loc.lng, p.lat, p.lng);
        const isInside = d <= (p.radius || 200);
        const wasInside = !!insideRef.current[key];
        if (isInside && !wasInside) pushAlert(`${member.name} arrived near ${p.emoji} ${p.name}`);
        if (!isInside && wasInside) pushAlert(`${member.name} left ${p.emoji} ${p.name}`);
        insideRef.current[key] = isInside;
      }
    }
  }, [activeLocs, places]);

  async function writePos(pos) {
    const t = Date.now();
    if (t - lastWrite.current < 20000) return;
    lastWrite.current = t;
    await setDoc(doc(db, "families", activeCode, "locations", user.uid), {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      updatedAt: t,
      sharingUntil: shareUntilRef.current || null,
    });
  }

  function startShare(minutes) {
    if (!navigator.geolocation) {
      setLocErr("This browser doesn't support location.");
      return;
    }
    const until = minutes ? Date.now() + minutes * 60000 : 0;
    shareUntilRef.current = until;
    localStorage.setItem(`fh_sharing_${activeCode}`, "1");
    localStorage.setItem(`fh_share_until_${activeCode}`, String(until));
    setShareUntil(until);
    setSharing(true);
    setLocErr("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastWrite.current = 0;
        writePos(pos);
      },
      (e) => {
        setLocErr("Couldn't get your location (" + e.message + "). Check browser permissions.");
        stopShare();
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
    );
    watchRef.current = navigator.geolocation.watchPosition(writePos, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 60000,
    });
  }

  async function stopShare() {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    localStorage.removeItem(`fh_sharing_${activeCode}`);
    localStorage.removeItem(`fh_share_until_${activeCode}`);
    setSharing(false);
    setShareUntil(0);
    shareUntilRef.current = 0;
    await deleteDoc(doc(db, "families", activeCode, "locations", user.uid)).catch(() => {});
  }

  useEffect(() => {
    const t = setInterval(() => {
      if (sharing && shareUntil && Date.now() > shareUntil) stopShare();
    }, 20000);
    return () => clearInterval(t);
  }, [sharing, shareUntil]);

  async function savePlace(e) {
    e.preventDefault();
    if (!placing || !placing.name.trim() || placing.lat == null) return;
    await addDoc(famCol(activeCode, "places"), {
      name: placing.name.trim(),
      emoji: placing.emoji,
      lat: placing.lat,
      lng: placing.lng,
      radius: placing.radius,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setShowPlaceForm(false);
    setPlacing(null);
  }

  async function deletePlace(id) {
    await deleteDoc(doc(db, "families", activeCode, "places", id));
  }

  function useMyLocationForPlace() {
    navigator.geolocation.getCurrentPosition(
      (pos) => setPlacing((p) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude })),
      () => setLocErr("Couldn't get your location.")
    );
  }

  function directions(lat, lng, label) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
  }

  return (
    <div className="page wide">
      <h2 className="page-title">Map</h2>

      <section className="panel">
        <div className="share-row">
          <div className="share-status">
            {sharing ? (
              <>
                <span className="pulse-dot" /> Sharing{" "}
                {shareUntil ? (
                  <b>until {new Date(shareUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>
                ) : (
                  <b>until you stop</b>
                )}
              </>
            ) : (
              <>
                <span className="dot" style={{ background: "#c9c5bd" }} /> Not sharing your location
              </>
            )}
          </div>
          {sharing ? (
            <button className="btn danger" onClick={stopShare}>
              Stop sharing
            </button>
          ) : (
            <div className="dur-btns">
              <button className="btn tiny" onClick={() => startShare(15)}>15 min</button>
              <button className="btn tiny" onClick={() => startShare(60)}>1 hour</button>
              <button className="btn tiny" onClick={() => startShare(480)}>8 hours</button>
              <button className="btn primary tiny" onClick={() => startShare(0)}>Forever</button>
            </div>
          )}
        </div>
        {locErr && <div className="error" style={{ marginTop: 10 }}>{locErr}</div>}

        <div className="map-wrap" ref={mapEl} />

        <div className="member-locs">
          {members.map((m) => {
            const entry = memberLocs.find((x) => x.member.id === m.id);
            const loc = entry?.loc;
            const active = loc && (!loc.sharingUntil || loc.sharingUntil > now);
            return (
              <div key={m.id} className="member-loc-row">
                <Avatar src={m.photoURL} name={m.name} color={m.color} size={34} />
                <div className="row-body">
                  <span className="row-title">
                    {m.name} {m.id === user.uid && <span className="you-tag">you</span>}
                  </span>
                  <span className="row-sub">
                    {active
                      ? `📍 last seen ${timeAgo(loc.updatedAt)}`
                      : "not sharing"}
                    {active && myLoc && m.id !== user.uid &&
                      ` · ${fmtDist(distanceM(myLoc.lat, myLoc.lng, loc.lat, loc.lng))} away`}
                  </span>
                </div>
                {active && m.id !== user.uid && (
                  <button className="btn tiny" onClick={() => directions(loc.lat, loc.lng)}>
                    <IconNavigation size={14} /> Directions
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h3>📍 Places & alerts</h3>
          <button
            className="btn tiny"
            onClick={() => {
              setShowPlaceForm((s) => !s);
              setPlacing({ name: "", emoji: "📍", radius: 300, lat: null, lng: null });
            }}
          >
            {showPlaceForm ? "Cancel" : "Add place"}
          </button>
        </header>

        {showPlaceForm && placing && (
          <form className="panel place-form" onSubmit={savePlace}>
            <input
              className="grow"
              placeholder="Place name… e.g. Home, School"
              value={placing.name}
              onChange={(e) => setPlacing({ ...placing, name: e.target.value })}
            />
            <div className="emoji-row">
              {PLACE_EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  className={"emoji" + (placing.emoji === e ? " on" : "")}
                  onClick={() => setPlacing({ ...placing, emoji: e })}
                >
                  {e}
                </button>
              ))}
            </div>
            <select
              value={placing.radius}
              onChange={(e) => setPlacing({ ...placing, radius: Number(e.target.value) })}
            >
              {RADII.map((r) => (
                <option key={r.v} value={r.v}>
                  Alert radius: {r.label}
                </option>
              ))}
            </select>
            <div className="place-loc-actions">
              <button type="button" className="btn" onClick={useMyLocationForPlace}>
                📍 Use my location
              </button>
              <button
                type="button"
                className={"btn" + (pickMode ? " primary" : "")}
                onClick={() => {
                  pickRef.current = true;
                  setPickMode(true);
                }}
              >
                🗺️ {pickMode ? "Tap the map…" : "Pick on map"}
              </button>
              {placing.lat != null && <span className="ok">✓ location set</span>}
            </div>
            <button className="btn primary" disabled={!placing.name.trim() || placing.lat == null}>
              Save place
            </button>
          </form>
        )}

        <ul className="row-list">
          {places.map((p) => (
            <li key={p.id}>
              <span className="cat-emoji">{p.emoji}</span>
              <div className="row-body">
                <span className="row-title">{p.name}</span>
                <span className="row-sub">alert radius {fmtDist(p.radius || 200)}</span>
              </div>
              <button className="btn tiny" onClick={() => directions(p.lat, p.lng)}>
                <IconNavigation size={14} />
              </button>
              <button className="icon-btn danger" onClick={() => deletePlace(p.id)}>
                <IconX size={15} />
              </button>
            </li>
          ))}
          {!places.length && (
            <p className="empty">
              Add places like Home, School or Office — get an alert here whenever a family member arrives or leaves.
            </p>
          )}
        </ul>

        {alerts.length > 0 && (
          <>
            <h4 className="muted-head">
              🔔 Alerts{" "}
              <button className="linklike" onClick={() => setAlerts([])}>
                clear
              </button>
            </h4>
            <ul className="alerts-list">
              {alerts.map((a) => (
                <li key={a.id}>
                  {a.text} <span className="muted">· {timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
