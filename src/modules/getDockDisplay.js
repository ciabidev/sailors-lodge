module.exports = function getDockDisplay(dock, button, client) {
  const {
    name,
    description,
    channelNames,
    guildName,
    channelIds,
    guildId,
    guildIconURL,
    _id,
    accessMode,
  } = dock;
  const dockName = dock.name
  const dockChannels = channelNames?.length
    ? channelNames.join(", ")
    : (channelIds ?? []).map((id) => `#${id}`).join(", ");
  const dockPublisher = guildName ?? publisherGuildId ?? "Unknown publisher";
  const fromThisGuild = publisherGuildId === guildId;


  const truncatedDescription =
    description?.length > 100 ? description.slice(0, 100) + "..." : description;
  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${client.modules.escapeMarkdown(dockName)}${truncatedDescription ? `\n${truncatedDescription}` : ""}`,
    ),
  );

  if (guildIconURL) {
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(guildIconURL).setDescription(dockPublisher),
    );
  } else {
    section.setButtonAccessory(button);
  }

  container.addSectionComponents(section);

  container.addTextDisplayComponents((t) =>
    t.setContent(
      `**${client.modules.escapeMarkdown(`**Publisher:** ${dockPublisher} | **Channel:** ${dockChannels}`)}**`,
    ),
  );

  if (guildIconURL) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(button));
  }

  container.addSeparatorComponents((s) =>
    s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
  );

  return container;
}