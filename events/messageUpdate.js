const { Events } = require("discord.js");

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, message) {
    if (message.partial) {
      message = await message.fetch().catch(() => null);
      if (!message) return;
    }

    const dockMessage = await message.client.modules.db.getDockMessageFromRoot(
      message.channel.id,
      message.id,
    );
    if (!dockMessage) return;

    for (const delivery of dockMessage.deliveries ?? []) {
      const savedWebhook = await message.client.modules.db.getDockWebhook(delivery.guildId);
      if (!savedWebhook?.webhookId) continue;

      const webhook = await message.client
        .fetchWebhook(savedWebhook.webhookId, savedWebhook.webhookToken)
        .catch(() => null);
      if (!webhook || webhook.channelId !== delivery.channelId) continue;

      await webhook.editMessage(delivery.messageId, {
        content: message.content || null,
        embeds: message.embeds || [],
        attachments: message.attachments.map((attachment) => attachment.url) || [],
        allowedMentions: { users: [message.author.id] },
      });
    }
  },
};
