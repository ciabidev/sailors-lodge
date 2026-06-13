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

module.exports = function renderDockBrowsePage({ pages, pageIndex, client }) {
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
    const dockServer = guildName ?? guildId ?? "Unknown server";
    const dockLabel = `${dockServer} - ${dockChannel}`;

    const connectButton = new ButtonBuilder()
      .setCustomId(`dock-connect:${_id}`)
      .setLabel(accessMode === "request" ? "Request To Join" : "Connect")
      .setStyle(ButtonStyle.Success);

    const truncatedDescription = description?.length > 100 ? description.slice(0, 100) + "..." : description;
    const dockSection = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${client.modules.escapeMarkdown(dockName)}${truncatedDescription ? `\n${truncatedDescription}` : ""}`,
      ),
    );

    if (guildIconURL) {
      dockSection.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(guildIconURL).setDescription(dockServer),
      );
    } else {
      dockSection.setButtonAccessory(connectButton);
    }

    container.addSectionComponents(dockSection);

    container.addTextDisplayComponents((t) =>
      t.setContent(`**${client.modules.escapeMarkdown(dockLabel)}**`),
    );

    if (guildIconURL) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(connectButton),
      );
    }

    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  return container;
};
