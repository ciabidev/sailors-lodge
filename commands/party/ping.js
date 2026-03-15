const { SlashCommandBuilder, SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");
module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("ping")
    .setDescription("Ping an official party role like Omen, Epicenter, or Luck V.")
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("The role to ping")
        .setRequired(true)
        .addChoices(
          { name: "Omen", value: "omen" },
          { name: "Epicenter", value: "epicenter" },
          { name: "Luck V", value: "luck" }
        )
    ),

  async execute(interaction) {
    // get the current party the user is in
    const roles = interaction.member.roles.cache.map((role) => role.id);
    if (!roles.includes(process.env.TRUSTED_HOST_ROLE_ID)) {
      return interaction.reply({
        content: `You need the <@&${process.env.TRUSTED_HOST_ROLE_ID}> role to use this command.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
    if (!party) {
      return interaction.reply({
        content: "You are not in a party.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.guild.id !== process.env.GUILD_ID) {
      return interaction.reply({
        content:
          "This Sailor's Lodge feature is unreleased, so its only available in the [Sunfish Village server](https://discord.gg/pRgeb3pp9P. I plan to make it available for all servers as soon as I can.", // i havent added per server configs yet
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
        content: `unfinished`,
    });
  },
};