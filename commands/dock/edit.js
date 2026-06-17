const { MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("edit")
    .setDescription("Edit an existing Dock.")
    .addStringOption((option) =>
        option.setName("dock").setDescription("The Dock to edit.").setRequired(true).setAutocomplete(true),
      ),
  async autocomplete(interaction) {
    const docks = await interaction.client.modules.db.getDocks();
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = docks
      .filter((dock) => dock.guildId === interaction.guildId)
      .filter((dock) => !focused || (dock.name ?? "").toLowerCase().includes(focused))
      .slice(0, 25)
      .map((dock) => ({
        name: (dock.name ?? "Untitled Dock").slice(0, 100),
        value: dock._id.toString(),
      }));

    return interaction.respond(choices);
  },
  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "Docks can only be edited from a Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectedDock = interaction.options.getString("dock", true);
    const docks = await interaction.client.modules.db.getDocks();
    const dock = docks.find(
      (dock) =>
        dock.guildId === interaction.guildId &&
        (dock._id.toString() === selectedDock || dock.name === selectedDock),
    );

    if (!dock) {
      return interaction.reply({
        content: "I couldn't find that Dock in this Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.client.modules.dockPublishModal(
      interaction,
      dock,
      `dock-publish-modal:${dock._id}`,
    );
  },
};
