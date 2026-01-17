const {
  MessageFlags,
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
} = require("discord.js");


const browsePages = new Collection();

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("browse")
    .setDescription("Browse active parties")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search for a party by name"),
    ),

  async execute(interaction) {
    const db = interaction.client.modules.db;

    let parties = await db.getParties({ visibility: "public" });
    const search = interaction.options.getString("search");

    if (search) {
      parties = parties.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    }

    if (!parties.length) {
      return interaction.reply({
        content: "No parties found.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const pages = interaction.client.modules.chunkArray(parties, 3);
    const pageIndex = 0;

    const pageSelector = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("parties-prev")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("parties-next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary),
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

  browsePages,
};
