export function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const value = item as { msg?: unknown; loc?: unknown };
        const message = typeof value.msg === "string" ? value.msg : JSON.stringify(item);
        const location = Array.isArray(value.loc) ? value.loc.filter((part) => part !== "body").join(".") : "";
        return location ? `${location}: ${message}` : message;
      }
      return String(item);
    });
    return messages.filter(Boolean).join("; ");
  }
  if (detail && typeof detail === "object") {
    const value = detail as { message?: unknown; msg?: unknown };
    if (typeof value.message === "string") return value.message;
    if (typeof value.msg === "string") return value.msg;
    return JSON.stringify(detail);
  }
  return "";
}
