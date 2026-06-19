const { ContainerBuilder, MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("help")
    .setDescription("Learn how Docks connect party feeds between servers."),

  async execute(interaction) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents((text) =>
        text.setContent(
          "# Dock help\nDocks are *live* feeds that forward messages from chosen channels in this server -> to channels in other servers! \n**Followers:** The people that connect to your dock are called Followers.\n- By default, Followers are read-only; Promote them to contributors to let them publish messages.\n-# If you're a normal member who wants this, you can tell a server admin to set up docks",
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
            "### `/dock manage [search]`\nManage the Docks this server publishes or follows. Here you can configure the receiving channels and ping roles, edit or remove published Docks, set home ping roles, and promote followers to contributors.",
          ),
        (text) =>
          text.setContent(
            "## Permissions and ping roles\n- Docks must be used in a Discord server and require **Manage Channels**. \nDock ping roles are separate from the server-only ping groups that were configured under `/settings ping`.",
          ),
      );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
