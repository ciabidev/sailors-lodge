const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
} = require("discord.js");

function escape(client, value) {
  const text = String(value ?? "");
  return client.modules.escapeMarkdown
    ? client.modules.escapeMarkdown(text)
    : text.replace(/([\\`*_{}\[\]()<>#+\-.!|])/g, "\\$1");
}

async function relay(client, dockId, components, options = {}) {
  if (!client.modules.dockRelay?.relayAlert) return;

  await client.modules.dockRelay.relayAlert({
    client,
    dockId,
    components,
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: options.allowedMentions ?? { parse: [] },
    ...(options.guildIds ? { guildIds: options.guildIds } : {}),
  }).catch((error) => console.error("[dashboard] Failed to relay Dock notice:", error));
}

function textComponent(content) {
  return new ContainerBuilder().addTextDisplayComponents((text) => text.setContent(content));
}

async function relayText(client, dockId, content, options) {
  return relay(client, dockId, [textComponent(content)], options);
}

async function relayFollowRequest(client, dock, follower, options = {}) {
  const gatekeeper = dock.gatekeeperRoleId ? `\n-# Gatekeepers: <@&${dock.gatekeeperRoleId}>` : "";
  const details = textComponent(
    `**${escape(client, follower.guildName)}** wants to follow **${escape(client, dock.name)}**.\n**Requested from:** Dashboard\n**Receiving channel:** <#${follower.channelId}>${gatekeeper}`,
  );
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dock-follow-request:accept:${dock._id}:${follower.guildId}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`dock-follow-request:deny:${dock._id}:${follower.guildId}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger),
  );

  return relay(client, dock._id, [details, actions], {
    guildIds: options.guildIds,
    allowedMentions: dock.gatekeeperRoleId
      ? { parse: [], roles: [dock.gatekeeperRoleId] }
      : { parse: [] },
  });
}

module.exports = { escape, relayFollowRequest, relayText };
