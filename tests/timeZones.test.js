const assert = require("node:assert/strict");
const test = require("node:test");
const timeZones = require("../src/modules/timeZones");

test("validates and searches IANA timezones", () => {
  assert.equal(timeZones.isValid("America/New_York"), true);
  assert.equal(timeZones.isValid("Not/A_Timezone"), false);
  assert.ok(
    timeZones.choices("new york").some((choice) => choice.value === "America/New_York"),
  );
  assert.deepEqual(timeZones.choices("EST")[0], {
    name: "America / New York (EST/EDT)",
    value: "America/New_York",
  });
});
