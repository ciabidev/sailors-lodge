const {
  PermissionsBitField,
  MessageFlags,
  SlashCommandBuilder,
  SeparatorSpacingSize,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("manage settings for your server"),

  execute: async (interaction) => {
    if (!interaction.member.permissions.has(PermissionsBitField.ManageGuild)) {
      await interaction.reply({
        content: "You need the Manage Server permission to use this command.",
        ephemeral: true,
      });
      return;
    }

    const settings = await interaction.client.modules.supabase.getSettings(interaction.guild.id)
    function renderSettings(settings) {
      const container = new ContainerBuilder()
      container.addTextDisplayComponents(
        (t) => t.setContent(`## Warhorn Server Settings`)
      )

      const settingsRows = [
        {
          name: "Receive Pings from Other Servers",
          value: settings.receivePingsFromOtherServers ? "Yes" : "No",
        },
        {
          name: "Send Pings to Other Servers",
          value: settings.sendPingsToOtherServers ? "Yes" : "No",
        },
        {
          name: "Host Roles",
          value: settings.hostRoles.join(", "),
        },
        {
          name: "Use Cross-Server Threads",
          value: settings.useCrossServerThreads ? "Yes" : "No",
        },
      ];

      for (const setting of settingsRows) {
        container.addTextDisplayComponents((t) =>
          t.setContent(`**${setting.name}**: ${setting.value}`)
        );
      }

      return container;
    }

    const components = [renderSettings(settings)];
    const response = await interaction.reply({
      content: "Loading...",
      components,
      flags: MessageFlags.Ephemeral,
      ephemeral: true,
    });
  },
};
