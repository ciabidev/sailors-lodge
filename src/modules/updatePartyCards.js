const { TextDisplayBuilder } = require("discord.js");
module.exports = async function updatePartyCards(interaction, party) {
    if (!party) return;
    if (!party.cards) return;

  for (const card of party.cards) {
    try {
      let message;
      if (!card.userId) continue;
      if (!card.guildId) {
        console.log(`DM ${card.userId}`);
        const user = await interaction.client.users.fetch(card.userId);
        const channel = await user.createDM();
        message = await channel.messages.fetch(card.messageId);
      } else {
        const channel = await interaction.client.channels.fetch(card.channelId);
        message = await channel.messages.fetch(card.messageId);
      }
   
      
      if (!message || typeof message.edit !== "function") continue; // skip invalid

      await message.edit({ 
        components: await interaction.client.modules.renderPartyCard(party, interaction),
      });
    } catch (err) {
      console.error(`${card.userId} Failed to update party card ${card}: ${err.message}`);
    }
  }
};
