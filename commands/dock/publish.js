const { MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("publish")
    .setDescription("Publish a Dock for other servers to connect to."),

  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "Docks can only be published from a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.client.modules.dockPublishModal(interaction);
  },
};
