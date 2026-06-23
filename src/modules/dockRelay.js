const {
  MessageFlags,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
function getPartyIdFromComponents(message) {
  if (!message.components) return null;
  for (const row of message.components ?? []) {
    for (const component of row.components ?? []) {
      const customId = component.customId;
      const match = customId?.match(/^party-(?:join|leave|card-refresh):(.+)$/);
      if (match) return match[1];
    }
  }

  return null;
}

function isPartyCard(message) {
  return Boolean(getPartyIdFromComponents(message));
}

async function repliedToReference({
  message,
  receivingFollower,
  channel,
  deliveryChannelId = channel.id,
}) {
  // check if the message is replying to another message and relay the reference too
  if (!message.reference?.messageId) return null;

  const original = await message.fetchReference().catch(() => null); // the original message that is being replied to
  if (!original) return null;
  const dockMessage = await message.client.modules.db.getDockMessageFromRoot(
    original.channel.id,
    original.id,
  ); // find the dock message of the replied to message

  let delivery = null;
  let relayed = null;
  if (dockMessage) {
    delivery = dockMessage.deliveries?.find(
      (d) => d.guildId === receivingFollower.guildId && d.channelId === deliveryChannelId,
    );
    if (!delivery) return null;
    relayed = await channel.messages.fetch(delivery.messageId).catch(() => null);
    if (!relayed) return null;
  }

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `Reply to ${original.author.username}`,
      iconURL: original.author.displayAvatarURL(),
    })
    .setDescription(original.content?.slice(0, 4096) || "*No text content*");
  let row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setURL(original.url)
      .setLabel("Jump to reply (in original server)")
      .setStyle(ButtonStyle.Link),
  );
  if (dockMessage) {
    row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setURL(relayed.url).setLabel("Jump to reply").setStyle(ButtonStyle.Link),
    );
  }

  return { embed, row };
}
async function getWritableDockFollows(client, channelId, guildId) {
  // One channel can follow multiple Docks. Return only the follower records that
  // are allowed to send from this channel; callers can fetch the Dock when needed.
  const followers = await client.modules.db.getDockFollowsForChannel(channelId);
  const connections = await Promise.all(
    followers.map(async (follower) => ({
      follower,
      dock: await client.modules.db.getDock(follower.dockId),
    })),
  );

  return connections.filter(
    ({ dock, follower }) =>
      dock &&
      client.modules.dockLevels.canRead(follower) &&
      (dock.guildId === guildId || client.modules.dockLevels.canSend(follower.level)),
  ).map(({ follower }) => follower);
}

const dockWebhookPromises = new Map();
const DOCK_WEBHOOK_NAME = "Sailors Lodge Dock Webhook";

async function resolveDockWebhook(client, channel, dockFollower) {
  const savedWebhook = await client.modules.db.getDockWebhook(
    dockFollower.guildId,
    channel.id,
  );

  let webhook = null;

  if (savedWebhook?.webhookId) {
    webhook = await client
      .fetchWebhook(savedWebhook.webhookId, savedWebhook.webhookToken)
      .catch(() => null);

    if (webhook?.channelId === channel.id) {
      return webhook;
    }
  }

  // Recover webhooks created before webhooks were stored per channel. This also
  // avoids creating another webhook after a database reset or failed write.
  const channelWebhooks = await channel.fetchWebhooks().catch(() => null);
  webhook = channelWebhooks?.find(
    (candidate) =>
      candidate.name === DOCK_WEBHOOK_NAME && candidate.owner?.id === client.user.id,
  );

  if (!webhook) {
    webhook = await channel.createWebhook({
      name: DOCK_WEBHOOK_NAME,
      avatar: client.user.displayAvatarURL(),
    });
  }

  await client.modules.db.setDockWebhook(dockFollower.guildId, channel.id, {
    guildName: dockFollower.guildName,
    webhookId: webhook.id,
    webhookToken: webhook.token,
  });

  return webhook;
}

