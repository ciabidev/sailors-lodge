const { Events, MessageFlags } = require("discord.js");
const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
} = require("discord.js");

const { issues } = require("../config.json");
module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const client = interaction.client;

    // ✅ Handle autocomplete first
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error("Autocomplete error:", error);
      }
      return;
    }

    // ✅ Handle normal slash commands
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      let content = error.message;
      if (error.stack) {
        content += `\n\n${error.stack}`;
      }

      if (error.code === 50001) {
        content = "I don't have access to this channel.";
      }
 
      const replyContent = {
        content: `An error occurred while executing this command, please report this to us via our [issue board](${issues})\n\`\`\`${content}\`\`\``,
        flags: [MessageFlags.Ephemeral],
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyContent);
      } else {
        await interaction.reply(replyContent);
      }
    }
  },
};
