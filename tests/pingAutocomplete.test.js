const assert = require("node:assert/strict");
const test = require("node:test");

const partyPing = require("../commands/party/ping");
const dockKeywordPings = require("../src/modules/dockKeywordPings");
const messageCreate = require("../events/messageCreate");

async function getGroupChoices(channelId) {
  let choices;
  await partyPing.autocomplete({
    channelId,
    guildId: "guild-1",
    options: {
      getFocused: (withName) => (withName ? { name: "role" } : ""),
    },
    client: {
      modules: {
        db: {
          getSettings: async () => ({
            pingGroups: [
              { name: "Everywhere", allowedChannels: [] },
              { name: "Party chat", allowedChannels: ["party-channel"] },
              { name: "Staff chat", allowedChannels: ["staff-channel"] },
            ],
          }),
        },
        dockKeywordPings: { getChoices: async () => [] },
      },
    },
    respond: async (value) => {
      choices = value;
    },
  });
  return choices;
}

test("party ping autocomplete only shows groups allowed in the current channel", async () => {
  assert.deepEqual(
    await getGroupChoices("party-channel"),
    [
      { name: "Everywhere", value: "Everywhere" },
      { name: "Party chat", value: "Party chat" },
    ],
  );
  assert.deepEqual(
    await getGroupChoices("other-channel"),
    [{ name: "Everywhere", value: "Everywhere" }],
  );
});

test("Dock keywords remain visible without Host Role access but resolve ephemerally", async () => {
  const dockId = "507f1f77bcf86cd799439011";
  const follow = { dockId, hostRoleIds: ["host-role"] };
  const interaction = {
    guildId: "guild-1",
    channelId: "channel-1",
    member: { roles: { cache: new Map([["guest-role", {}]]) } },
    client: {
      modules: {
        dockLevels: { canPing: () => true },
        dockRelay: { getWritableDockFollows: async () => [follow] },
        db: {
          getDock: async () => ({
            _id: dockId,
            guildId: "guild-1",
            name: "Expeditions",
            keywords: ["dragon hunt"],
          }),
        },
      },
    },
  };

  const choices = await dockKeywordPings.getChoices(interaction, "dragon");
  assert.equal(choices.length, 1);

  const result = await dockKeywordPings.resolveChoice(interaction, choices[0].value);
  assert.match(result.error, /don't have permission/);
});

function keywordMessage(roleIds) {
  const replies = [];
  const client = {
    user: { id: "bot" },
    modules: {
      dockKeywordPings,
      db: {
        getSettings: async () => ({
          pingGroups: [{
            name: "Staff alerts",
            roleId: "ping-role",
            allowedRoles: ["host-role"],
            allowedChannels: [],
            keywords: ["dragon hunt"],
          }],
        }),
      },
      dockRelay: {
        getPartyIdFromComponents: () => null,
        getWritableDockFollows: async () => [],
      },
      mentions: { formatRoleMentions: (ids) => ids.map((id) => `<@&${id}>`).join(" ") },
      annotateMentions: (_client, content) => content,
      uniqueItems: (items) => [...new Set(items)],
      voiceChannelLabel: () => null,
    },
  };
  const message = {
    client,
    id: "message-1",
    content: "dragon hunt",
    guildId: "guild-1",
    channel: { id: "channel-1", isThread: () => false },
    author: { id: "user-1", bot: false, username: "Captain" },
    member: { roles: { cache: new Map(roleIds.map((roleId) => [roleId, {}])) } },
    reply: async (payload) => replies.push(payload),
  };
  return { message, replies };
}

test("keyword ping groups enforce allowed roles", async () => {
  const denied = keywordMessage(["guest-role"]);
  await messageCreate.execute(denied.message);
  assert.equal(denied.replies.length, 0);

  const allowed = keywordMessage(["host-role"]);
  await messageCreate.execute(allowed.message);
  assert.equal(allowed.replies.length, 1);
});