async function getDockWebhook(client, channel, dockFollower) {
  const cacheKey = `${dockFollower.guildId}:${channel.id}`;
  let pending = dockWebhookPromises.get(cacheKey);

  if (!pending) {
    pending = resolveDockWebhook(client, channel, dockFollower).finally(() => {
      dockWebhookPromises.delete(cacheKey);
    });
    dockWebhookPromises.set(cacheKey, pending);
  }

  return pending;
}

const RELAYED_THREAD_MARKER = "[Relayed]"; // This marks relayed threads. Threads with this marker dont get recreated, preventing infinite thread creation loops.

// we need these functions getForwardedSnapshot, getRelayContent, getRelayEmbeds, getRelayFiles because the discord Forwarded Messages are structured differently than normal ones
function getForwardedSnapshot(message) {
  return message.messageSnapshots?.first?.() ?? null;
}

function getRelayContent(message, options = {}) {
  const snapshot = getForwardedSnapshot(message);
  const content = options.content || message.content || snapshot?.content || null;

  if (!snapshot || !content) return content;
  // append a > to the beginning of the content. the quote should encapsulate the entire message

  // join the content with the newlines and append a single > to the beginning of the content
  return `> -# ***➡️ Forwarded***\n> ${content.split("\n").join("\n> ")}`;
}

function getRelayEmbeds(message) {
  const snapshot = getForwardedSnapshot(message);
  return message.embeds?.length ? message.embeds : (snapshot?.embeds ?? []);
}

function getRelayComponents(message) {
  const snapshot = getForwardedSnapshot(message);
  return message.components?.length ? message.components : (snapshot?.components ?? []);
}
function getRelayFiles(message) {
  const snapshot = getForwardedSnapshot(message);
  const attachments = message.attachments?.size ? message.attachments : snapshot?.attachments;
  return attachments?.map((attachment) => attachment.url) ?? [];
}

async function relayThread(thread, sendingFollower = null) {
  if (thread.name?.startsWith(RELAYED_THREAD_MARKER)) return;

  const existingDockThread = await thread.client.modules.db.getDockThread(thread.id);
  if (existingDockThread) return;

  if (!sendingFollower) {
    // threads are indexed under one dock, so dont merge multiple dock thread networks together
    [sendingFollower] = await getWritableDockFollows(
      thread.client,
      thread.parentId,
      thread.guildId,
    );
  }

  const dock = await thread.client.modules.db.getDock(sendingFollower?.dockId);
  if (!dock) return;

  const receivingFollowers = (await thread.client.modules.db.getDockFollowers(dock._id))
    .map((dockFollower) => ({
      ...dockFollower,
      channelIds: (dockFollower.channelIds ?? [dockFollower.channelId]).filter(
        (channelId) => channelId && channelId !== thread.parentId,
      ),
    }))
    .filter(
      (dockFollower) =>
        dockFollower.channelIds.length > 0 &&
        thread.client.modules.dockLevels.canRead(dockFollower),
    );
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
  if (isPartyCard(message)) return;

  const dockThread = await message.client.modules.db.getDockThread(message.channel.id);
  if (!dockThread) return;

  const dock = await message.client.modules.db.getDock(dockThread.dockId);
  if (!dock) return;

  const activeGuildIds = new Set(
    (await message.client.modules.db.getDockFollowers(dock._id))
      .filter((follower) => message.client.modules.dockLevels.canRead(follower))
      .map((follower) => follower.guildId),
  );
  activeGuildIds.add(dock.guildId);

  const threads = [
    {
      guildId: dockThread.rootGuildId,
      guildName: dock.guildName,
      channelId: dockThread.rootChannelId,
      threadId: dockThread.rootThreadId,
    },
    ...(dockThread.deliveries ?? []),
  ].filter((delivery) => delivery.threadId && activeGuildIds.has(delivery.guildId));
  const sendingThread = threads.find((delivery) => delivery.threadId === message.channel.id);
  if (!sendingThread) return;
  if (dock.guildId !== sendingThread.guildId) {
    const sendingFollower = await message.client.modules.db.getDockFollower(
      dock._id,
      sendingThread.guildId,
    );
    if (
      !message.client.modules.dockLevels.canRead(sendingFollower) ||
      !message.client.modules.dockLevels.canSend(sendingFollower?.level)
    ) return;
  }
  const username = `${message.author.username} [${dock.name}] [${sendingThread.guildName}]`;
  const formattedUsername =
    Array.from(username).length > 80
      ? Array.from(username).slice(0, 76).join("") + "..."
      : username;

  await message.client.modules.db.indexDockMessage({
    dockId: dock._id,
    rootGuildId: message.guildId,
    rootChannelId: message.channel.id,
    rootMessageId: message.id,
    deliveries: [],
  });

  for (const thread of threads) {
    if (thread.threadId === message.channel.id) continue;

    const targetThread = await message.client.channels.fetch(thread.threadId).catch(() => null);
    if (!targetThread?.isThread?.()) continue;

    const channel =
      targetThread.parent ??
      (await message.client.channels.fetch(thread.channelId).catch(() => null));
    if (!channel) continue;

    const webhook = await getDockWebhook(message.client, channel, thread);
    const components = getRelayComponents(message);
    const messagePayload = {
      username: formattedUsername,
      avatarURL: message.author.displayAvatarURL(),
      content: components.length ? "" : getRelayContent(message),
      embeds: getRelayEmbeds(message),
      files: getRelayFiles(message),
      components,
      allowedMentions: { users: [message.author.id] },
      flags: components.length ? [MessageFlags.IsComponentsV2] : undefined,
      threadId: thread.threadId,
    };

    if (message.reference?.messageId && !components.length) {
      const reply = await repliedToReference({
        message,
        receivingFollower: thread,
        channel: targetThread,
        deliveryChannelId: thread.channelId,
      });
      if (reply) {
        messagePayload.embeds = [reply.embed, ...messagePayload.embeds];
        messagePayload.components = [reply.row];
      }
    }

    const relayedMessage = await webhook.send(messagePayload);
    await message.client.modules.db.addDockMessageDeliveries(message.channel.id, message.id, [
      {
        guildId: thread.guildId,
        guildName: thread.guildName,
        channelId: thread.channelId,
        threadId: thread.threadId,
        messageId: relayedMessage.id,
        keywordPings: [],
      },
    ]);
  }
}

