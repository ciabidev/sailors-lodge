const { SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");
module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("ping")
    .setDescription("Ping a Ping Group.")
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("The group to ping")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option.setName("extra").setDescription("any extra text to add to the ping message").setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("schedule a time to ping")
        .setRequired(false)
        .setAutocomplete(true)
    ),
   

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = interaction.options.getFocused();

    if (focusedOption.name === "time") {
      const choices = interaction.client.modules.timeFiltering.filterTimeChoices(focusedValue);
      return interaction.respond(choices);
    }

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
    const extra = interaction.options.getString("extra") ?? "";
    const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);

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

    const pingGroupRole = interaction.guild.roles.cache.get(pingGroup.roleId) ?? `<@&${pingGroup.roleId}>`;

    const allowedRoles = pingGroup.allowedRoles ?? [];
    const hasAllowedRole =
      allowedRoles.length === 0 ||
      allowedRoles.some((roleId) => interaction.member.roles.cache.has(roleId));

    if (!hasAllowedRole) {
      return interaction.reply({
        content: `You don't have permission to ping this ${pingGroup.name}. You need atleast one of the following roles: ${allowedRoles.map(roleId => `<@&${roleId}>`).join(', ')}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const timeInput = interaction.options.getString("time");
    const escapedExtra = extra;
    let content = `${pingGroupRole} ${pingGroup.name} ping from ${interaction.user}`;

    if (party) {
      content = `${pingGroupRole} (${pingGroup.name}) \`${party.name}\` is happening!`;
    }

    if (escapedExtra) {
      content += `\n${escapedExtra}`;
    }

    if (party) {
      content += `\n-# Use \`/join ${party.joinCode}\` to join the Discord party`;
    }

    if (timeInput) {
      const sendAt = interaction.client.modules.timeFiltering.parseTimeInput(timeInput);

      if (!sendAt || Number.isNaN(sendAt.getTime())) {
        return interaction.reply({
          content: "I couldn't understand that scheduled time.",
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        interaction.client.modules.scheduleRolePing(interaction.client, {
          channelId: interaction.channelId,
          content,
          roleId: pingGroup.roleId,
          sendAt,
        });
      } catch (error) {
        return interaction.reply({
          content: error.message,
          flags: MessageFlags.Ephemeral,
        });
      }

      const unixTime = Math.floor(sendAt.getTime() / 1000); // the schedule message will always be a reply to the user so we dont need to mention them
      let scheduledContent = `${pingGroupRole} ${pingGroup.name} **Scheduled** <t:${unixTime}:R>`;

      if (party) {
        scheduledContent = `${pingGroupRole} (${pingGroup.name}) \`${party.name}\` **Scheduled** <t:${unixTime}:R>`;
      }

      if (escapedExtra) {
        scheduledContent += `\n${escapedExtra}`;
      }

      if (party) {
        scheduledContent += `\n-# Use \`/join ${party.joinCode}\` to join the Discord party`;
      }

      await interaction.reply({
        content: scheduledContent,
        allowedMentions: { roles: [pingGroup.roleId] },
      });

      const message = await interaction.fetchReply();
      if (message.crosspostable) {
        await message.crosspost();
      }
      return;
      
    }

    await interaction.reply({
      content: content,
      allowedMentions: { roles: [pingGroup.roleId] },
    });

    const message = await interaction.fetchReply();
    if (message.crosspostable) {
      await message.crosspost();
    }
  },
};
