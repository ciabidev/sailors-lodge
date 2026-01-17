const { TextDisplayBuilder } = require("discord.js");

module.exports = async function updatePartyCards(interaction, party) {
  if (!party?.cards?.length) return;

  const components = await interaction.client.modules.renderPartyCard(party, interaction);

  const BATCH_SIZE = 10;

  // Caches to avoid repeated fetches
  const userCache = new Map(); // userId -> User
  const channelCache = new Map(); // channelId -> TextChannel or DMChannel

  for (let i = 0; i < party.cards.length; i += BATCH_SIZE) {
    const batch = party.cards.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (card) => {
        try {
          if (!card.userId) return;

          let message;

          // DM cards
          if (!card.guildId) {
            let user = userCache.get(card.userId);
            if (!user) {
              user = await interaction.client.users.fetch(card.userId).catch(() => null);
              if (!user) return;
              userCache.set(card.userId, user);
            }

            let channel = channelCache.get(card.userId);
            if (!channel) {
              channel = user.dmChannel ?? (await user.createDM());
              channelCache.set(card.userId, channel);
            }

            message = await channel.messages.fetch(card.messageId).catch(() => null);
          }
          // Server cards
          else {
            let channel = channelCache.get(card.channelId);
            if (!channel) {
              channel = await interaction.client.channels.fetch(card.channelId).catch(() => null);
              if (!channel) return;
              channelCache.set(card.channelId, channel);
            }

            message = await channel.messages.fetch(card.messageId).catch(() => null);
          }

          if (!message?.edit) return;

          // If user is no longer in the party
          const isMember = party.members.some((m) => m.id === card.userId);
          if (!isMember) {
            const textCard = new TextDisplayBuilder().setContent(
              `You left the party "${party.name}".`,
            );
            await message.edit({ components: [textCard] });
            await interaction.client.modules.db.removePartyCardMessage(card.messageId);
            return;
          }

          // Otherwise, update normally
          await message.edit({ components });
        } catch (err) {
          console.error(
            `${card.userId} Failed to update party card ${card.messageId}: ${err.message}`,
          );
        }
      }),
    );
  }
};
