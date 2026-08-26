import React from "react";

function S({ size = 20, sw = 2, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p) => (
  <S {...p}>
    <path d="M3 10.8 12 3l9 7.8" />
    <path d="M5 9.9V20a1 1 0 0 0 1 1h3.5v-5.5a2.5 2.5 0 0 1 5 0V21H18a1 1 0 0 0 1-1V9.9" />
  </S>
);

export const IconCheck = (p) => (
  <S {...p}>
    <path d="M20 6 9 17l-5-5" />
  </S>
);

export const IconCheckSquare = (p) => (
  <S {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d="m8.5 12 2.5 2.5 5-5" />
  </S>
);

export const IconCart = (p) => (
  <S {...p}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="17" cy="20" r="1.4" />
    <path d="M2.5 3.5h2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.3l1.5-7.7H6" />
  </S>
);

export const IconCalendar = (p) => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="16" rx="4" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M8 15h.01M12 15h.01M16 15h.01" strokeWidth="2.6" />
  </S>
);

export const IconUsers = (p) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20c.7-3.2 3.2-5 6.2-5s5.5 1.8 6.2 5" />
    <path d="M16 5.4a3.4 3.4 0 0 1 0 5.9M18.5 15.4c1.6.8 2.5 2.3 2.8 4.1" />
  </S>
);

export const IconLogout = (p) => (
  <S {...p}>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </S>
);

export const IconPlus = (p) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);

export const IconX = (p) => (
  <S {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </S>
);

export const IconTrash = (p) => (
  <S {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </S>
);

export const IconCopy = (p) => (
  <S {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </S>
);

export const IconChevronLeft = (p) => (
  <S {...p}>
    <path d="m15 18-6-6 6-6" />
  </S>
);

export const IconChevronRight = (p) => (
  <S {...p}>
    <path d="m9 18 6-6-6-6" />
  </S>
);

export const IconClock = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 1.8" />
  </S>
);

export const IconSparkles = (p) => (
  <S {...p}>
    <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z" />
    <path d="M19 3v3M20.5 4.5h-3M5 17v2.4M6.2 18.2H3.8" />
  </S>
);

export const IconLink = (p) => (
  <S {...p}>
    <path d="M10 13a5 5 0 0 0 7.5.5l2.5-2.5a5 5 0 0 0-7-7L11.5 5.5" />
    <path d="M14 11a5 5 0 0 0-7.5-.5L4 13a5 5 0 0 0 7 7l1.5-1.5" />
  </S>
);

export const IconArrowLeft = (p) => (
  <S {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </S>
);

export const IconSwitch = (p) => (
  <S {...p}>
    <path d="M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5" />
  </S>
);

export const IconWallet = (p) => (
  <S {...p}>
    <path d="M20 7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h13v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2" />
    <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
  </S>
);

export const IconHeart = (p) => (
  <S {...p}>
    <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.1a5 5 0 1 1 7.5 6.5Z" />
  </S>
);

export function GoogleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.27v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

export function Logo({ size = 40 }) {
  const gid = React.useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`g${gid}`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6B4A" />
          <stop offset="1" stopColor="#F43F8E" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#g${gid})`} />
      <path
        d="M12.5 24.2 24 14.2l11.5 10"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 23.4V32a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-8.6"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M24 31.4c-2.7-1.9-4.6-3.6-4.6-5.5 0-1.4 1.1-2.4 2.4-2.4.9 0 1.7.5 2.2 1.2.5-.7 1.3-1.2 2.2-1.2 1.3 0 2.4 1 2.4 2.4 0 1.9-1.9 3.6-4.6 5.5z"
        fill="#fff"
      />
    </svg>
  );
}
