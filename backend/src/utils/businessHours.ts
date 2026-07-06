/**
 * Business Hours Utility
 *
 * Timezone-aware check using Node 20's built-in Intl.DateTimeFormat.
 * No external dependency required.
 *
 * @param start     Opening time in "HH:MM" 24-hour format, e.g. "09:00"
 * @param end       Closing time in "HH:MM" 24-hour format, e.g. "18:00"
 * @param timezone  IANA timezone string, e.g. "Asia/Kolkata"
 * @param now       Optional date to test against (defaults to current time — useful for unit tests)
 * @returns         true if the current local time is within [start, end)
 *
 * Examples:
 *   isWithinBusinessHours('09:00', '18:00', 'Asia/Kolkata')
 *   // → true if it is currently between 9:00 AM and 5:59 PM IST
 *
 *   isWithinBusinessHours('09:00', '18:00', 'Asia/Kolkata', new Date('2024-01-15T06:00:00Z'))
 *   // → true (06:00 UTC = 11:30 IST, which is within 09:00–18:00)
 */
export function isWithinBusinessHours(
  start: string,
  end: string,
  timezone: string,
  now: Date = new Date(),
): boolean {
  try {
    // Use Intl to get current HH and MM in the org's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hour   = Number(parts.find((p) => p.type === 'hour')?.value   ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);

    // Intl.DateTimeFormat with hour12:false can return "24" at midnight — normalise
    const currentMinutes = (hour === 24 ? 0 : hour) * 60 + minute;

    const [startHour = 9,  startMin = 0]  = start.split(':').map(Number);
    const [endHour   = 17, endMin   = 0]  = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes   = endHour   * 60 + endMin;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    // Unknown timezone or parse error — default to OPEN to avoid missed calls
    return true;
  }
}

/**
 * Returns a human-readable description of business hours.
 * e.g. "Monday–Friday, 9:00 AM – 6:00 PM (IST)"
 */
export function formatBusinessHours(
  start: string,
  end: string,
  timezone: string,
): string {
  try {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);

    const fmt = (h: number, m: number) => {
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12    = h % 12 || 12;
      return m === 0 ? `${h12}:00 ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
    };

    // Derive short timezone label (e.g. "IST", "PST")
    const tzLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? timezone;

    return `${fmt(sh ?? 9, sm ?? 0)} – ${fmt(eh ?? 17, em ?? 0)} (${tzLabel})`;
  } catch {
    return `${start} – ${end}`;
  }
}
