const {
  MessageFlags,
  SlashCommandSubcommandBuilder,
  SeparatorSpacingSize,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("browse")
    .setDescription("Browse active parties")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search for a party by name").setRequired(false)
    ),

  execute: async (interaction) => {

    const response = await interaction.deferReply({ components: [], flags: [MessageFlags.Ephemeral], withResponse: true });

    const db = interaction.client.modules.db;

    // Fetch all parties
    let parties = await db.getCollection("parties").find({}).toArray();

    const searchQuery = interaction.options.getString("search");
    if (searchQuery) {
      parties = parties.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (!parties.length) {
      return interaction.editReply({
        content: "No parties found.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const pages = interaction.client.modules.chunkArray(parties, 3);
    let pageIndex = 0;

    function renderPage() {
      const page = pages[pageIndex];

      const container = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(`## Browse Parties (Page ${pageIndex + 1}/${pages.length})`)
      );

      for (const party of page) {
        const { name, description, owner, members, memberLimit, visibility, joinCode } = party;

        container.addTextDisplayComponents(
          (t) => t.setContent(`### ${name}`),
          (t) =>
            t.setContent(
              `**Owner:** <@${owner.id}> | **Members:** ${members.length}/${memberLimit}`
            ),
          (t) => t.setContent(`**Visibility:** ${visibility}`),
          (t) => t.setContent(`**Description:** ${description || "No description"}`),
          (t) => t.setContent(`**Join Code:** ${joinCode}`)
        );

        container.addSeparatorComponents((s) =>
          s.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
        );
      }

      return container;
    }

    const mainText = renderPage();

    // Navigation buttons
    const previousPageButton = new ButtonBuilder()
      .setCustomId("previous-page")
      .setLabel("Previous Page")
      .setStyle(ButtonStyle.Secondary);

    const nextPageButton = new ButtonBuilder()
      .setCustomId("next-page")
      .setLabel("Next Page")
      .setStyle(ButtonStyle.Secondary);

    const pageSelector = new ActionRowBuilder().addComponents(previousPageButton, nextPageButton);

    await interaction.editReply({
      content: "",
      components: [mainText, pageSelector],
      flags: MessageFlags.IsComponentsV2,
    });

    const collector = response.resource.message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 3_600_000, // 1 hour
    });

   collector.on("collect", async (i) => {
     if (i.customId === "next-page" || i.customId === "previous-page") {
       pageIndex++;
       if (pageIndex >= pages.length) pageIndex = 0;

       const updatedMainText = renderPage();
       await i.update({ components: [updatedMainText, pageSelector] }); // correct
     }
   });

  },
};
