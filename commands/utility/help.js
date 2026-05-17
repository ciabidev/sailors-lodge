const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  TextDisplayBuilder,
  SectionBuilder,
  ContainerBuilder,
  SeparatorSpacingSize,
  SeparatorBuilder,
} = require("discord.js");
const devMode = process.env.DEV_MODE === "true";
const devClientId = process.env.DEV_CLIENT_ID;
const productClientId = process.env.PRODUCTION_CLIENT_ID;
const clientId = devMode ? devClientId : productClientId;
module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("How to use this bot")
    .addBooleanOption((option) =>
      option.setName("ephemeral").setDescription("Show the message to you only").setRequired(false),
    ),
  async execute(interaction) {
    const guide = new ContainerBuilder()
      .addTextDisplayComponents((t) => t.setContent("# party commands"))
      .addTextDisplayComponents(
        (t) =>
          t.setContent(
            `### \`!a <announcement>\`\n- Send an announcement to everyone in your current party. Text, embeds, and attached images work.\n-# Example: !a Hello everyone`,
          ),
        (t) =>
          t.setContent(
            `### \`/party create [dm]\`\n- Create a party and configure its name, description, status, member limit, and visibility.\n-# Set dm:true to send the party card to your DMs instead of the channel.`,
          ),
        (t) => t.setContent(`### \`/party join code:<code>\`\n- Join a party with its join code.`),
        (t) => t.setContent(`### \`/party leave\`\n- Leave your party`),
        (t) =>
          t.setContent(
            `### \`/party show [dm]\`\n- Show the party card for your current party.\n-# Set dm:true to send the card to your DMs.`,
          ),
        (t) =>
          t.setContent(
            `### \`/party browse [search]\`\n- Browse public parties that are not full and not marked Active.\n-# Use search to filter by party name.`,
          ),
        (t) =>
          t.setContent(
            `### \`/party ping role:<group> [extra] [time]\`\n- Ping one configured ping group, optionally with extra text or a scheduled time.\n-# Ping groups and permissions are managed with /settings ping.`,
          ),
        (t) =>
          t.setContent(
            `### \`/party lfg extra:<text> [time]\`\n- Ping the Looking For Group role with your message, optionally scheduled for later.\n-# If you're in a party, the ping includes your party name and join code.`,
          ),
        (t) => t.setContent(`# party owner commands`),
        (t) =>
          t.setContent(
            `### \`/party edit\`\n- Edit your party name, description, status, member limit, and visibility.\n-# Parties marked Active are hidden from /party browse.`,
          ),
        (t) => t.setContent(`### \`/party delete\`\n- Delete your party`),
        (t) =>
          t.setContent(`### \`/party togglelock\`\n- Lock or unlock whether new people can join your party.`),
        (t) =>
          t.setContent(
            `### \`/party kick usernames:<names>\`\n- Kick one or more members by comma-separated Discord username.`,
          ),
      );

    const troubleshooting = new ContainerBuilder()
      .addTextDisplayComponents((t) => t.setContent("# troubleshooting"))
      .addTextDisplayComponents(
        (t) => t.setContent(`### Announcements aren't working`),
        (t) =>
          t.setContent(
            `- Enable DMs for this bot.\n- Make sure you're currently in a party.\n- If you're using !a in a server, make sure the bot can access that channel.\n-# For example, if your server has a Verified-type role needed to access channels, give the bot that role.`,
          ),
        (t) => t.setContent(`### I can't find my party in browse`),
        (t) =>
          t.setContent(
            `- /party browse only shows public parties that are not full.\n- Parties marked Active are hidden from browse.\n- Private parties can still be joined with their join code.`,
          ),
      );

    const extraText = `
**IMPORTANT:** If you haven't already, enable dms so this bot can send you Party notifications and announcements
It's also highly recommended you join the official Vetex server to see other people's tags: <https://discord.gg/vetex>
    `;

    if (
      (interaction.options.getBoolean("ephemeral") ||
        interaction.options.getBoolean("ephemeral") === undefined) &&
      interaction.guildId
    ) {
      await interaction.reply({
        components: [guide, troubleshooting],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      });

      await interaction.followUp({
        content: extraText,
        flags: [MessageFlags.Ephemeral],
      });
    } else {
      await interaction.reply({
        components: [guide, troubleshooting],
        flags: [MessageFlags.IsComponentsV2],
      });
      await interaction.followUp({
        content: extraText,
      });
    }
  },
};
