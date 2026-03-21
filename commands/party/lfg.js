const { SlashCommandBuilder, SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");
const cooldownAmount = 36000000; 
let lastCommandUsage = 0
module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("lfg")
    .setDescription("Ping the Looking For Group role to gather members for your party."),

  async execute(interaction) {
    // get the current party the user is in
    
    
    const settings = await interaction.client.modules.db.getSettings(interaction.guildId);
    const lfgRoleId = settings.lfgRoleId;
    const now = Date.now();
    const expirationTime = lastCommandUsage + cooldownAmount;

    if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 600000;
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
   
    // repeat with every server the bot is in that has an lfg role set in settings
    try {
      if (!lfgRoleId) {
        return interaction.reply({
          content: "This server does not have an LFG role set.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error(error);
    }
    
    await interaction.reply({
      content: `<@&${lfgRoleId}>: \`${party.name}\` (Use /join ${party.joinCode} to join the party)`,
      // Explicitly allow the LFG role mention
      allowedMentions: { roles: [lfgRoleId] },
    });

    lastCommandUsage = now;
  },
};
