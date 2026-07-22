const { AuditLogEvent, ContainerBuilder, Events, MessageFlags } = require("discord.js");

const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL;
const WELCOME_COMPONENT = new ContainerBuilder().addTextDisplayComponents(
  (text) =>
    text.setContent(
      "# Welcome to Sailor's Lodge!\nThanks for adding me to your server"
    ),
  (text) =>
    text.setContent(
      `## Set up Sailor's Lodge for your server\nYou can configure your server through the official [dashboard](${dashboardUrl}) (recommended) or with commands (use the respective \`/help\` commands to learn more about each feature)`,
    ),
  (text) =>
    text.setContent(
      "## Parties\nMembers can use `/party create` to create party cards with custom instructions and member counts.\nThey can also use `/party ping` to ping activity groups and roles in your server (dont worry, this needs to be set up before it can be used).",
    ),
  (text) =>
    text.setContent(
      "## Docks\nDocks connect party channels across discord servers. You can publish Docks from your server or discover Docks from the community",
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
