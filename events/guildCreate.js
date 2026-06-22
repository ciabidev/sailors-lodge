const { AuditLogEvent, ContainerBuilder, Events, MessageFlags } = require("discord.js");

const WELCOME_COMPONENT = new ContainerBuilder().addTextDisplayComponents(
  (text) =>
    text.setContent(
      "# Welcome to Sailor's Lodge!\nThanks for adding me to your server"
    ),
  (text) =>
    text.setContent(
      "## Parties\nMembers can use `/party create` to make a party. Run `/help` for the full party guide.",
    ),
  (text) =>
    text.setContent(
      "## Docks\nDocks connect party channels across discord servers. Run `/dock help` for the full Dock guide.",
    ),
  (text) =>
    text.setContent(
      "## Server setup\nServer ping groups and the LFG role can be configured under `/settings`; run `/settings help` for setup instructions.\n\n-# Members should enable DMs so I can deliver party notifications and announcements.",
    ),
);

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.BotAdd,
        limit: 5,
      });
      const botAdd = auditLogs.entries.find((entry) => entry.target?.id === guild.client.user.id);

      if (!botAdd?.executor || botAdd.executor.bot) {
        console.warn(`[guild-welcome] Could not find who added the bot to ${guild.id}.`);
        return;
      }

      await botAdd.executor.send({
        components: [WELCOME_COMPONENT],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error(`[guild-welcome] Could not DM the bot installer for ${guild.id}:`, error);
    }
  },
};
