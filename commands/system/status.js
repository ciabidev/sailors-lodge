const {
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check the status and health of the bot."),

  async execute(interaction) {
    const { client } = interaction;
    const websocketPing = Math.max(0, Math.round(client.ws.ping));
    const guildCount = client.guilds.cache.size;

    let databaseOnline = false;
    try {
      const database = await client.modules.db.initDb();
      await database.command({ ping: 1 });
      databaseOnline = true;
    } catch (error) {
      console.error("[status] Database health check failed:", error);
    }

    const botOnline = client.isReady() && client.ws.status === 0;
    const healthy = botOnline && databaseOnline;

    const container = new ContainerBuilder()
      .setAccentColor(healthy ? 0x57f287 : 0xfee75c)
      .addTextDisplayComponents((text) =>
        text.setContent("# Sailor's Lodge status"),
      )
      .addTextDisplayComponents((text) =>
        text.setContent(
          [
            `**Bot:** ${botOnline ? "🟢 Online" : "🟠 Degraded"}`,
            `**Database:** ${databaseOnline ? "🟢 Online" : "🔴 Offline"}`,
            `**Servers:** ${guildCount.toLocaleString()}`,
            `**Latency:** ${websocketPing} ms`,
          ].join("\n"),
        ),
      );

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
