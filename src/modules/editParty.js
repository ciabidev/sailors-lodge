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

let currentParty = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
if (!currentParty) {
await interaction.reply({
    content: "You are not in a party.",
    flags: [MessageFlags.Ephemeral],
});
return;
}
  if (interaction.user.id !== party.host.id) {
    return interaction.reply({
      content: "Only the party leader can edit.",
      flags: [MessageFlags.Ephemeral],
    });
  }
  // Open modal for editing
  await interaction.client.modules.partyConfigModal(interaction, {
    name: party.name,
    description: party.description || "",
    limit: party.memberLimit || 10,
    visibility: party.visibility || "public",
  });
  const editModal = await interaction.awaitModalSubmit({
    filter: (i) => i.customId === "party-modal" && i.user.id === party.host.id,
    time: 60_000,
  });

  party = await interaction.client.modules.db.updateParty(
    party._id,
    {
      $set: {
        name: editModal.fields.getTextInputValue("name"),
        description: editModal.fields.getTextInputValue("description"),
        memberLimit: parseInt(editModal.fields.getTextInputValue("limit")) || 10,
        visibility: editModal.fields.getStringSelectValues("visibility")[0],
      },
    },
    interaction
  );
  try {
  await editModal.update({
    components: await interaction.client.modules.renderPartyCard(party, interaction),
  }); // editModal is so impatient for a response lol so we have to put it before the long updateParty
  } catch (err) {
    if (err.code === 10008) { // this module was likely called by a slash command
      editModal.reply({
        content: "edited party",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
  await interaction.client.modules.updatePartyCards(interaction, party);
  return;
};
