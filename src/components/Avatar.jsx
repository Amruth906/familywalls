import React from "react";

export default function Avatar({ src, name, color, size = 34 }) {
  if (src)
    return (
      <img
        className="avatar"
        src={src}
        alt={name || "avatar"}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: color || "#4f8cff",
        fontSize: size * 0.42,
      }}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
