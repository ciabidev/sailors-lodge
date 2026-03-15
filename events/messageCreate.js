const { Events } = require("discord.js");
const { TextDisplayBuilder, SectionBuilder, MessageFlags } = require("discord.js");
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    const isWebhookMessage = Boolean(message.webhookId);
    // Allow followed-channel webhook messages to flow; ignore other bots.
    if (message.author.bot && !isWebhookMessage) return;

    const announcePrefix = "!a";
    if (message.content.toLowerCase().startsWith(announcePrefix)) {
      const party = await message.client.modules.db.getCurrentParty(message.author.id);
      if (!party) {
        // just send normal DM reply, don't use ephemeral
        await message
          .reply({
            content: "You are not in a party to make an announcement.",
          })
          .catch(() => {});
        return;
      }

      const announcementContent = message.content.slice(announcePrefix.length).trim();
      if (!announcementContent && message.attachments.size === 0 && message.embeds.length === 0)
        return;
      // const section = new SectionBuilder()
      //   // Add your announcement text
      //   .addTextDisplayComponents((t) =>
      //     t.setContent(`📢 **${message.author.username}:**\n${announcementContent}`),
      //   )
      //   // Add the thumbnail (avatar) on the side
      //   .setThumbnailAccessory((t) => t.setURL(message.author.displayAvatarURL({ dynamic: true })));

      const payload = {
        content: `📢 **${message.author.username}:**\n${announcementContent}`,
        embeds: message.embeds,
        files: Array.from(message.attachments.values()),
      };

      await message.client.modules.announce(message.client, party, payload);

      await message.react("📢").catch(() => {});
    }

    const isFromFollowedServer = isWebhookMessage || message.flags.has(MessageFlags.IsCrosspost);
    console.log("isFromFollowedServer: ", isFromFollowedServer);


    if (isFromFollowedServer) { // followed luckping and epiping. currently only available for Sunfish Village since I haven't added per server configs yet
      const channel = message.channel;
      const LUCK_PING_ROLE_ID = process.env.LUCK_PING_ROLE_ID;
      const EPICENTER_PING_ROLE_ID = process.env.EPICENTER_PING_ROLE_ID;
      const serverPartnerText = `\n-# this host is part of our <#${process.env.AFFILIATES_CHANNEL_ID}>`;
      const followedPingsEnabled = process.env.FOLLOWED_PINGS_ENABLED === "true";
      if (!followedPingsEnabled) return;
      console.log("Received message from followed server: ", message.content);
      if (!message.content) {
        const firstEmbed = message.embeds?.[0];
        console.log("Followed msg debug:", {
          type: message.type,
          flags: message.flags?.bitfield,
          webhookId: message.webhookId,
          authorBot: message.author?.bot,
          channelId: message.channel?.id,
          embedsCount: message.embeds?.length || 0,
          embedTitle: firstEmbed?.title || null,
          embedDescription: firstEmbed?.description || null,
        });
      }

      if (channel.id === process.env.PARTIES_CHANNEL_ID) {
        const messageContent = message.content.toLowerCase();
        // make sure the message is from a followed server
        if (
          messageContent.includes("?luckparty") ||
          messageContent.includes("luckping") ||
          messageContent.includes("@luck")
        ) {
          console.log("Luck ping message received: ", messageContent);
          await channel.send(
            `Luck party ping from followed server by <@${message.author.id}>! <@&${LUCK_PING_ROLE_ID}>${serverPartnerText}`,
          );
        }

        if (messageContent.includes("epiping")) {
          console.log("Epicenter ping message received: ", messageContent);
          await channel.send(
            `Epicenter party ping from followed server by <@${message.author.id}>! <@&${EPICENTER_PING_ROLE_ID}>${serverPartnerText}`,
          );
        }
      }
    }
  },
};
