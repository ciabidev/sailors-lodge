const assert = require("node:assert/strict");
const test = require("node:test");
const timeFiltering = require("../src/modules/timeFiltering");

test("parses the same wall-clock input in each user's timezone", () => {
  const now = new Date("2026-07-21T12:00:00Z");

  assert.equal(
    timeFiltering.parseTimeInput("8pm tomorrow", now, "America/New_York").toISOString(),
    "2026-07-23T00:00:00.000Z",
  );
  assert.equal(
    timeFiltering.parseTimeInput("8pm tomorrow", now, "America/Los_Angeles").toISOString(),
    "2026-07-23T03:00:00.000Z",
  );
});

test("uses the target date's daylight-saving offset", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const sendAt = timeFiltering.parseTimeInput(
    "July 1 at 8pm",
    now,
    "America/New_York",
  );

  assert.equal(sendAt.toISOString(), "2026-07-02T00:00:00.000Z");
});

test("keeps relative durations absolute across daylight-saving changes", () => {
  const now = new Date("2026-11-01T04:30:00Z");
  const sendAt = timeFiltering.parseTimeInput("in 2 hours", now, "America/New_York");

  assert.equal(sendAt.toISOString(), "2026-11-01T06:30:00.000Z");
});
