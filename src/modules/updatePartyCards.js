const { TextDisplayBuilder } = require("discord.js");
module.exports = async function updatePartyCards(interaction, party) {
  for (const card of party.cards) {
    try {
      const channel = await interaction.client.channels.fetch(card.channelId);
      const message = await channel.messages.fetch(card.messageId);
      
      if (!message || typeof message.edit !== "function") continue; // skip invalid

      if (party.deleted) {
        await message.edit({
          components: [new TextDisplayBuilder().setContent("This party was deleted")],
        });
        continue;
      }

      await message.edit({
        components: await interaction.client.modules.renderPartyCard(party, interaction),
      });
    } catch (err) {
      console.error(err);
    }
  }
};
