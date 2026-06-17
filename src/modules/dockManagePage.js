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

module.exports = function dockManagePage({ pages, pageIndex, mode, guildId, client }) {
  const page = pages[pageIndex] ?? [];
  const title = mode === "published" ? "Manage Published Docks" : "Manage Followed Docks";
  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(`## ${title} (Page ${pageIndex + 1}/${Math.max(pages.length, 1)})`),
  );

  for (const dock of page) {
    const {
      name,
      description,
      channelNames,
      guildName,
      channelIds,
      guildId: publisherGuildId,
      guildIconURL,
      _id,
    } = dock;
    const dockName = name ?? "Untitled Dock";
    const dockChannels = channelNames?.length
      ? channelNames.join(", ")
      : (channelIds ?? []).map((id) => `#${id}`).join(", ");
    const dockPublisher = guildName ?? publisherGuildId ?? "Unknown publisher";
    let button = null;
    const fromThisGuild = publisherGuildId === guildId;

    if (fromThisGuild) {
      button = new ButtonBuilder()
        .setCustomId(`dock-edit-owner:${_id}`)
        .setLabel("Edit")
        .setStyle(ButtonStyle.Secondary);
    } else {
      button = new ButtonBuilder()
        .setCustomId(`dock-edit-follower:${_id}`)
        .setLabel("Configure")
        .setStyle(ButtonStyle.Secondary);
    }

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
      dockSection.setButtonAccessory(button);
    }

    container.addSectionComponents(dockSection);

    container.addTextDisplayComponents((t) =>
      t.setContent(`**${client.modules.escapeMarkdown(`**Publisher:** ${dockPublisher} | **Channel:** ${dockChannels}`)}**`),
    );

    if (guildIconURL) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(button),
      );
    }

    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  return container;
};
