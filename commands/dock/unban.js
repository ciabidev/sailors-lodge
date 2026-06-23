const {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("unban")
    .setDescription("Allow a banned server to follow this server's Docks again.")
    .addStringOption((option) =>
      option
        .setName("follower")
        .setDescription("The server to unban.")
        .setAutocomplete(true)
        .setRequired(true),
    ),

  async autocomplete(interaction) {
    return interaction.client.modules.dockModerationAutocomplete.followers(interaction, true);
  },

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Dock server bans can only be managed from a Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "You don't have permission to unban servers from Docks (`Manage Channels`).",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.client.modules.dockBans.unbanFollower(
      interaction,
      interaction.options.getString("follower", true),
    );
  },
};
