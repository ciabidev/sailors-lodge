const { SlashCommandSubcommandBuilder, MessageFlags, ContainerBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("help")
    .setDescription("Show settings commands."),

  async execute(interaction) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents((t) => t.setContent("# admin / settings help"))
      .addTextDisplayComponents(
        (t) =>
          t.setContent(
            `### tiny glossary \n- **Ping role**: The role that gets @mentioned when someone uses \`/party ping\` for a group (like Luck Party Ping, Epicenter Party Ping, etc.).\n- **Allowed roles**: Roles that are permitted to use \`/party ping\` for that group. Leave empty to allow everyone.\n- **Followed channel**: A channel where this bot listens for announcements from other servers for parties (detects keywords).\n- **Keywords**: Words or phrases (comma-separated) that appear in those followed announcements to trigger a ping. There are none by default, you have to add keywords yourself`,
          ),
        (t) =>
          t.setContent(
            `### \`/settings ping add\`\n- Create a new ping group. You pick its name, the ping role to mention, who can use it (allowed roles), and optional followed channel/keywords.`,
          ),
        (t) =>
          t.setContent(
            `### \`/settings ping remove\`\n- Delete a ping group by name. This stops its pings and removes it from the list.`,
          ),
        (t) =>
          t.setContent(
            `### \`/settings ping edit\`\n- Update an existing group. You can change the ping role, allowed roles, followed channel, or keywords.`,
          ),
        (t) =>
          t.setContent(
            `### \`/settings ping list\`\n- Show all ping groups with their roles, allowed roles, and followed settings.`,
          ),
        (t) =>
          t.setContent(
            `### \`/settings followedpings\`\n- Turn followed pings on or off for this server.`,
          ),
        (t) =>
          t.setContent(
            `### \`/settings lfgrole\`\n- Set the role that gets pinged when someone uses \`/party lfg\`.`,
          ),
      );

    return interaction.reply({
      components: [container],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    });
  },
};
