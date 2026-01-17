const {
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");

module.exports = async function editParty(interaction, party) {
  if (!party) {
    return interaction.reply({
      content: "This party does not exist.",
      flags: MessageFlags.Ephemeral,
    });
  }

  let currentParty = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
  if (!currentParty) {
    return interaction.reply({
      content: "You are not in a party.",
      flags: [MessageFlags.Ephemeral],
    });
  }
  if (interaction.user.id !== party.host.id) {
    return interaction.reply({
      content: "Only the party leader can edit.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  await interaction.client.modules.partyConfigModal(interaction, {
    name: party.name,
    description: party.description || "",
    limit: party.memberLimit || 10,
    visibility: party.visibility || "public",
  }, customId = `party-modal:${party._id}`);

  return
};