async function relayMessage(message, options = {}, sendingFollower = null) {
  if (isPartyCard(message)) return;

  if (!sendingFollower) {
    // Find a Dock this channel has permission to publish to.
    [sendingFollower] = await getWritableDockFollows(
      message.client,
      message.channel.id,
      message.guildId,
    );
  }

  const dock = await message.client.modules.db.getDock(sendingFollower?.dockId);
  if (!dock) return;
  if (
    dock.guildId !== sendingFollower.guildId &&
    (!message.client.modules.dockLevels.canRead(sendingFollower) ||
      !message.client.modules.dockLevels.canSend(sendingFollower.level))
  )
    return;

  const receivingFollowers = (await message.client.modules.db.getDockFollowers(dock._id))
    .map((dockFollower) => ({
      ...dockFollower,
      channelIds: (dockFollower.channelIds ?? [dockFollower.channelId]).filter(
        (channelId) => channelId && channelId !== message.channel.id,
      ),
    }))
    .filter(
      (dockFollower) =>
        dockFollower.channelIds.length > 0 &&
        message.client.modules.dockLevels.canRead(dockFollower),
    );
  if (receivingFollowers.length === 0) return;
  const isDockPing =
    message.client.dockPingMetadata?.has(message.id) &&
    (dock.guildId === sendingFollower.guildId ||
      message.client.modules.dockLevels.canPing(sendingFollower.level));
  const dockPing = message.client.dockPingMetadata?.get(message.id);
  const { formatRoleMentions } = message.client.modules.mentions;
  const uniqueItems = message.client.modules.uniqueItems;

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
      const components = getRelayComponents(message);

      const messagePayload = {
        username: formattedUsername,
        avatarURL: message.author.displayAvatarURL(),
        content: components.length ? "" : getRelayContent(message, options),
        embeds: getRelayEmbeds(message),
        files: getRelayFiles(message),
        components,
        allowedMentions: { users: [message.author.id] },
        flags: components.length ? [MessageFlags.IsComponentsV2] : undefined,
      };

      if (message.reference?.messageId) {
        const reply = await repliedToReference({ message, receivingFollower, channel });

        if (reply) {
          messagePayload.embeds = [reply.embed, ...messagePayload.embeds];
          messagePayload.components = [reply.row];
        }
      }
      const relayedMessage = await webhook.send(messagePayload);
      let pingRoles = [];

      if (isDockPing) {
        pingRoles = uniqueItems(
          (dockPing.keywords ?? []).flatMap(
            (keyword) => receivingFollower.keywordPings?.[keyword] ?? [],
          ).filter(Boolean),
        );
        const pingContent = `${dock.name} ping triggered by ${dockPing.username}!`;
        messagePayload.content = pingRoles.length
          ? `${formatRoleMentions(pingRoles)} ${pingContent}`
          : pingContent;

        messagePayload.allowedMentions.roles = pingRoles;
        delete messagePayload.username;
        delete messagePayload.avatarURL;

        await channel.send(messagePayload);
      }

      await message.client.modules.db.addDockMessageDeliveries(message.channel.id, message.id, [
        {
          guildId: receivingFollower.guildId,
          guildName: receivingFollower.guildName,
          channelId,
          messageId: relayedMessage.id,
          keywordPings: pingRoles,
        },
      ]);
    }
  }
}

