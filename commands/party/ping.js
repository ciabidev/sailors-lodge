const { SlashCommandSubcommandBuilder, MessageFlags, PermissionsBitField } = require("discord.js");
module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("ping")
    .setDescription("Ping a configured party group.")
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("The group to ping")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const settings = await interaction.client.modules.db.getSettings(interaction.guildId);
    const pingGroups = settings.pingGroups ?? [];
    const filtered = pingGroups
      .filter((group) => group.name.toLowerCase().startsWith(focusedValue.toLowerCase()))
      .slice(0, 25)
      .map((group) => ({ name: group.name, value: group.name }));

    return interaction.respond(filtered);
  },

  async execute(interaction) {
    const groupName = interaction.options.getString("role");
    const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
    if (!party) {
      return interaction.reply({
        content: "You are not in a party.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const settings = await interaction.client.modules.db.getSettings(interaction.guildId);
    const pingGroups = settings.pingGroups ?? [];
    const pingGroup = pingGroups.find(
      (group) => group.name.toLowerCase() === groupName.toLowerCase(),
    );

    if (!pingGroup) {
      return interaction.reply({
        content: "That ping group does not exist.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const allowedRoles = pingGroup.allowedRoles ?? [];
    const hasAllowedRole =
      allowedRoles.length === 0 ||
      allowedRoles.some((roleId) => interaction.member.roles.cache.has(roleId));

    if (!hasAllowedRole) {
      return interaction.reply({
        content: "You do not have permission to ping that group.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: `<@&${pingGroup.roleId}>: \`${party.name}\` (Use /join ${party.joinCode} to join the party)`,
      allowedMentions: { roles: [pingGroup.roleId] },
    });
  },
};
