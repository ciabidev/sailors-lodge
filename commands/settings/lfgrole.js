const { MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("lfgrole")
    .setDescription("set the role that gets pinged when /party lfg is used.")
    .addRoleOption((option) =>
      option.setName("role").setDescription("The LFG role to use.").setRequired(true),
    ),
  async execute(interaction) {
    const guildId = interaction.guildId;
    const settings = await interaction.client.modules.db.getSettings(guildId);
    const lfgRole = interaction.options.getRole("role");

    settings.lfgRoleId = lfgRole.id;
    await interaction.client.modules.db.setSettings(guildId, settings);
    return interaction.reply({
      content: `LFG role set to ${lfgRole}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
