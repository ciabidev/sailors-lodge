async function getDockWebhook(client, dockChannel, dockServer) {
  const savedWebhook = await client.modules.db.getDockWebhook(dockServer.guildId);
  if (savedWebhook?.webhookId) {
    const webhook = await client
      .fetchWebhook(savedWebhook.webhookId, savedWebhook.webhookToken)
      .catch(() => null);
    if (webhook?.channelId === dockChannel.id) return webhook;
  }

  const webhook = await dockChannel.createWebhook({
    name: "Sailors Lodge Dock Webhook",
    avatar: client.user.displayAvatarURL(),
  });

  await client.modules.db.setDockWebhook(
    dockServer.guildId,
    dockServer.guildName,
    webhook.id,
    webhook.token,
  );

  return webhook;
}

async function relayMessage(message) {
  const activeDockServer = await message.client.modules.db.getDockServerByChannelId(
    message.channel.id,
  );

  const dock = await message.client.modules.db.getDock(activeDockServer?.dockId);
  if (!dock) return;

  const receivingDockServers = (await message.client.modules.db.getDockServers(dock._id))
    .map((dockServer) => ({
      ...dockServer,
      channelIds: (dockServer.channelIds ?? [dockServer.channelId]).filter(
        (channelId) => channelId && channelId !== message.channel.id,
      ),
    }))
    .filter((dockServer) => dockServer.channelIds.length > 0);
  if (receivingDockServers.length === 0) return;

  await message.client.modules.db.indexDockMessage({
    dockId: dock._id,
    rootGuildId: message.guildId,
    rootChannelId: message.channel.id,
    rootMessageId: message.id,
    deliveries: [],
  });

  for (const receivingDockServer of receivingDockServers) {
    for (const channelId of receivingDockServer.channelIds) {
      const dockChannel = await message.client.channels.fetch(channelId);
      const webhook = await getDockWebhook(message.client, dockChannel, receivingDockServer);
      const username = `${message.author.username} [${dock.name}] [${activeDockServer.guildName}]`;
      const formattedUsername =
        Array.from(username).length > 80
          ? Array.from(username).slice(0, 76).join("") + "..."
          : username;

      const relayedMessage = await webhook.send({
        username: formattedUsername,
        avatarURL: message.author.displayAvatarURL(),
        content: message.content || null,
        embeds: message.embeds || [],
        files: message.attachments.map((attachment) => attachment.url) || [],
        allowedMentions: { users: [message.author.id] },
      });

      await message.client.modules.db.addDockMessageDeliveries(message.channel.id, message.id, [
        {
          guildId: receivingDockServer.guildId,
          guildName: receivingDockServer.guildName,
          channelId,
          messageId: relayedMessage.id,
        },
      ]);
    }
  }
}

async function relayAlert({ client, dockId, ...payload }) {
  const dock = await client.modules.db.getDock(dockId);
  if (!dock) return;

  const servers = await client.modules.db.getDockServers(dock._id);
  if (servers.length === 0) return;

  for (const server of servers) {
    for (const channelId of server.channelIds ?? []) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      const webhook = await getDockWebhook(client, channel, server);
      await webhook.send({
        username: dock.name,
        avatarURL: client.user.displayAvatarURL(),
        ...payload,
      });
    }
  }
}

module.exports = async function dockRelay(input) {
  if (input.channel && input.author) {
    return relayMessage(input);
  }

  return relayAlert(input);
};
