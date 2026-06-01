export function normalizeDateEntry(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isoToDisplayDate(value) {
  const text = String(value ?? '').trim();
  if (text === '') {
    return '';
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  return normalizeDateEntry(text);
}

export function displayDateToIso(value) {
  const normalized = normalizeDateEntry(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return '';
  }

  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  if (
    parsed.getFullYear() !== Number(year)
    || parsed.getMonth() + 1 !== Number(month)
    || parsed.getDate() !== Number(day)
  ) {
    return '';
  }

  return iso;
}

export function normalizeDateForPicker(value) {
  const text = String(value ?? '').trim();
  if (text === '') {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return displayDateToIso(text);
}

export function formatDateRangeLabel(startDate, endDate) {
  return `${startDate || 'Beginning'} to ${endDate || 'Today'}`;
}
