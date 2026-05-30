const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  MessageFlags,
  SlashCommandSubcommandBuilder,
} = require("discord.js");

const browsePages = new Collection();


module.exports = {
  browsePages,

  data: new SlashCommandSubcommandBuilder()
    .setName("browse")
    .setDescription("Browse available party feeds.")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search feeds by name, server, or channel."),
    ),

  async execute(interaction) {

    async function getSourceLabels(source) {
      const guild = source.guildId
        ? await interaction.client.guilds.fetch(source.guildId).catch(() => null)
        : null;

      const channelIds = source.channelIds ?? [];
      const channels = await Promise.all(
        channelIds.map((channelId) =>
          interaction.client.channels.fetch(channelId).catch(() => null),
        ),
      );
      const channelNames = channels.map((channel, index) => {
        if (channel?.name) return `#${channel.name}`;
        return `#${channelIds[index]}`;
      });

      return {
        ...source,
        guildName: guild?.name ?? source.guildId ?? "Unknown server",
        channelIds,
        channelNames,
        guildIconURL: guild?.iconURL({ extension: "png", size: 64 }),
      };
    }

    const db = interaction.client.modules.db;
    const search = interaction.options.getString("search")?.toLowerCase();

    let feeds = await db.getFeedSources();
    feeds = await Promise.all(feeds.map((feed) => getSourceLabels(feed)));

    if (search) {
      feeds = feeds.filter((feed) =>
        [feed.name, feed.description, feed.guildName, ...(feed.channelNames ?? [])]
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
