const { SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");
// a really messy command, honestly dont know how this still works lol
function buildPingText({ name, user, party, extra, sendAt }) {
  const lines = [
    `**${name}** ping from ${user}${sendAt ? ` **Scheduled** <t:${Math.floor(sendAt.getTime() / 1000)}:R>` : ""}`,
  ];

  if (party) {
    lines.push(`\`${party.name}\` is happening!`);
  }

  if (extra) {
    lines.push(extra);
  }

  if (party) {
    lines.push(`-# Use \`/join ${party.joinCode}\` to join the Discord party`);
  }

  return lines.join("\n");
}

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("ping")
    .setDescription("Ping a configured role group or Dock keyword.")
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("The group or ⚓ Dock keyword to ping")
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
    const groupChoices = pingGroups
      .filter((group) => group.name.toLowerCase().startsWith(focusedValue.toLowerCase()))
      .map((group) => ({ name: group.name, value: group.name }));
    const dockChoices = await interaction.client.modules.dockKeywordPings.getChoices(
      interaction,
      focusedValue,
    );
    const filtered = [...groupChoices, ...dockChoices].slice(0, 25);

    return interaction.respond(filtered);
  },

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Ping groups can only be used in a Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }
    const roleValue = interaction.options.getString("role");
    const extra = interaction.options.getString("extra") ?? "";
    const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
    const timeInput = interaction.options.getString("time");
    const dockPings = interaction.client.modules.dockKeywordPings;

    const dockPing = await dockPings.resolveChoice(interaction, roleValue);
    if (dockPing) {
      if (dockPing.error) {
        return interaction.reply({
          content: dockPing.error,
          flags: MessageFlags.Ephemeral,
        });
      }

      const { dock, sendingFollower, keyword } = dockPing;
      const dockEntries = [{ dock, sendingFollower, keyword }];
      const escapedExtra = extra;
      const content = buildPingText({
        name: interaction.client.modules.escapeMarkdown(dock.name),
        user: interaction.user,
        party,
        extra: escapedExtra,
      });

      const roleIds = dockPings.getRoleIds(interaction.client, dockEntries);
      const pingOwnServer = dockPings.shouldPingOwnServer(dockEntries);
      const roleMentions =
        pingOwnServer ? interaction.client.modules.mentions.formatRoleMentions(roleIds) : "";
      const allowedRoleIds = pingOwnServer ? roleIds : [];
      const pingContent = `${roleMentions} ${content}`.trim();

      if (timeInput) {
        const sendAt = interaction.client.modules.timeFiltering.parseTimeInput(timeInput);

        if (!sendAt || Number.isNaN(sendAt.getTime())) {
          return interaction.reply({
            content: "I couldn't understand that scheduled time.",
            flags: MessageFlags.Ephemeral,
          });
        }

        try {
          interaction.client.modules.schedulePing(interaction.client, {
            channelId: interaction.channelId,
            content: pingContent,
            roleIds: allowedRoleIds,
            sendAt,
            afterSend: async (message) => {
              dockPings.remember(interaction.client, message.id, dockEntries);
              await interaction.client.modules.dockRelay.relayMessage(
                message,
                { content, sendAsBot: true },
                sendingFollower,
              );
            },
          });
        } catch (error) {
          return interaction.reply({
            content: error.message,
            flags: MessageFlags.Ephemeral,
          });
        }

        const scheduledContent = buildPingText({
          name: interaction.client.modules.escapeMarkdown(dock.name),
          user: interaction.user,
          party,
          extra: escapedExtra,
          sendAt,
        });

        await interaction.reply({
          content: `${roleMentions} ${scheduledContent}`.trim(),
          allowedMentions: { roles: allowedRoleIds },
        });

        const message = await interaction.fetchReply();
        if (message.crosspostable) {
          await message.crosspost();
        }
        return;
      }

      await interaction.reply({
        content: pingContent,
        allowedMentions: { roles: allowedRoleIds },
      });

      const message = await interaction.fetchReply();
      dockPings.remember(interaction.client, message.id, dockEntries);
      await interaction.client.modules.dockRelay.relayMessage(
        message,
        { content, sendAsBot: true },
        sendingFollower,
      );
      return;
    }

    const settings = await interaction.client.modules.db.getSettings(interaction.guildId);
    const pingGroups = settings.pingGroups ?? [];
    const pingGroup = pingGroups.find(
      (group) => group.name.toLowerCase() === roleValue.toLowerCase(),
    );

    if (!pingGroup) {
      return interaction.reply({
        content: "That ping group does not exist.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const roleMention = interaction.guild.roles.cache.get(pingGroup.roleId) ?? `<@&${pingGroup.roleId}>`;

    const allowedRoles = pingGroup.allowedRoles ?? [];
    const hasAllowedRole =
      allowedRoles.length === 0 ||
      dockPings.hasHostRole(interaction.member, allowedRoles);

    if (!hasAllowedRole) {
      return interaction.reply({
        content: `You don't have permission to ping this ${pingGroup.name}. You need atleast one of the following roles: ${allowedRoles.map(roleId => `<@&${roleId}>`).join(', ')}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const escapedExtra = extra;
    const content = buildPingText({
      name: interaction.client.modules.escapeMarkdown(pingGroup.name),
      user: interaction.user,
      party,
      extra: escapedExtra,
    });

    if (timeInput) {
      const sendAt = interaction.client.modules.timeFiltering.parseTimeInput(timeInput);

      if (!sendAt || Number.isNaN(sendAt.getTime())) {
        return interaction.reply({
          content: "I couldn't understand that scheduled time.",
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        interaction.client.modules.schedulePing(interaction.client, {
          channelId: interaction.channelId,
          content: `${roleMention} ${content}`,
          roleId: pingGroup.roleId,
          sendAt,
        });
      } catch (error) {
        return interaction.reply({
          content: error.message,
          flags: MessageFlags.Ephemeral,
        });
      }

      const scheduledContent = buildPingText({
        name: interaction.client.modules.escapeMarkdown(pingGroup.name),
        user: interaction.user,
        party,
        extra: escapedExtra,
        sendAt,
      });

      await interaction.reply({
        content: `${roleMention} ${scheduledContent}`,
        allowedMentions: { roles: [pingGroup.roleId] },
      });

      const message = await interaction.fetchReply();
      if (message.crosspostable) {
        await message.crosspost();
      }
      return;
      
    }

    await interaction.reply({
      content: `${roleMention} ${content}`,
      allowedMentions: { roles: [pingGroup.roleId] },
    });
  },
};
