const { MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("publish")
    .setDescription("Publish a Dock for servers to follow."),

  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "Docks can only be published from a Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.client.modules.dockPublishModal(interaction);
  },
};
