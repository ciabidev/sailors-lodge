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
// leave the current party you're in
async function leaveParty(interaction, party) {

  const db = interaction.client.modules.db;
  
  if (!party) {
    await interaction.reply({
      content: "This party no longer exists.",
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const isMember = party.members.some(m => m.id === userId);

  if (!isMember) {
    await interaction.reply({
      content: "You are not a member of this party.",
      ephemeral: true,
    });
    return;
  }

  // notify before mutation if required by your design
  await interaction.client.modules.sendPartyNotification(
    interaction,
    "leave",
    party,
    { user: interaction.user }
  );

  await db.removeMembersFromParty(party._id, userId, interaction);

  party = await db.getParty(party._id);
  if (!party) return;

  let feedback = "You have left the party.";

  if (party.host.id === userId) {
    if (party.members.length === 0) {
      await db.deleteParty(party._id, interaction);
      await interaction.reply({
        content: "You left the party. The party has been disbanded.",
        ephemeral: true,
      });
      return;
    }

    const newHost = party.members[0];
    await db.updateParty(party._id, {
      $set: { host: newHost },
    }, interaction);

    await interaction.client.modules.sendPartyNotification(
      interaction,
      "",
      party,
      { extra: `${newHost.username} is now the party leader.` }
    );

    feedback = `You have left the party. The new party leader is ${newHost.username}.`;
  }

  await interaction.reply({
    content: feedback,
    ephemeral: true,
  });

  await interaction.client.modules.updatePartyCards(interaction, party);
}


module.exports = leaveParty;


  