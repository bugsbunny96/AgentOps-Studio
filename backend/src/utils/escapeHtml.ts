/**
 * Escape a value for safe insertion into HTML email bodies (SEC-09).
 * Use for anything a user, caller or the LLM can influence: names, org names,
 * caller numbers, call summaries, follow-up reasons. Not for subjects (plain text).
 */
const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => MAP[c]);
}
