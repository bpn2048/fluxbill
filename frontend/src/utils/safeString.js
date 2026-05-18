export function safeString(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}
