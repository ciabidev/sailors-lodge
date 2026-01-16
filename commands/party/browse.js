const {
  MessageFlags,
  SlashCommandSubcommandBuilder,
  SeparatorSpacingSize,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SectionBuilder,
  TextDisplayBuilder,
} = require("discord.js");

const browsePages = new Map(); // Keeps per-user page state

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("browse")
    .setDescription("Browse active parties")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search for a party by name").setRequired(false)
    ),

  execute: async (interaction) => {
    const db = interaction.client.modules.db;

    // Fetch parties
    let parties = await db.getParties();
    const searchQuery = interaction.options.getString("search");
    if (searchQuery) {
      parties = parties.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (!parties.length) {
      await interaction.reply({
        content: "No parties found. Create the first one with `/party create`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pages = interaction.client.modules.chunkArray(parties, 3);
    const pageIndex = 0;

    function renderPage(pageIdx) {
      const page = pages[pageIdx];
      const container = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(`## Browse Parties (Page ${pageIdx + 1}/${pages.length})`)
      );

      for (const party of page) {
        const { name, description, host, members, memberLimit, joinCode, _id } = party;

        const joinButton = new ButtonBuilder()
          .setCustomId(`party-join:${_id}`)
          .setLabel("Join")
          .setStyle(ButtonStyle.Success);

        container.addSectionComponents(
          new SectionBuilder()
            .setButtonAccessory(joinButton)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `### ${interaction.client.modules.escapeMarkdown(name)}`
              )
            )
        );

        container.addTextDisplayComponents(
          (t) =>
            t.setContent(`**Host:** <@${host.id}> | **Members:** ${members.length}/${memberLimit}`),
          (t) =>
            t.setContent(
              `**Description:** ${
                (description || "No description").length > 100
                  ? description.slice(0, 100) + "..."
                  : description
              }`
            ),
          (t) => t.setContent(`**Join Code:** ${joinCode}`)
        );

        container.addSeparatorComponents((s) =>
          s.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
        );
      }

      return container;
    }

    const previousPageButton = new ButtonBuilder()
      .setCustomId("parties-previous-page")
      .setLabel("Previous Page")
      .setStyle(ButtonStyle.Secondary);

    const nextPageButton = new ButtonBuilder()
      .setCustomId("parties-next-page")
      .setLabel("Next Page")
      .setStyle(ButtonStyle.Secondary);

    const pageSelector = new ActionRowBuilder().addComponents(previousPageButton, nextPageButton);

    // Send initial reply
    await interaction.reply({
      content: "",
      components: [renderPage(pageIndex), pageSelector],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });

    // Save state for this user
    browsePages.set(interaction.user.id, {
      pages,
      pageIndex,
      pageSelector,
    });
  },

  browsePages, // Export the Map so InteractionCreate can access it
};
