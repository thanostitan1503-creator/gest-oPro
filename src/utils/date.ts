export const normalizeDateForSupabase = (value: string | Date | number | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const v = String(value).trim();
  if (v === '' || v.toLowerCase() === 'null') return null;
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // try parsing other formats
  const parsed = new Date(v);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

export default normalizeDateForSupabase;
