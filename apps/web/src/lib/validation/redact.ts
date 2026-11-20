/** Minimise data sent to any model: strip obvious direct identifiers from free text. */
export function redactIdentifiers(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email removed]")
    .replace(/(?:\+?\d[\s-]?){9,}/g, "[number removed]");
}

/** Models sometimes wrap JSON in code fences or add a sentence around it. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found");
  return JSON.parse(text.slice(start, end + 1));
}
