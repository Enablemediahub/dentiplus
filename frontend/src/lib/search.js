function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchesSearchText(searchableText, query) {
  const searchTerms = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);
  if (searchTerms.length === 0) {
    return true;
  }

  const normalizedText = normalizeSearchText(searchableText);
  return searchTerms.every((term) => normalizedText.includes(term));
}
