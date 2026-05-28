const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  MessageFlags,
  SlashCommandSubcommandBuilder,
} = require("discord.js");

const browsePages = new Collection();

async function getSourceLabels(client, source) {
  const guild = source.guildId
    ? await client.guilds.fetch(source.guildId).catch(() => null)
    : null;

  const channel = source.channelId
    ? await client.channels.fetch(source.channelId).catch(() => null)
    : null;

  return {
    ...source,
    guildName: guild?.name ?? source.guildName ?? "Unknown server",
    channelName: channel?.name ? `#${channel.name}` : source.channelName ?? `#${source.channelId}`,
  };
}

module.exports = {
  browsePages,

  data: new SlashCommandSubcommandBuilder()
    .setName("browse")
    .setDescription("Browse available party feeds.")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search feeds by title, server, or channel."),
    ),

  async execute(interaction) {
    const db = interaction.client.modules.db;
    const search = interaction.options.getString("search")?.toLowerCase();

    let feeds = await db.getFeedSources();
    feeds = await Promise.all(feeds.map((feed) => getSourceLabels(interaction.client, feed)));

    if (search) {
      feeds = feeds.filter((feed) =>
        [feed.title, feed.name, feed.description, feed.channelName, feed.guildName]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search)),
      );
    }

    if (!feeds.length) {
      return interaction.reply({
        content: search ? "No feeds matched that search." : "No feeds are published yet.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const pages = interaction.client.modules.chunkArray(feeds, 3);
    const pageIndex = 0;
    const pageSelector = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("feeds-prev")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pages.length <= 1),
      new ButtonBuilder()
        .setCustomId("feeds-next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pages.length <= 1),
    );

    await interaction.reply({
      components: [
        interaction.client.modules.renderBrowsePage({ pages, pageIndex, client: interaction.client }),
        pageSelector,
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });

    browsePages.set(interaction.user.id, {
      pages,
      pageIndex,
    });
  },
};
