const assert = require("node:assert/strict");
const test = require("node:test");
const voiceChannelInvite = require("../src/modules/voiceChannelInvite");

test("creates a one-hour voice invite", async () => {
  let options = null;
  const channel = {
    guildId: "guild-1",
    createInvite: async (value) => {
      options = value;
      return { url: "https://discord.gg/example" };
    },
  };
  const client = {
    modules: { fetchChannel: async () => channel },
  };

  const url = await voiceChannelInvite(client, "guild-1", "voice-1");

  assert.equal(url, "https://discord.gg/example");
  assert.deepEqual(options, {
    maxAge: 3600,
    maxUses: 0,
    unique: true,
    reason: "Dock voice ping",
  });
});

test("does not create an invite for another guild's channel", async () => {
  const client = {
    modules: {
      fetchChannel: async () => ({
        guildId: "guild-2",
        createInvite: async () => ({ url: "https://discord.gg/unexpected" }),
      }),
    },
  };

  assert.equal(await voiceChannelInvite(client, "guild-1", "voice-1"), null);
});
