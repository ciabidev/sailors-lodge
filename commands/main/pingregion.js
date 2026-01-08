const { SlashCommandBuilder } = require("discord.js");

const REGIONS = [
  { name: "North America", value: "north-america" },
  { name: "South America", value: "south-america" },
  { name: "Europe", value: "europe" },
  { name: "Asia", value: "asia" },
  { name: "Oceania", value: "oceania" },
  { name: "Africa", value: "africa" },
  { name: "Middle East", value: "middle-east" },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pingregion")
    .setDescription("Ping a region")
    .addStringOption((option) =>
      option
        .setName("region")
        .setDescription("Region")
        .setRequired(true)
        .addChoices(...REGIONS)
    )
    .addStringOption((option) =>
      option.setName("where").setDescription("The in-game location").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("user")
        .setDescription("Your Roblox username or elysium code")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("extra").setDescription("Any extra information").setRequired(true)
    ),

  execute: async (interaction) => {
    const region = interaction.options.getString("region");
    const where = interaction.options.getString("where");
    const user = interaction.options.getString("user");
    const extra = interaction.options.getString("extra");
    await interaction.reply({
      content: `region: ${region}\n` + `where: ${where}\n` + `user: ${user}\n` + `extra: ${extra}`,
      ephemeral: true,
    });
  },
};
