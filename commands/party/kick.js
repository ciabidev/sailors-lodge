const { SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("kick")
    .setDescription("Kick member(s) from your party")
    .addStringOption((option) =>
      option
        .setName("usernames")
        .setDescription("Comma-separated Discord usernames of members to kick")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
    if (!party) {
      return interaction.editReply({
        content: "You are not in a party.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.user.id !== party.host.id) {
      return interaction.editReply({
        content: "Only the party leader can kick members.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const usernamesInput = interaction.options.getString("usernames");
    const usernames = usernamesInput.split(",").map((u) => u.trim());

    // Map usernames to member IDs in the party
    const memberIdsToKick = party.members
      .filter((m) => usernames.includes(m.username) && m.id !== party.host.id)
      .map((m) => m.id);

    if (memberIdsToKick.length === 0) {
      return interaction.editReply({
        content: "No valid members to kick were found.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Remove members
    party = await interaction.client.modules.db.removeMembersFromParty(party._id, memberIdsToKick, interaction);

    // Send notifications
    for (const memberId of memberIdsToKick) {
      const memberUser = await interaction.client.users.fetch(memberId).catch(() => null);
      if (!memberUser) continue;

      await interaction.client.modules.sendPartyNotification(interaction, "kick", party, {
        user: memberUser,
        actor: interaction.user,
      });
    }

    interaction.editReply({
      content: `Kicked ${memberIdsToKick.length} member(s).`,
      flags: MessageFlags.Ephemeral,
    });

    interaction.client.modules.updatePartyCards(interaction, party);
  },
};
