// Shared date-range formatter used by Experience and Education sections.
// Inputs are ISO YYYY-MM or YYYY strings. "Present" stays as "Present".
// Output examples: "Jun 2022 to Dec 2023", "Jan 2024 to Present".

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatYearMonth(iso) {
  if (!iso) return '';
  if (typeof iso !== 'string') return String(iso);
  const [y, m] = iso.split('-');
  if (!m) return y;
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return iso;
  return `${MONTHS[idx]} ${y}`;
}

export function formatDateRange(start, end) {
  const s = formatYearMonth(start);
  const e = (end && end.toLowerCase() === 'present') ? 'Present' : formatYearMonth(end);
  if (!s && !e) return '';
  return `${s || '?'} to ${e || 'Present'}`;
}

export default formatDateRange;