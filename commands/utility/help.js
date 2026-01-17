const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { TextDisplayBuilder, SectionBuilder, ContainerBuilder, SeparatorSpacingSize, SeparatorBuilder } = require("discord.js");
const devMode = process.env.DEV_MODE === 'true';
const devClientId = process.env.DEV_CLIENT_ID;
const productClientId = process.env.PRODUCTION_CLIENT_ID;
const clientId = devMode ? devClientId : productClientId;
module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("How to use this bot"),
  async execute(interaction) {

    // plain text

    const introText = `**Click Learn More to see all commands!**
**IMPORTANT:** You need to enable dms so this bot can send you party notifications and announcements
It's also highly recommended you join the official Vetex server to see other people's mentions: <https://discord.gg/vetex>
[Add this bot](https://discord.com/oauth2/authorize?client_id=${clientId})
    `;

    const guide = new ContainerBuilder()
      .addTextDisplayComponents((t) => t.setContent("### Announcing to your party"))
      .addTextDisplayComponents((t) =>
        t.setContent(
          "To announce to your party, put `!a` before your announcement and send it directly to the bot.\n-# Anyone can announce",
        ),
      )
    await interaction.reply({
      content: introText,
      flags: [MessageFlags.Ephemeral],
    });

    await interaction.followUp({
      components: [guide],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    });
  },
};