const { MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("publish")
    .setDescription("Publish a feed for other servers to subscribe to."),

  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "Feeds can only be published from a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.client.modules.feedPublishModal(interaction);
  },
};
