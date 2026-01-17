const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { devMode } = require("../../config.json");
const { devClientId } = require("../../config.json");
const { productClientId } = require("../../config.json");

const clientId = devMode ? devClientId : productClientId;
module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("How to use this bot"),
  async execute(interaction) {
    await interaction.reply({
      content: `Click Learn More to see all commands! \n[Add this bot](https://discord.com/oauth2/authorize?client_id=${clientId})`,
    });
  },
};