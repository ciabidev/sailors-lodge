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
    .setDescription("Browse available Docks.")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search Docks by name, publisher, or channel."),
    ),

  async execute(interaction) {

    async function getDockLabels(dock) {
      const guild = dock.guildId
        ? await interaction.client.guilds.fetch(dock.guildId).catch(() => null)
        : null;

      const channelIds = dock.channelIds ?? [];
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
        ...dock,
        guildName: guild?.name ?? dock.guildId ?? "Unknown publisher",
        channelIds,
        channelNames,
        guildIconURL: guild?.iconURL({ extension: "png", size: 64 }),
      };
    }

    const db = interaction.client.modules.db;
    const search = interaction.options.getString("search")?.toLowerCase();

    let docks = await db.getDocks();
    docks = await Promise.all(docks.map((dock) => getDockLabels(dock)));

    if (search) {
      docks = docks.filter((dock) =>
        [dock.name, dock.description, dock.guildName, ...(dock.channelNames ?? [])]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search)),
      );
    }

    if (!docks.length) {
      return interaction.reply({
        content: search ? "No Docks matched that search." : "no Docks are published yet.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const pages = interaction.client.modules.chunkArray(docks, 3);
    const pageIndex = 0;
    const pageSelector = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("docks-prev")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pages.length <= 1),
      new ButtonBuilder()
        .setCustomId("docks-next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pages.length <= 1),
    );

    await interaction.reply({
      components: [
        interaction.client.modules.dockBrowsePage({ pages, pageIndex, client: interaction.client }),
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
