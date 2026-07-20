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
  const { guildId: viewingGuildId, mode, hideSeparator } = context;
  const {
    name,
    description,
    guildName,
    channelIds,
    guildId: publisherGuildId,
    guildIconURL,
    defaultLevel,
    keywords,
    publishMode,
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
  const hostRoles = Array.isArray(follower?.hostRoleIds)
    ? follower.hostRoleIds.map((roleId) => `<@&${roleId}>`).join(" ")
    : "";
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
  const pendingFollowerCount = mode === "published"
    ? await client.modules.db.countPendingDockFollowers(dock._id, publisherGuildId)
    : 0;
  const tinyText = [];
  if (mode !== "published") tinyText.push(`**Server:** ${client.modules.escapeMarkdown(dockPublisher)}`);
  tinyText.push(`👥 **${followerCount} ${followerCount === 1 ? "Follower" : "Followers"}**`);
  if (pendingFollowerCount) tinyText.push(`🕜 **${pendingFollowerCount} Pending**`);
  if (mode === "following" && follower) {
    tinyText.push(`**Level:** ${client.modules.dockLevels.get(follower.level).label}`);
  }
  if (dock.official) tinyText.unshift("🌟 Official Dock");
  const headerContent = `### ${client.modules.escapeMarkdown(dockName)}\n-# ${tinyText.join(" • ")}${displayedDescription ? `\n\n${displayedDescription}` : ""}`;
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

  const details = [
    `**${channelLabel}:** ${displayedChannels || "Unknown channel"}`,
    `📨 **Forwarding:** ${publishMode === "all" ? "Every message will be forwarded" : "Only messages published with `!p` will be forwarded"}`,
  ];
  if (mode === "published") {
    details.push(
      `✅ **Default Level:** ${client.modules.dockLevels.get(defaultLevel).label}`,
      `🔒 **Access:** ${dock.accessMode === "request" ? "Request To Join" : "Open to all"}`,
      `🎤 **Host Roles:** ${hostRoles || "Everyone"}`,
      `🔔 **Ping Keywords**\n${pingKeywords.join("\n") || "- *None*"}${hiddenKeywordCount ? `\n- *+${hiddenKeywordCount} more*` : ""}`,
      `**Gatekeeper Role:** ${dock.gatekeeperRoleId ? `<@&${dock.gatekeeperRoleId}>` : "None"}`,
    );
  } else {
    const levelLabel = client.modules.dockLevels.get(
      mode === "following" ? follower?.level : defaultLevel,
    ).label;

    details.push(
      `✅ **${mode === "following" ? "Current" : "Default"} Level:** ${levelLabel}`,
      ...(mode === "following" ? [`🎤 **Host Roles:** ${hostRoles || "Everyone"}`] : []),
      `🔑 ${mode !== "following" ? `**Keywords:** ${browseKeywords || "None"}${hiddenKeywordCount ? ` · +${hiddenKeywordCount} more` : ""}` : `🔔 **Ping Keywords**\n${pingKeywords.join("\n") || "- *None*"}${hiddenKeywordCount ? `\n- *+${hiddenKeywordCount} more*` : ""}`}`,
    );
  }

  container.addTextDisplayComponents((text) => text.setContent(details.join("\n")));

  if (guildIconURL && actionButtons.length > 0) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(actionButtons));
  } else if (!guildIconURL && actionButtons.length > 1) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(actionButtons));
  }

  if (!hideSeparator) {
    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  return container;
};
