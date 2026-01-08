const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Reloads a command.")
    .addStringOption((option) =>
      option.setName("command").setDescription("The command to reload").setRequired(true)
    ),
  async execute(interaction) {
    const commandName = interaction.options.getString("command", true).toLowerCase();
    const command = interaction.client.commands.get(commandName);
    if (!command) {
      return interaction.reply(`There is no command with name \`${commandName}\``);
    }

    delete require.cache[require.resolve(command.__path)]; // changed

    try {
      const newCommand = require(command.__path); // changed
      newCommand.__path = command.__path; // keep the path
      interaction.client.commands.set(newCommand.data.name, newCommand);

      await interaction.reply(`Command \`${newCommand.data.name}\` was reloaded`);
    } catch (error) {
      console.error(error);
      await interaction.reply(
        `There was an error while reloading a command \`${command.data.name}\`:\n\`${error.message}\``
      );
    }
  },
};
