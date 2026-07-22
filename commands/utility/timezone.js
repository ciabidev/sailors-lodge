const { MessageFlags, SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timezone")
    .setDescription("Set your timezone for scheduled pings.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set the timezone used when you enter scheduled times.")
        .addStringOption((option) =>
          option
            .setName("timezone")
            .setDescription("Your timezone, such as America/New York")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  async autocomplete(interaction) {
    await interaction.respond(
      interaction.client.modules.timeZones.choices(interaction.options.getFocused()),
    );
  },

  async execute(interaction) {
    const timeZone = interaction.options.getString("timezone", true);
    if (!interaction.client.modules.timeZones.isValid(timeZone)) {
      return interaction.reply({
        content: "Choose a valid timezone from the autocomplete list.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.client.modules.db.setUserTimezone(interaction.user.id, timeZone);
    return interaction.reply({
      content: `Your timezone is now **${interaction.client.modules.timeZones.label(timeZone)}**. Scheduled times such as \`8pm tomorrow\` will use this timezone.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
