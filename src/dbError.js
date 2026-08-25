let listener = null;

export function setDbError(msg) {
  if (listener) listener(msg);
}

export function onDbError(fn) {
  listener = fn;
  return () => {
    listener = null;
  };
}
