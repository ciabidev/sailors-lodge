const { ContainerBuilder, MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("help")
    .setDescription("Learn how to configure this server."),

  async execute(interaction) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents((text) =>
        text.setContent(
          "# Server settings help\nThese settings apply **only to this Discord server**. Ping groups, allowed roles, keywords, and the LFG role are not shared with other servers or Docks.",
        ),
      )
      .addTextDisplayComponents(
        (text) =>
          text.setContent(
            "## Ping-group glossary\n- **Ping group:** A server-specific group that can be pigned by `/party ping` or keywords.\n- **Ping role:** The role mentioned when the group is used.\n- **Allowed roles:** Roles allowed to ping that group; leave this empty to allow everyone.\n- **Keywords:** Comma-separated words or phrases that can trigger the group's ping from messages in this server. No keywords are added automatically.",
          ),
        (text) =>
          text.setContent(
            "### `/settings ping add`\nCreate a ping group for this server and choose its name, ping role, optional allowed role, and optional keywords.",
          ),
        (text) =>
          text.setContent(
            "### `/settings ping edit`\nUpdate a group from this server. You can rename it, change its ping role, add an allowed role, or replace its keywords.",
          ),
        (text) =>
          text.setContent(
            "### `/settings ping remove`\nDelete one of this server's ping groups. It will no longer be available to `/party ping` or keyword matching here.",
          ),
        (text) =>
          text.setContent(
            "### `/settings ping list`\nShow this server's ping groups, ping roles, allowed roles, and keywords.",
          ),
        (text) =>
          text.setContent(
            "### `/settings keywordpings enabled:<true|false>`\nEnable or disable keyword matching for all ping groups in this server. This does not remove their saved keywords.",
          ),
        (text) =>
          text.setContent(
            "### `/settings lfgrole role:<role>`\nChoose the server role mentioned by `/party lfg`.",
          ),
        (text) =>
          text.setContent(
            "-# Managing ping groups and keyword pings requires **Manage Server**. Dock ping roles are configured separately with `/dock manage`.",
          ),
      );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
