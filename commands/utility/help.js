const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const devMode = process.env.DEV_MODE === 'true';
const devClientId = process.env.DEV_CLIENT_ID;
const productClientId = process.env.PRODUCTION_CLIENT_ID;
const clientId = devMode ? devClientId : productClientId;
module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("How to use this bot"),
  async execute(interaction) {
    await interaction.reply({
      content: `Click Learn More to see all commands! \n[Add this bot](https://discord.com/oauth2/authorize?client_id=${clientId})\nIt's also highly recommended you join the official Vetex server to see other people's mentions: <https://discord.gg/vetex>`,
      flags: MessageFlags.Ephemeral,
    });
  },
};