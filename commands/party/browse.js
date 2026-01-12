const {
  MessageFlags,
  SlashCommandSubcommandBuilder,
  SeparatorSpacingSize,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  SectionBuilder,
  TextDisplayBuilder,
} = require("discord.js");

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
    let parties = await db.getCollection("parties").find({}).toArray();
    const searchQuery = interaction.options.getString("search");
    if (searchQuery) {
      parties = parties.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (!parties.length) {
      await interaction.reply({
        content: "No parties found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
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
        const joinButton = new ButtonBuilder()
          .setCustomId(`join-party-${party.joinCode}`)
          .setLabel("Join")
          .setStyle(ButtonStyle.Success);
       
        container.addSectionComponents(
          new SectionBuilder()
            .setButtonAccessory(
              joinButton
            )
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${name}`))
        );
        container.addTextDisplayComponents(
         
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

    const previousPageButton = new ButtonBuilder()
      .setCustomId("previous-page")
      .setLabel("Previous Page")
      .setStyle(ButtonStyle.Secondary);
    const nextPageButton = new ButtonBuilder()
      .setCustomId("next-page")
      .setLabel("Next Page")
      .setStyle(ButtonStyle.Secondary);
    const pageSelector = new ActionRowBuilder().addComponents(previousPageButton, nextPageButton);

    // Reply directly (no defer)
    const response = await interaction.reply({
      content: "",
      components: [mainText, pageSelector],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      withResponse: true,
    });

    const collector = response.resource.message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 3_600_000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return;
      if (i.customId.startsWith("join-party-")) {
        const joinCode = i.customId.split("-")[2];
        console.log(joinCode);
        await interaction.client.modules.joinParty(interaction, joinCode);
        return;
      }
      if (i.customId === "previous-page") {
        pageIndex = (pageIndex - 1 + pages.length) % pages.length;
      } else if (i.customId === "next-page") {
        pageIndex = (pageIndex + 1) % pages.length;
      }

      await i.update({ components: [renderPage(), pageSelector] });
    });
  },
};
