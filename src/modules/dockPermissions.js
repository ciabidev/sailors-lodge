const { MessageFlags, PermissionsBitField } = require("discord.js");

const REQUIRED_DOCK_PERMISSIONS = [
  { flag: PermissionsBitField.Flags.ViewChannel, label: "View Channel" },
  { flag: PermissionsBitField.Flags.SendMessages, label: "Send Messages" },
  { flag: PermissionsBitField.Flags.ReadMessageHistory, label: "Read Message History" },
  { flag: PermissionsBitField.Flags.ManageWebhooks, label: "Create and Manage Webhooks" },
  { flag: PermissionsBitField.Flags.MentionEveryone, label: "Mention all roles" },
  { flag: PermissionsBitField.Flags.SendMessagesInThreads, label: "Send Messages in Threads" },
  { flag: PermissionsBitField.Flags.ManageThreads, label: "Manage Threads" },
  { flag: PermissionsBitField.Flags.CreatePublicThreads, label: "Create Threads" },
];

const REQUIRED_DOCK_PERMISSION_FLAGS = REQUIRED_DOCK_PERMISSIONS.map(({ flag }) => flag);
async function check(interaction, channels) {
  const selectedChannels = Array.isArray(channels) ? channels : [channels];
  const botMember = interaction.guild?.members.me ?? (await interaction.guild?.members.fetchMe());

  const missingPermissions = REQUIRED_DOCK_PERMISSIONS.filter(
    ({ flag }) => selectedChannels.every((channel) => !channel?.permissionsFor(botMember)?.has(flag)),
  );
 

  if (missingPermissions.length > 0) {
    const response = {
      content: `I am missing one or more of these permissions for these channels/myself:\n${missingPermissions.map(label => `- ${label.label}`).join("\n")}`,
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }

    return false;
  }

    return true;
}

module.exports = {
  REQUIRED_DOCK_PERMISSIONS,
  REQUIRED_DOCK_PERMISSION_FLAGS,
  check,
};
