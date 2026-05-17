const { SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");
const cooldownAmount = 36000000;
let lastCommandUsage = 0;

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("lfg")
    .setDescription("Ping the Looking For Group role to gather members for your party.")
    .addStringOption((option) =>
      option
        .setName("extra")
        .setDescription("any extra text to add to the ping message")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("schedule a time to ping the Looking For Group role")
        .setRequired(false)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const choices = interaction.client.modules.timeFiltering.filterTimeChoices(focusedValue);

    await interaction.respond(choices);
  },

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
        flags: MessageFlags.Ephemeral,
      });
    }

    const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);

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

    const lfgRole = interaction.guild.roles.cache.get(lfgRoleId) ?? `<@&${lfgRoleId}>`;
    const extra = interaction.options.getString("extra");
    const timeInput = interaction.options.getString("time");
    const escapedExtra = extra;
    let content = `${lfgRole} ${interaction.user} is looking for a group!`;

    if (party) {
      content = `${lfgRole} \`${party.name}\` is looking for members!`;
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
          roleId: lfgRoleId,
          sendAt,
        });
      } catch (error) {
        return interaction.reply({
          content: error.message,
          flags: MessageFlags.Ephemeral,
        });
      }

      lastCommandUsage = now;
      const unixTime = Math.floor(sendAt.getTime() / 1000);
      let scheduledContent = `${lfgRole} ${interaction.user} is looking for a group <t:${unixTime}:R>`;

      if (party) {
        scheduledContent = `${lfgRole} \`${party.name}\` is looking for members <t:${unixTime}:R>`;
      }

      if (escapedExtra) {
        scheduledContent += `\n${escapedExtra}`;
      }

      if (party) {
        scheduledContent += `\n-# Use \`/join ${party.joinCode}\` to join the Discord party`;
      }

      await interaction.reply({
        content: scheduledContent,
        allowedMentions: { roles: [lfgRoleId] },
      });

      const message = await interaction.fetchReply();
      if (message.crosspostable) {
        await message.crosspost();
      }
      return;
    }

    await interaction.reply({
      content,
      // Explicitly allow the LFG role mention
      allowedMentions: { roles: [lfgRoleId] },
    });

    const message = await interaction.fetchReply();
    if (message.crosspostable) {
      await message.crosspost();
    }

    lastCommandUsage = now;
  },
};
