async function getDockWebhook(client, channel, dockFollower) {
  const savedWebhook = await client.modules.db.getDockWebhook(dockFollower.guildId);
  if (savedWebhook?.webhookId) {
    const webhook = await client
      .fetchWebhook(savedWebhook.webhookId, savedWebhook.webhookToken)
      .catch(() => null);
    if (webhook?.channelId === channel.id) return webhook;
  }

  const webhook = await channel.createWebhook({
    name: "Sailors Lodge Dock Webhook",
    avatar: client.user.displayAvatarURL(),
  });

  await client.modules.db.setDockWebhook(
    dockFollower.guildId,
    dockFollower.guildName,
    webhook.id,
    webhook.token,
  );

  return webhook;
}

async function relayMessage(message) {
  const sendingFollower = await message.client.modules.db.getDockFollowerByChannelId(
    message.channel.id,
  );

  const dock = await message.client.modules.db.getDock(sendingFollower?.dockId);
  if (!dock) return;

  const receivingFollowers = (await message.client.modules.db.getDockFollowers(dock._id))
    .map((dockFollower) => ({
      ...dockFollower,
      channelIds: (dockFollower.channelIds ?? [dockFollower.channelId]).filter(
        (channelId) => channelId && channelId !== message.channel.id,
      ),
    }))
    .filter((dockFollower) => dockFollower.channelIds.length > 0);
  if (receivingFollowers.length === 0) return;

  await message.client.modules.db.indexDockMessage({
    dockId: dock._id,
    rootGuildId: message.guildId,
    rootChannelId: message.channel.id,
    rootMessageId: message.id,
    deliveries: [],
  });

  if (dock.publishMode === "keywords") {
    // get the keywords of the dock
    // get dockKeywords is not a function.
    const keywords = dock.keywords;
    // check if the message contains any of the keywords
    if (!keywords.some((keyword) => message.content?.includes(keyword)) || !message.content) return;
  }
  
  for (const receivingFollower of receivingFollowers) {
    for (const channelId of receivingFollower.channelIds) {
      const channel = await message.client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      const webhook = await getDockWebhook(message.client, channel, receivingFollower);
      const username = `${message.author.username} [${dock.name}] [${sendingFollower.guildName}]`;
      const formattedUsername =
        Array.from(username).length > 80
          ? Array.from(username).slice(0, 76).join("") + "..."
          : username;
      
      const messagePayload = {
        username: formattedUsername,
        avatarURL: message.author.displayAvatarURL(),
        content: message.content || null,
        embeds: message.embeds || [],
        files: message.attachments.map((attachment) => attachment.url) || [],
        allowedMentions: { users: [message.author.id] },
      };
      if (dock.publishMode === "keywords") {
        // get the ping role for this server if it exists
        const pingRoles = receivingFollower.pingRoleIds ?? [];
        if (pingRoles.length > 0) {
          const pingRole = await channel.guild.roles.fetch(pingRoles[0]).catch(() => null);
          if (pingRole) {
            messagePayload.allowedMentions.roles = [pingRole.id];
          }
          messagePayload.content = `${pingRoles.map((roleId) => `<@&${roleId}>`).join(" ")} ${message.content}`;
        }
      }
      const relayedMessage = await webhook.send(messagePayload);

      await message.client.modules.db.addDockMessageDeliveries(message.channel.id, message.id, [
        {
          guildId: receivingFollower.guildId,
          guildName: receivingFollower.guildName,
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

  const followers = await client.modules.db.getDockFollowers(dock._id);
  if (followers.length === 0) return;

  for (const follower of followers) {
    for (const channelId of follower.channelIds ?? []) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      const webhook = await getDockWebhook(client, channel, follower);
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
