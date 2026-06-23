const {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("unban")
    .setDescription("Allow a banned server to follow a Dock again.")
    .addStringOption((option) =>
      option
        .setName("dock")
        .setDescription("The Dock to manage.")
        .setAutocomplete(true)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("follower")
        .setDescription("The follower server to unban.")
        .setAutocomplete(true)
        .setRequired(true),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "dock") {
      return interaction.client.modules.dockModerationAutocomplete.docks(interaction);
    }
    return interaction.client.modules.dockModerationAutocomplete.followers(interaction, true);
  },

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Dock followers can only be unbanned from a Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "You don't have permission to unban Dock followers (`Manage Channels`).",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.client.modules.dockBans.unbanFollower(
      interaction,
      interaction.options.getString("dock", true),
      interaction.options.getString("follower", true),
    );
  },
};
