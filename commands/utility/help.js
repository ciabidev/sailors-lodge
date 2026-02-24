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
  data: new SlashCommandBuilder().setName("help").setDescription("How to use this bot"),
  async execute(interaction) {
    // plain text


    const guide = new ContainerBuilder()
      .addTextDisplayComponents((t) => t.setContent("# party commands"))
      .addTextDisplayComponents(
        (t) => t.setContent(`### \`!a <announcement>\`\n- Announce a message or attached image to your party leader or members.For example: !a Hello everyone`),
        (t) =>
          t.setContent(
            `### \`/party create\`\n- Create a party`,
          ),
        (t) =>
          t.setContent(
            `### \`/party join\`\n- Join a party`,
          ),
        (t) => t.setContent(`### \`/party leave\`\n- Leave your party`),
        (t) => t.setContent(`### \`/party show\`\n- Show the party card for your current party`),
        (t) => t.setContent(`### \`/party browse\`\n- Browse all parties`),
        (t) => t.setContent(`# party owner commands`),
        (t) => t.setContent(`### \`/party edit\`\n- Edit your party`),
        (t) => t.setContent(`### \`/party delete\`\n- Delete your party`),
        (t) => t.setContent(`### \`/party togglelock\`\n- Toggle whether people can join your party`),
        (t) => t.setContent(`### \`/party kick\`\n- Kick someone from your party`),      
      )
    
    const troubleshooting = new ContainerBuilder()
      .addTextDisplayComponents((t) => t.setContent("# troubleshooting"))
      .addTextDisplayComponents(
        (t) => t.setContent(`### Announcements aren't working`),
        (t) =>
          t.setContent(
            `- Enable dms for this bot\n- If you're trying to use !a command in a server, make sure the bot has access to the channel.\n-# For example, if your server has a Verified-type role needed to access channels, give the bot that role`,
          ),
      );
      

    const extraText = `
**IMPORTANT:** If you haven't already, enable dms so this bot can send you Party notifications and announcements
It's also highly recommended you join the official Vetex server to see other people's tags: <https://discord.gg/vetex>
    `;
    await interaction.reply({
      components: [guide, troubleshooting],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    });

    await interaction.followUp({
      content: extraText,
      flags: [MessageFlags.Ephemeral],
    });

  },
};
