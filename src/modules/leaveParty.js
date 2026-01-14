const {
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");

// leave the current party you're in
async function leaveParty(interaction, partyId) {
  let party = await interaction.client.modules.db.getParty(partyId);

  async function dynamicReply(interaction, message) {
    await interaction.deferReply();
    if (interaction.replied || interaction.deferred) {
      // Interaction already handled: update instead
      return interaction
        .editReply({
          components: [new TextDisplayBuilder().setContent(message)],
          flags: [MessageFlags.IsComponentsV2]
        })
        .catch(() => {});
    } else {
      return interaction.reply({
        components: [new TextDisplayBuilder().setContent(message)],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      });
    }
  }

  if (party.members.some((m) => m.id === interaction.user.id)) {
      await interaction.client.modules.sendPartyNotification(interaction, "leave", party, {
        user: interaction.user,
      });
    await interaction.client.modules.db.removeMemberFromParty(party._id, interaction.user.id, interaction);
  } else {
    return dynamicReply(interaction, "You are not a member of this party.");
  }
  party = await interaction.client.modules.db.getParty(party._id);

  if (interaction.user.id === party.host.id && party.members.length > 1) {
    await dynamicReply(interaction, `You have left the party. The new party leader is ${party.members[0].username}.`);
  } else {
    await dynamicReply(interaction, "You have left the party.");
  }
  
  if (party.members.length === 0) {
    await interaction.client.modules.db.deleteParty(party._id, interaction);
    return;
  }

  // make the top member the new party leader if it was the host that left
  if (interaction.user.id === party.host.id && party.members.length > 1) {
    party.host = party.members[0];
    await interaction.client.modules.db.updateParty(party._id, { $set: { host: party.host } }, interaction);
    await interaction.client.modules.sendPartyNotification(interaction, "", party, {
      extra: party.host.username + " is now the party leader.",
    });
  }

}

module.exports = leaveParty;


  