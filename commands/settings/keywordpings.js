const { SlashCommandSubcommandBuilder, MessageFlags, PermissionsBitField } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("keywordpings")
    .setDescription("Enable or disable keyword pings.")
    .addBooleanOption((option) =>
      option
        .setName("enabled")
        .setDescription("Enable or disable keyword pings.")
        .setRequired(true),
    ),

  async execute(interaction) {
    const { guildId } = interaction;

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const keywordPingsEnabled = interaction.options.getBoolean("enabled");

    await interaction.client.modules.db.setSettings(guildId, { keywordPingsEnabled });
    return interaction.reply({
      content: `Keyword pings ${keywordPingsEnabled ? "enabled" : "disabled"}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
