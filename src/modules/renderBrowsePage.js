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

module.exports = function renderBrowsePage({ pages, pageIndex, client }) {
  const page = pages[pageIndex] ?? [];
  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(`## Browse Feeds (Page ${pageIndex + 1}/${pages.length})`),
  );

  for (const feed of page) {
    const {
      name,
      description,
      channelNames,
      guildName,
      channelIds,
      guildId,
      guildIconURL,
      _id,
      subscriptionMode,
    } = feed;
    const feedName = name ?? "Untitled Feed";
    const sourceChannel = channelNames.length
      ? channelNames.join(", ")
      : channelIds.map((id) => `#${id}`).join(", ");
    const sourceServer = guildName ?? guildId ?? "Unknown server";
    const sourceLabel = `${sourceServer} - ${sourceChannel}`;

    const subscribeButton = new ButtonBuilder() // subscribing is handled in interactionCreate
      .setCustomId(`feed-subscribe:${_id}`)
      .setLabel(subscriptionMode === "request" ? "Request To Join" : "Subscribe")
      .setStyle(ButtonStyle.Success);

    const truncatedDescription = description?.length > 100 ? description.slice(0, 100) + "..." : description;
    const feedSection = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${client.modules.escapeMarkdown(feedName)}${truncatedDescription ? `\n${truncatedDescription}` : ""}`,
      ),
    );

    if (guildIconURL) {
      feedSection.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(guildIconURL).setDescription(sourceServer),
      );
    } else {
      feedSection.setButtonAccessory(subscribeButton);
    }

    container.addSectionComponents(feedSection);

    container.addTextDisplayComponents((t) =>
      t.setContent(`**${client.modules.escapeMarkdown(sourceLabel)}**`),
    );

    if (guildIconURL) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(subscribeButton),
      );
    }

    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  return container;
};
