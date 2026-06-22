const { Events } = require("discord.js");

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    const dockMessage = await message.client.modules.db.getDockMessageFromRoot(message.channel.id, message.id);
    if (dockMessage) {
      for (const delivery of dockMessage.deliveries ?? []) {
        const savedWebhook = await message.client.modules.db.getDockWebhook(
          delivery.guildId,
          delivery.channelId,
        );
        if (!savedWebhook?.webhookId) continue;

        const webhook = await message.client
          .fetchWebhook(savedWebhook.webhookId, savedWebhook.webhookToken)
          .catch(() => null);
        if (!webhook || webhook.channelId !== delivery.channelId) continue;

        await webhook.deleteMessage(delivery.messageId, delivery.threadId);
      }
    }
  },
};
