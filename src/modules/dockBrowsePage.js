const {
  ActionRowBuilder,
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require("discord.js");

module.exports = function dockBrowsePage({ pages, pageIndex, client }) {
  const page = pages[pageIndex] ?? [];
  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(`## Browse Docks (Page ${pageIndex + 1}/${pages.length})`),
  );

  for (const dock of page) {
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
    const dockName = name ?? "Untitled Dock";
    const dockChannel = channelNames.length
      ? channelNames.join(", ")
      : channelIds.map((id) => `#${id}`).join(", ");
    const dockPublisher = guildName ?? guildId ?? "Unknown publisher";
    const dockLabel = `${dockPublisher} - ${dockChannel}`;

    const followButton = new ButtonBuilder()
      .setCustomId(`dock-follow:${_id}`)
      .setLabel(accessMode === "request" ? "Request To Follow" : "Follow")
      .setStyle(ButtonStyle.Success);

    const truncatedDescription = description?.length > 100 ? description.slice(0, 100) + "..." : description;
    const dockSection = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${client.modules.escapeMarkdown(dockName)}${truncatedDescription ? `\n${truncatedDescription}` : ""}`,
      ),
    );

    if (guildIconURL) {
      dockSection.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(guildIconURL).setDescription(dockPublisher),
      );
    } else {
      dockSection.setButtonAccessory(followButton);
    }

    container.addSectionComponents(dockSection);

    container.addTextDisplayComponents((t) =>
      t.setContent(`**${client.modules.escapeMarkdown(dockLabel)}**`),
    );

    if (guildIconURL) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(followButton),
      );
    }

    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  return container;
};
