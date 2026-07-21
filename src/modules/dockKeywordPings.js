const DOCK_ROLE_PREFIX = "dock:";
const PING_METADATA_TTL_MS = 60 * 60 * 1000;

function hasRole(member, roleId) {
  return Boolean(member?.roles?.cache?.has?.(roleId) || member?.roles?.includes?.(roleId));
}

function hasHostRole(member, hostRoleIds) {
  if (!Array.isArray(hostRoleIds) || hostRoleIds.length === 0) return true;
  return hostRoleIds.some((roleId) => hasRole(member, roleId));
}

function findMatchingKeyword(text = "", keywords = []) {
  const normalizedText = String(text ?? "").toLowerCase();

  return (keywords ?? []).find((keyword) => {
    const normalizedKeyword = keyword.toLowerCase().trim();
    if (!normalizedKeyword) return false;

    const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escapedKeyword}(?=\\s|$)`).test(normalizedText);
  });
}

function canTrigger(client, dock, guildId, sendingFollower) {
  return (
    dock?.guildId === guildId ||
    client.modules.dockLevels.canPing(sendingFollower?.level)
  );
}

function parseChoice(value) {
  const match = value?.match(/^dock:([0-9a-fA-F]{24}):(\d+)$/);
  if (!match) return null;

  return {
    dockId: match[1],
    keywordIndex: Number(match[2]),
  };
}

function getChoiceName(keyword, dock) {
  return Array.from(`⚓ ${keyword} [${dock.name}]`).slice(0, 100).join("");
}

async function getChoices(interaction, focusedValue = "") {
  if (!interaction.guildId || !interaction.channelId) return [];

  const dockFollows = await interaction.client.modules.dockRelay.getWritableDockFollows(
    interaction.client,
    interaction.channelId,
    interaction.guildId,
  );
  const dockChoices = await Promise.all(
    dockFollows.map(async (sendingFollower) => ({
      sendingFollower,
      dock: await interaction.client.modules.db.getDock(sendingFollower.dockId),
    })),
  );
  const search = focusedValue.toLowerCase();

  return dockChoices
    .filter(({ dock, sendingFollower }) =>
      dock &&
      canTrigger(interaction.client, dock, interaction.guildId, sendingFollower) &&
      hasHostRole(interaction.member, sendingFollower.hostRoleIds)
    )
    .flatMap(({ dock }) =>
      (dock.keywords ?? []).map((keyword, index) => ({
        name: getChoiceName(keyword, dock),
        value: `${DOCK_ROLE_PREFIX}${dock._id.toString()}:${index}`,
      })),
    )
    .filter((choice) => choice.name.toLowerCase().includes(search));
}

async function resolveChoice(interaction, value) {
  const choice = parseChoice(value);
  if (!choice) return null;

  const dockFollows = await interaction.client.modules.dockRelay.getWritableDockFollows(
    interaction.client,
    interaction.channelId,
    interaction.guildId,
  );
  const sendingFollower = dockFollows.find(
    (follower) => follower.dockId.toString() === choice.dockId,
  );
  const dock = sendingFollower
    ? await interaction.client.modules.db.getDock(choice.dockId)
    : null;
  const keyword = dock?.keywords?.[choice.keywordIndex];

  if (!dock || !sendingFollower || !keyword) {
    return { error: "That Dock keyword is no longer available in this channel." };
  }

  if (!canTrigger(interaction.client, dock, interaction.guildId, sendingFollower)) {
    return {
      error: "This server can send to that Dock, but it cannot trigger Dock pings yet.",
    };
  }

  const hostRoleIds = sendingFollower.hostRoleIds ?? [];
  if (!hasHostRole(interaction.member, hostRoleIds)) {
    return {
      error: `You don't have permission to ping this Dock. You need atleast one of the following roles: ${hostRoleIds.map((roleId) => `<@&${roleId}>`).join(", ")}`,
    };
  }

  return { dock, sendingFollower, keyword };
}

function getRoleIds(client, entries) {
  return client.modules.uniqueItems(
    entries
      .flatMap(({ sendingFollower, keyword }) => sendingFollower.keywordPings?.[keyword] ?? [])
      .filter(Boolean),
  );
}

function shouldPingOwnServer(entries) {
  return entries.some(({ sendingFollower }) => sendingFollower.pingOwnServer !== false);
}

function remember(client, messageId, entries) {
  if (!client.dockPingMetadata) {
    client.dockPingMetadata = new Map();
  }

  const keywordsByDockId = {};
  for (const { dock, keyword } of entries) {
    const dockId = dock._id.toString();
    keywordsByDockId[dockId] = client.modules.uniqueItems([
      ...(keywordsByDockId[dockId] ?? []),
      keyword,
    ]);
  }

  client.dockPingMetadata.set(messageId, { keywordsByDockId });
  setTimeout(() => {
    client.dockPingMetadata.delete(messageId);
  }, PING_METADATA_TTL_MS);
}

module.exports = {
  findMatchingKeyword,
  getChoices,
  getRoleIds,
  hasHostRole,
  remember,
  resolveChoice,
  shouldPingOwnServer,
  canTrigger,
};
