const { SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, MessageFlags, PermissionsBitField } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("followedpings")
    .setDescription("enable or disable followed pings")
    .addBooleanOption((option) =>
      option
        .setName("enabled")
        .setDescription("enable or disable followed pings")
        .setRequired(true),
    ),

  async execute(interaction) {
    const { guildId } = interaction;
    const settings = await interaction.client.modules.db.getSettings(guildId);
    const followedPingsEnabled = interaction.options.getBoolean("enabled");

    settings.followedPingsEnabled = followedPingsEnabled;
    await interaction.client.modules.db.setSettings(guildId, settings);
    return interaction.reply({
      content: `Followed pings ${followedPingsEnabled ? "enabled" : "disabled"}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};