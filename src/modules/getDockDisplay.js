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
  context = {},
) {
  const { guildId: viewingGuildId, mode } = context;
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
  const follower = viewingGuildId
    ? await client.modules.db.getDockFollower(dock._id, viewingGuildId)
    : null;
  const channels = mode
    ? []
    : await Promise.all(
        (channelIds ?? []).map((channelId) =>
          client.channels.fetch(channelId).catch(() => null),
        ),
      );
  const channelNames = channels
    .map((channel, index) => `#${channel?.name ?? channelIds[index]}`)
    .join(", ");
  const dockPublisher = guildName ?? publisherGuildId ?? "Unknown publisher";
  const receivingChannelIds = (follower?.channelIds ?? [follower?.channelId]).filter(Boolean);
  const displayedChannelIds = mode === "following" ? receivingChannelIds : channelIds ?? [];
  const channelLabel =
    mode === "following"
      ? "🔗 Receiving Channels"
      : mode === "published"
        ? "🔗 Publishing Channels"
        : "🔗 Channels";
  const displayedChannels =
    mode
      ? displayedChannelIds.map((channelId) => `<#${channelId}>`).join(", ")
      : client.modules.escapeMarkdown(channelNames);
  const keywordPings = follower?.keywordPings ?? {};
  const visibleKeywords = (keywords ?? []).slice(0, 5);
  const hiddenKeywordCount = Math.max((keywords ?? []).length - visibleKeywords.length, 0);
  const pingKeywords = visibleKeywords.map((keyword) => {
    const roleIds = Array.isArray(keywordPings?.[keyword]) ? keywordPings[keyword] : [];
    const roles = roleIds.map((roleId) => `<@&${roleId}>`).join(" ");
    return `- **${client.modules.escapeMarkdown(keyword)}** → ${roles || "*No role*"}`;
  });
  const browseKeywords = visibleKeywords
    .map((keyword) => client.modules.escapeMarkdown(keyword))
    .join(" · ");

  const truncatedDescription =
    description?.length > 300 ? description.slice(0, 300) + "..." : description;
  const displayedDescription = mode ? "" : truncatedDescription;
  
  const actionButtons = Array.isArray(buttons) ? buttons.filter(Boolean) : [buttons].filter(Boolean);
  const followerCount = await client.modules.db.countDockFollowers(dock._id, publisherGuildId);
  const summary = [];
  if (mode !== "published") summary.push(`**Server:** ${client.modules.escapeMarkdown(dockPublisher)}`);
  summary.push(`👥 **${followerCount} ${followerCount === 1 ? "Follower" : "Followers"}**`);
  if (mode === "following" && follower) {
    summary.push(`**Level:** ${client.modules.dockLevels.get(follower.level).label}`);
  }
  const headerContent = `### ${client.modules.escapeMarkdown(dockName)}\n-# ${summary.join(" • ")}${displayedDescription ? `\n\n${displayedDescription}` : ""}`;
  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(headerContent),
  );

  if (guildIconURL) {
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(guildIconURL).setDescription(dockPublisher),
    );
    container.addSectionComponents(section);
  } else if (actionButtons.length === 1) {
    section.setButtonAccessory(actionButtons[0]);
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerContent));
  }

  container.addTextDisplayComponents((t) =>
    t.setContent(
      mode
        ? `**${channelLabel}:** ${displayedChannels || "Unknown channel"}\n🛡️ **Default Level:** ${client.modules.dockLevels.get(defaultLevel).label}\n🔔 **Ping Keywords**\n${pingKeywords.join("\n") || "- *None*"}${hiddenKeywordCount ? `\n- *+${hiddenKeywordCount} more*` : ""}`
        : `🔗 **Channels:** ${client.modules.escapeMarkdown(channelNames || "Unknown channel")}\n🛡️ **Default Level:** ${client.modules.dockLevels.get(defaultLevel).label}\n🔑 **Keywords:** ${browseKeywords || "None"}${hiddenKeywordCount ? ` · +${hiddenKeywordCount} more` : ""}`,
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