async function relayAlert({ client, dockId, guildIds, ...payload }) {
  const dock = await client.modules.db.getDock(dockId);
  if (!dock) return;

  const targetGuildIds = guildIds ? new Set(guildIds) : null;
  const followers = (await client.modules.db.getDockFollowers(dock._id)).filter((follower) =>
    targetGuildIds
      ? targetGuildIds.has(follower.guildId)
      : client.modules.dockLevels.canRead(follower),
  );
  if (followers.length === 0) return;
  if (payload.party && payload.source) {
    await client.modules.db.indexDockMessage({
      dockId: dock._id,
      rootGuildId: payload.source.guildId,
      rootChannelId: payload.source.channel.id,
      rootMessageId: payload.source.id,
      deliveries: [],
    });
  } // index the source party card and its relayed copies so relayThread can find each counterpart and attach relayed threads to the each relayed card
  for (const follower of followers) {
    for (const channelId of follower.channelIds ?? []) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      if (payload.party) {
        // all party cards in docks get relayed as alerts so we need to detect party cards and rebuild them here
        // we cant rebuild them in messageCreate cause thats not where the party card gets relayed obv
        if (channelId === payload.sourceChannelId) continue;

        const components = await client.modules.renderPartyCard(
          payload.party,
          payload.source ?? { client },
          payload.userId,
        );
        const message = await channel.send({
          components,
          flags: [MessageFlags.IsComponentsV2],
        });

        if (!client.dockRelayedPartyCardMessages) {
          client.dockRelayedPartyCardMessages = new Set();
        }
        client.dockRelayedPartyCardMessages.add(message.id);
        setTimeout(() => client.dockRelayedPartyCardMessages.delete(message.id), 60 * 60 * 1000);

        await client.modules.db.addPartyCardMessage(payload.party._id, {
          channelId,
          messageId: message.id,
          userId: payload.userId,
          guildId: follower.guildId,
        });

         await client.modules.db.addDockMessageDeliveries(
           payload.source.channel.id,
           payload.source.id,
           [
             {
               guildId: follower.guildId,
               guildName: follower.guildName,
               channelId,
               messageId: message.id,
               keywordPings: [],
             },
           ],
         );
         // index the source party card and its relayed copies so relayThread can find each counterpart and attach relayed threads to the each relayed card
         continue;
      }

     

      await channel.send(payload);
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
  RELAYED_THREAD_MARKER,
  getPartyIdFromComponents,
  getWritableDockFollows,
  relayAlert,
  relayMessage,
  relayThread,
  relayThreadMessage,
};
