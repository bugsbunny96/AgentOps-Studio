/** Clickable email address (mailto:) — used on legal and contact pages. */
export function MailLink({ to, color = '#21F1A8' }: { to: string; color?: string }) {
  return (
    <a href={`mailto:${to}`} style={{ color, textDecoration: 'underline', textUnderlineOffset: 2, wordBreak: 'break-word' }}>
      {to}
    </a>
  );
}
