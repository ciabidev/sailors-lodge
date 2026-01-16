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
      .setCustomId(`party-delete-confirm:${party._id}`)
      .setLabel("Yes")
      .setStyle(ButtonStyle.Danger);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`party-delete-cancel:${party._id}`)
      .setLabel("No")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(deleteBtn, cancelBtn);
    
    await interaction.reply({
      components: [ new TextDisplayBuilder().setContent(
      `Are you sure you want to delete the party "${interaction.client.modules.escapeMarkdown(party.name)}"?`
    ),
    row,],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      withResponse: true,
    });
  
  };