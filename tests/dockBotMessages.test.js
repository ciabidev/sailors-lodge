const assert = require("node:assert/strict");
const test = require("node:test");
const { relayMessage, relayThreadMessage } = require("../src/modules/dockRelay");

for (const includeBotMessages of [undefined, false, true]) {
  test(`bot channel messages require opt-in (${includeBotMessages})`, async () => {
    let lookedUpDock = false;
    const message = {
      author: { id: "other-bot", bot: true },
      client: { user: { id: "sailors-lodge" }, modules: { db: {
        getDock: async () => { lookedUpDock = true; return null; },
      } } },
    };
    await relayMessage(message, {}, { dockId: "dock", includeBotMessages });
    assert.equal(lookedUpDock, includeBotMessages === true);
  });
  test(`bot thread messages require opt-in (${includeBotMessages})`, async () => {
    let lookedUpFollowers = false;
    const message = {
      author: { id: "other-bot", bot: true }, guildId: "guild", channel: { id: "thread" },
      client: { user: { id: "sailors-lodge" }, modules: { db: {
        getDockThreads: async () => [{ _id: "record", dockId: "dock", rootThreadId: "thread" }],
        getDock: async () => ({ _id: "dock", guildId: "guild" }),
        getDockFollower: async () => ({ includeBotMessages }),
        getDockFollowers: async () => { lookedUpFollowers = true; return []; },
      } } },
    };
    await relayThreadMessage(message);
    assert.equal(lookedUpFollowers, includeBotMessages === true);
  });
}

for (const relay of [relayMessage, relayThreadMessage]) {
  test(`${relay.name} always excludes Sailor's Lodge and webhook copies`, async () => {
    for (const author of [{ id: "sailors-lodge", bot: true }, { id: "webhook", bot: true }]) {
      await relay({ author, webhookId: author.id === "webhook" ? "hook" : null,
        client: { user: { id: "sailors-lodge" } },
      }, {}, { includeBotMessages: true });
    }
  });
}
