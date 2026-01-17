const { SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("togglelock")
    .setDescription("Lock/Unlock your party from joining"),
    
    async execute(interaction) {
            let party = await interaction.client.modules.db.getCurrentParty(interaction.user.id); 
            
            if (party.locked) {
              await interaction.client.modules.db.updateParty(party._id, { $set: { locked: false } }, interaction);
              party = await interaction.client.modules.db.getParty(party._id);
              await interaction.client.modules.sendPartyNotification(interaction, "lock", party, {
                user: interaction.user,
              });
              return interaction.reply({
                content: "Your party is now unlocked.",
                flags: MessageFlags.Ephemeral,
              });
            } else {
              await interaction.client.modules.db.updateParty(party._id, { $set: { locked: true } }, interaction);
              party = await interaction.client.modules.db.getParty(party._id);
              await interaction.client.modules.sendPartyNotification(interaction, "lock", party, {
                user: interaction.user,
              });
              return interaction.reply({
                content: "Your party is now locked.",
                flags: MessageFlags.Ephemeral,
              });
            }
            
    },
};