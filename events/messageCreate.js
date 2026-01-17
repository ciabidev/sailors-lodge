const { Events } = require("discord.js");
const { TextDisplayBuilder, SectionBuilder, MessageFlags } = require("discord.js");
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return; 


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
  },
};
