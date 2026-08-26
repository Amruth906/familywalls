let listener = null;
let kickListener = null;

export function setDbError(msg) {
  if (listener) listener(msg);
}

export function onDbError(fn) {
  listener = fn;
  return () => {
    listener = null;
  };
}

export function setKicked(code) {
  if (kickListener) kickListener(code);
}

export function onKicked(fn) {
  kickListener = fn;
  return () => {
    kickListener = null;
  };
}
