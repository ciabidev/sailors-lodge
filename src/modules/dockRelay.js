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

const RELAYED_THREAD_MARKER = "[Relayed]"; // This marks relayed threads. Threads with this marker dont get recreated, preventing infinite thread creation loops.

// we need these functions getForwardedSnapshot, getRelayContent, getRelayEmbeds, getRelayFiles because the discord Forwarded Messages are structured differently than normal ones
function getForwardedSnapshot(message) {
  return message.messageSnapshots?.first?.() ?? null;
}

function getRelayContent(message, options = {}) {
  const snapshot = getForwardedSnapshot(message);
  const content = options.content || message.content || snapshot?.content || null;

  if (!snapshot) return content;
  // append a > to the beginning of the content. the quote should encapsulate the entire message

  // join the content with the newlines and append a single > to the beginning of the content
  return `> -# ***➡️ Forwarded***\n> ${content.split("\n").join("\n> ")}`;

}

function getRelayEmbeds(message) {
  const snapshot = getForwardedSnapshot(message);
  return message.embeds?.length ? message.embeds : (snapshot?.embeds ?? []);
}

function getRelayFiles(message) {
  const snapshot = getForwardedSnapshot(message);
  const attachments = message.attachments?.size ? message.attachments : snapshot?.attachments;
  return attachments?.map((attachment) => attachment.url) ?? [];
}

async function relayThread(thread) {
  if (thread.name?.startsWith(RELAYED_THREAD_MARKER)) return;

  const existingDockThread = await thread.client.modules.db.getDockThread(thread.id);
  if (existingDockThread) return;

  const sendingFollower = await thread.client.modules.db.getDockFollowForChannel(
    thread.parentId,
  );

  const dock = await thread.client.modules.db.getDock(sendingFollower?.dockId);
  if (!dock) return;

  const receivingFollowers = (await thread.client.modules.db.getDockFollowers(dock._id))
    .map((dockFollower) => ({
      ...dockFollower,
      channelIds: (dockFollower.channelIds ?? [dockFollower.channelId]).filter(
        (channelId) => channelId && channelId !== thread.parentId,
      ),
    }))
    .filter((dockFollower) => dockFollower.channelIds.length > 0);
  if (receivingFollowers.length === 0) return;

  await thread.client.modules.db.indexDockThread({
    dockId: dock._id,
    rootGuildId: thread.guildId,
    rootChannelId: thread.parentId,
    rootThreadId: thread.id,
    name: thread.name,
    deliveries: [],
  });

  const dockMessage = await thread.client.modules.db.getDockMessageFromRoot(
    thread.parentId,
    thread.id,
  );

  for (const receivingFollower of receivingFollowers) {
    for (const channelId of receivingFollower.channelIds) {
      const channel = await thread.client.channels.fetch(channelId).catch(() => null);
      if (!channel?.threads) continue;
      const name = Array.from(`${RELAYED_THREAD_MARKER} ${thread.name}`).slice(0, 100).join("");

      const messageDelivery = dockMessage?.deliveries?.find(
        (delivery) => delivery.channelId === channelId,
      );

      let relayedThread;

      try {
        if (messageDelivery?.messageId) {
          const relayedMessage = await channel.messages
            .fetch(messageDelivery.messageId)
            .catch(() => null);
          if (relayedMessage?.startThread && !relayedMessage.hasThread) {
            relayedThread = await relayedMessage.startThread({
              name,
              autoArchiveDuration: thread.autoArchiveDuration ?? 1440,
              reason: "Dock thread relay",
            });
          }
        }

        if (!relayedThread && channel.threads) {
          relayedThread = await channel.threads.create({
            name: Array.from(`${RELAYED_THREAD_MARKER} ${thread.name}`).slice(0, 100).join(""),
            autoArchiveDuration: thread.autoArchiveDuration ?? 1440,
            reason: "Dock thread relay",
          });
        }

        await thread.client.modules.db.addDockThreadDeliveries(thread.id, [
          {
            guildId: receivingFollower.guildId,
            guildName: receivingFollower.guildName,
            channelId,
            threadId: relayedThread.id,
          },
        ]);
      } catch (error) {
        console.error("[dock-thread] Failed to create linked Dock thread:", error);
        continue;
      }
    }
  }
}

async function relayThreadMessage(message) {
  const dockThread = await message.client.modules.db.getDockThread(message.channel.id);
  if (!dockThread) return;

  const dock = await message.client.modules.db.getDock(dockThread.dockId);
  if (!dock) return;

  const threads = [
    {
      guildId: dockThread.rootGuildId,
      guildName: dock.guildName,
      channelId: dockThread.rootChannelId,
      threadId: dockThread.rootThreadId,
    },
    ...(dockThread.deliveries ?? []),
  ].filter((delivery) => delivery.threadId);
  const sendingThread = threads.find((delivery) => delivery.threadId === message.channel.id);
  if (!sendingThread) return;
  // build the message payload
  const username = `${message.author.username} [${dock.name}] [${sendingThread.guildName}]`;
  const formattedUsername =
    Array.from(username).length > 80
      ? Array.from(username).slice(0, 76).join("") + "..."
      : username;

  let messagePayload = {
    username: formattedUsername,
    avatarURL: message.author.displayAvatarURL(),
    content: getRelayContent(message),
    embeds: getRelayEmbeds(message),
    files: getRelayFiles(message),
    allowedMentions: { users: [message.author.id] },
  };
  // loop through each thread and forward messages

  for (const thread of threads) {
    if (thread.threadId === message.channel.id) continue;

    const channel = await message.client.channels.fetch(thread.channelId).catch(() => null);
    if (!channel) continue;

    const webhook = await getDockWebhook(message.client, channel, thread);
    await webhook.send({
      ...messagePayload,
      threadId: thread.threadId,
    });
  }
}

async function relayMessage(message, options = {}) {
  const sendingFollower = await message.client.modules.db.getDockFollowForChannel(
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
  const isDockPing = message.client.dockPingMessages?.has(message.id);
  const dockPing = message.client.dockPingMessages?.get(message.id);

  await message.client.modules.db.indexDockMessage({
    dockId: dock._id,
    rootGuildId: message.guildId,
    rootChannelId: message.channel.id,
    rootMessageId: message.id,
    deliveries: [],
  });

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
        content: getRelayContent(message, options),
        embeds: getRelayEmbeds(message),
        files: getRelayFiles(message),
        allowedMentions: { users: [message.author.id] },
      };
      
      if (isDockPing) {
        const pingRoles = receivingFollower.pingRoleIds ?? [];
        
        messagePayload.content = pingRoles.length
          ? `${pingRoles.map((roleId) => `<@&${roleId}>`).join(" ")}\n${dockPing.content}`
          : dockPing.content;

        messagePayload.allowedMentions.roles = pingRoles;
      }
      const relayedMessage = await webhook.send(messagePayload);

      await message.client.modules.db.addDockMessageDeliveries(message.channel.id, message.id, [
        {
          guildId: receivingFollower.guildId,
          guildName: receivingFollower.guildName,
          channelId,
          messageId: relayedMessage.id,
          pingRoleIds: isDockPing ? (receivingFollower.pingRoleIds ?? []) : [], 
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

async function dockRelay(input) {
  if (input.isThread?.()) {
    return relayThread(input);
  }

  if (input.channel && input.author) {
    if (input.channel.isThread?.()) {
      return relayThreadMessage(input);
    }

    return relayMessage(input);
  }

  return relayAlert(input);
}

module.exports = {
  relayAlert,
  relayMessage,
  relayThread,
  relayThreadMessage,
}
