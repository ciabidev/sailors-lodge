const { SlashCommandBuilder, SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");
const cooldownAmount = 36000000; 
let lastCommandUsage = 0
module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("lfg")
    .setDescription("Ping the Looking For Group role. 1 hour cooldown"),

  async execute(interaction) {
    // get the current party the user is in
    
    
    const LFG_ROLE_ID = process.env.LFG_ROLE_ID;
    const now = Date.now();
    const expirationTime = lastCommandUsage + cooldownAmount;

    if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 60000;
        return interaction.reply({ 
            content: `A global cooldown is active! Please wait ${timeLeft.toFixed(1)} more minutes.`,
            ephemeral: true 
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
          "This Sailor's Lodge feature is unreleased, so its only available in the [Sunfish Village server](https://discord.gg/pRgeb3pp9P)", // i havent added per server configs yet
        flags: MessageFlags.Ephemeral,
      });
    }
    lastCommandUsage = now;
    await interaction.reply(`${interaction.user} is looking for a group! <@&${LFG_ROLE_ID}> \n Use /join ${party.joinCode} to join the party \`${party.name}\``);
  },
};