const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  MessageFlags,
  SectionBuilder,
  ComponentType,
} = require("discord.js");

module.exports = async function deleteParty(interaction, party) {
    // check if the one deleting is the host
    if (party.host.id !== interaction.user.id) {
      return interaction.reply({
        content: "Only the party leader can delete.",
        flags: MessageFlags.Ephemeral,
      });
    }


    const deleteBtn = new ButtonBuilder()
      .setCustomId("party-delete-confirm")
      .setLabel("Yes")
      .setStyle(ButtonStyle.Danger);

    const cancelBtn = new ButtonBuilder()
      .setCustomId("party-delete-cancel")
      .setLabel("No")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(deleteBtn, cancelBtn);
    
    const response = await interaction.deferReply({
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      withResponse: true,
    });

    await interaction.editReply({
      components: [ new TextDisplayBuilder().setContent(
      `Are you sure you want to delete the party "${interaction.client.modules.escapeMarkdown(party.name)}"?`
    ),
    row,],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      withResponse: true,
    });
    const message = response.resource.message;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return;
      if (i.customId === "party-delete-confirm") {
        await interaction.client.modules.db.deleteParty(party._id, interaction);
        collector.stop();
        return interaction.editReply({
          components: [new TextDisplayBuilder().setContent("Party deleted.")],  
        });
      }
      if (i.customId === "party-delete-cancel") {
        collector.stop();
        return interaction.editReply({
          components: [new TextDisplayBuilder().setContent("Cancelled.")],
        });
      }
    });
  };