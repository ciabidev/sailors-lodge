const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  SectionBuilder,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = function renderBrowsePage({ pages, pageIndex, client }) {
  const page = pages[pageIndex] ?? [];

  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(`## Browse Feeds (Page ${pageIndex + 1}/${pages.length})`),
  );

  for (const feed of page) {
    const { title, name, description, channelName, guildName, channelId, guildId, _id } = feed;
    const feedTitle = title ?? name ?? "Untitled Feed";
    const sourceChannel = channelName ?? (channelId ? `#${channelId}` : "Unknown channel");
    const sourceServer = guildName ?? guildId ?? "Unknown server";
    const sourceLabel = `${sourceChannel} - ${sourceServer}`;

    const subscribeButton = new ButtonBuilder()
      .setCustomId(`feed-subscribe:${_id}`)
      .setLabel("Subscribe")
      .setStyle(ButtonStyle.Success);

    container.addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(subscribeButton)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### ${client.modules.escapeMarkdown(feedTitle)}`),
        ),
    );

    container.addTextDisplayComponents((t) =>
      t.setContent(`**${client.modules.escapeMarkdown(sourceLabel)}**`),
    );

    if (description?.length) {
      container.addTextDisplayComponents((t) =>
        t.setContent(description.length > 100 ? description.slice(0, 100) + "..." : description),
      );
    }

    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  return container;
};
