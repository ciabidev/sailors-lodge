const assert = require("node:assert/strict");
const test = require("node:test");

const { hasHostRole } = require("../events/messageCreate");

function memberWith(...roleIds) {
  return { roles: { cache: new Map(roleIds.map((roleId) => [roleId, {}])) } };
}

test("Dock Host Roles allow everyone when none are configured", () => {
  assert.equal(hasHostRole(null, []), true);
  assert.equal(hasHostRole(memberWith(), undefined), true);
});

test("Dock Host Roles require at least one configured role", () => {
  assert.equal(hasHostRole(memberWith("host"), ["host", "captain"]), true);
  assert.equal(hasHostRole(memberWith("guest"), ["host", "captain"]), false);
  assert.equal(hasHostRole(null, ["host"]), false);
});
