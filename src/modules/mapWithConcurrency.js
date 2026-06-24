// Runs async work for a list, but only starts `limit` jobs at a time.
module.exports = async function mapWithConcurrency(items, limit, worker) {
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index]);
      }
    }),
  );
};
