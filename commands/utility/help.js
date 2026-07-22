const { ContainerBuilder, MessageFlags, SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Learn how to use Sailor's Lodge.")
    .addBooleanOption((option) =>
      option.setName("ephemeral").setDescription("Show the message only to you.").setRequired(false),
    ),

  async execute(interaction) {
    const guide = new ContainerBuilder()
      .addTextDisplayComponents((text) =>
        text.setContent(
          "# Sailor's Lodge help\nCreate parties, recruit players, and connect your server to live party feeds through Docks.",
        ),
      )
      .addTextDisplayComponents(
        (text) =>
          text.setContent(
            "## Party commands\n- `/party create [dm]` — Create and configure a party.\n- `/party join code:<code>` — Join a party with its code.\n- `/party show [dm]` — Show your current party card.\n- `/party leave` — Leave your current party.\n- `!a <announcement>` — Send an announcement to everyone in your party; text, embeds, and images are supported.",
          ),
        (text) =>
          text.setContent(
            "### Pinging players\n- `/party ping role:<group> [extra] [time]` — Ping a Ping Group from this server for your party (or at a scheduled time)\n- `/party lfg extra:<text> [time]` — Ping this server's Looking For Group role now or later.\n- `/timezone set timezone:<zone>` — Set your timezone before using scheduled pings.\n-# Server admins configure these with `/settings help`.",
          ),
        (text) =>
          text.setContent(
            "### Party owner commands\n- `/party edit` — Edit the party name, description, status, member limit, or visibility.\n- `/party delete` — Delete your party.\n- `/party togglelock` — Lock or unlock joining.\n- `/party kick usernames:<names>` — Kick members by comma-separated Discord usernames.",
          ),
        (text) =>
          text.setContent(
            "## Docks\nDocks replace the old party browser with live party feeds shared between Discord servers. Server managers can use `/dock browse`, `/dock publish`, and `/dock manage`.\n-# Run `/dock help` for the full Dock guide.",
          ),
        (text) =>
          text.setContent(
            "## Server settings\nAdmins can configure server-only ping groups, keyword pings, and the LFG role under `/settings`.\n-# Run `/settings help` for setup instructions.",
          ),
      );

    const troubleshooting = new ContainerBuilder()
      .addTextDisplayComponents((text) => text.setContent("# Troubleshooting"))
      .addTextDisplayComponents((text) =>
        text.setContent(
          "### Party announcements are not arriving\n- Enable DMs from server members so the bot can deliver party notifications and announcements.\n- Make sure you are currently in a party.\n- When using `!a` in a server, make sure the bot can view that channel. If a role is required to see it, give the bot that role.",
        ),
      );

    const ephemeral = interaction.guildId && interaction.options.getBoolean("ephemeral") !== false;
    const flags = MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0);

    await interaction.reply({ components: [guide, troubleshooting], flags });
    await interaction.followUp({
      content:
        "**Important:** Enable DMs so Sailor's Lodge can send party notifications and announcements.\nYou can also join the official Vetex server to see other players' tags: <https://discord.gg/vetex>",
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    });
  },
};
