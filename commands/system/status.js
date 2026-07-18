const {
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check the status and health of the bot."),

  async execute(interaction) {
    
    const SITE_URL = process.env.NEXT_PUBLIC_APP_URL;
    await interaction.reply({
      content: `${SITE_URL}/status`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
