const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder().setName('status').setDescription('check if discord servers are ok'),
	async execute(interaction) {
		await interaction.reply('hi');
	},
};