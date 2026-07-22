const assert = require("node:assert/strict");
const test = require("node:test");
const timezoneCommand = require("../commands/utility/timezone");
const pingCommand = require("../commands/party/ping");
const timeZones = require("../src/modules/timeZones");

test("/timezone set saves a user timezone", async () => {
  let saved = null;
  let reply = null;
  const interaction = {
    user: { id: "user-1" },
    options: { getString: () => "America/Chicago" },
    client: {
      modules: {
        timeZones,
        db: {
          setUserTimezone: async (userId, timeZone) => {
            saved = { userId, timeZone };
          },
        },
      },
    },
    reply: async (value) => {
      reply = value;
    },
  };

  await timezoneCommand.execute(interaction);

  assert.deepEqual(saved, { userId: "user-1", timeZone: "America/Chicago" });
  assert.match(reply.content, /America \/ Chicago \(CST\/CDT\)/);
});

test("scheduled party pings require a saved timezone", async () => {
  let reply = null;
  const values = {
    role: "Players",
    extra: null,
    time: "8pm tomorrow",
  };
  const interaction = {
    guild: {},
    guildId: "guild-1",
    member: {},
    user: { id: "user-1" },
    options: { getString: (name) => values[name] },
    client: {
      modules: {
        db: {
          getCurrentParty: async () => null,
          getUserTimezone: async () => null,
        },
        dockKeywordPings: {},
        voiceChannelLabel: () => null,
      },
    },
    reply: async (value) => {
      reply = value;
    },
  };

  await pingCommand.execute(interaction);

  assert.match(reply.content, /\/timezone set/);
});
