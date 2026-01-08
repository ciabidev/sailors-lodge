const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder().setName('ping').setDescription('check if Karoo is ok'),
	async execute(interaction) {
		await interaction.reply('hi');
	},
};