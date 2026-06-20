function normalize(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function flattenValues(values) {
  const flattened = [];

  for (const value of Array.isArray(values) ? values.flat(Infinity) : [values]) {
    if (value === undefined || value === null || value === "") continue;
    if (["string", "number", "bigint", "boolean"].includes(typeof value)) {
      flattened.push(value);
    }
  }

  return flattened;
}

function getSearchTerms(search) {
  if (search === undefined || search === null) return [];

  const terms = [];
  const matches = String(search).matchAll(/"([^"]+)"|(\S+)/g);

  for (const match of matches) {
    const phrase = normalize(match[1] ?? match[2]);
    if (!phrase) continue;

    if (match[1] !== undefined) {
      terms.push({ value: phrase, isPhrase: true });
    } else {
      terms.push(...phrase.split(" ").map((value) => ({ value, isPhrase: false })));
    }
  }

  return terms.filter(
    (term, index) =>
      terms.findIndex(
        (candidate) =>
          candidate.value === term.value && candidate.isPhrase === term.isPhrase,
      ) === index,
  );
}

module.exports = function matchesSearch(search, values) {
  const terms = getSearchTerms(search);
  if (!terms.length) return true;

  const normalizedValues = flattenValues(values).map(normalize).filter(Boolean);
  const searchableText = normalizedValues.join(" ");

  return terms.every((term) =>
    term.isPhrase
      ? normalizedValues.some((value) => value.includes(term.value))
      : searchableText.includes(term.value),
  );
};
