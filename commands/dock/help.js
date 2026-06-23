const { ContainerBuilder, MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("help")
    .setDescription("Learn how Docks connect party feeds between servers."),

  async execute(interaction) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents((text) =>
        text.setContent(
          "# Dock help\nDocks are *live* feeds that forward messages from chosen channels in this server -> to channels in other servers!\n-# If you're a normal member who wants this, you can tell a server admin to set up docks",
        ),
      )
      .addTextDisplayComponents((text) =>
        text.setContent(
          "## Followers\nThe people that connect to your dock are called Followers.\n- **Passive:** receive messages\n- **Sender:** send messages\n- **Contributor:** send messages and trigger Dock pings\n- **Admin:** manage follower access",
        ),
      )
      .addTextDisplayComponents((text) =>
          text.setContent(
            "## Commands"
          ),
        )
      .addTextDisplayComponents(
        (text) =>
          text.setContent(
            "### `/dock browse [search]`\nDiscover docks to follow. Request-only docks require approval to join",
          ),
        (text) =>
          text.setContent(
            "### `/dock publish`\nPublish one Dock from up to 10 source channels in this server.",
          ),
        (text) =>
          text.setContent(
            "### `/dock manage [search]`\nManage the Docks this server publishes or follows. Configure receiving channels, ping roles, published Docks, and follower access levels.",
          ),
        (text) =>
          text.setContent(
            "### `/dock ban` and `/dock unban`\nBan a server from following this server's Docks with a reason, or allow it to follow again.",
          ),
        (text) =>
          text.setContent(
            "## Permissions and ping roles\n- Docks must be used in a Discord server and require **Manage Channels**. \nDock ping roles are separate from the server-only ping groups.",
          ),
      );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
