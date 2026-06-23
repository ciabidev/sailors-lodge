function uniqueItems(items) {
  return [...new Set(items ?? [])];
}

module.exports = uniqueItems;
