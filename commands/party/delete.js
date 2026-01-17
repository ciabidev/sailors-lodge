const { SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("delete")
    .setDescription("Delete your party"),
    
    async execute(interaction) {
            const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id); 

      await interaction.client.modules.deleteParty(interaction, party);
    },
};