const {
  ActionRowBuilder,
  SectionBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require("discord.js");

module.exports = async function getDockDisplay(
  container,
  dock,
  buttons,
  client,
  viewingGuildId,
) {
  const {
    name,
    description,
    guildName,
    channelIds,
    guildId: publisherGuildId,
    guildIconURL,
    defaultLevel,
    keywords,
  } = dock;

  const dockName = name ?? "Untitled Dock";
  const channels = await Promise.all(
    (channelIds ?? []).map((channelId) =>
      client.channels.fetch(channelId).catch(() => null),
    ),
  );
  const channelNames = channels
    .map((channel, index) => `#${channel?.name ?? channelIds[index]}`)
    .join(", ");
  const dockPublisher = guildName ?? publisherGuildId ?? "Unknown publisher";
  const follower = viewingGuildId
    ? await client.modules.db.getDockFollower(dock._id, viewingGuildId)
    : null;
  const keywordPings = follower?.keywordPings ?? {};
  const pingKeywords = (keywords ?? []).map((keyword) => {
    const roleIds = Array.isArray(keywordPings?.[keyword]) ? keywordPings[keyword] : [];
    const roles = roleIds.map((roleId) => `<@&${roleId}>`).join(" ");
    return `[**${client.modules.escapeMarkdown(keyword)}**${roles ? ` -> ${roles}` : ""}]`;
  });

  const truncatedDescription =
    description?.length > 300 ? description.slice(0, 300) + "..." : description;
  const displayedDescription = viewingGuildId ? "" : truncatedDescription;
  
  const actionButtons = Array.isArray(buttons) ? buttons.filter(Boolean) : [buttons].filter(Boolean);

  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${client.modules.escapeMarkdown(dockName)}${displayedDescription ? `\n${displayedDescription}` : ""}`,
    ),
  );

  if (guildIconURL) {
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(guildIconURL).setDescription(dockPublisher),
    );
  } else if (actionButtons.length === 1) {
    section.setButtonAccessory(actionButtons[0]);
  }

  container.addSectionComponents(section);

  container.addTextDisplayComponents((t) =>
    t.setContent(
      `**Publisher:** ${client.modules.escapeMarkdown(dockPublisher)}\n**Channel(s):** ${client.modules.escapeMarkdown(channelNames || "Unknown channel")}\n**Default Level:** ${client.modules.dockLevels.get(defaultLevel).label}\n-# **Ping Keywords:** ${pingKeywords.join(" | ") || "None"}`,
    ),
  );

  if (guildIconURL && actionButtons.length > 0) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(actionButtons));
  } else if (!guildIconURL && actionButtons.length > 1) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(actionButtons));
  }

  container.addSeparatorComponents((s) =>
    s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
  );

  return container;
};
