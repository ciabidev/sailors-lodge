const { MessageFlags, PermissionsBitField } = require("discord.js");

const REQUIRED_FEED_PERMISSIONS = [
  { flag: PermissionsBitField.Flags.ViewChannel, label: "View Channel" },
  { flag: PermissionsBitField.Flags.SendMessages, label: "Send Messages" },
  { flag: PermissionsBitField.Flags.ReadMessageHistory, label: "Read Message History" },
  { flag: PermissionsBitField.Flags.ManageWebhooks, label: "Create and Manage Webhooks" },
  { flag: PermissionsBitField.Flags.MentionEveryone, label: "Mention all roles" },
  { flag: PermissionsBitField.Flags.SendMessagesInThreads, label: "Send Messages in Threads" },
  { flag: PermissionsBitField.Flags.ManageThreads, label: "Manage Threads" },
  { flag: PermissionsBitField.Flags.CreatePublicThreads, label: "Create Threads" },
];

const REQUIRED_FEED_PERMISSION_FLAGS = REQUIRED_FEED_PERMISSIONS.map(({ flag }) => flag);
const REQUIRED_FEED_PERMISSION_LABELS = REQUIRED_FEED_PERMISSIONS.map(
  ({ label }) => `- ${label}`,
).join("\n");

async function check(interaction, channels) {
  const selectedChannels = Array.isArray(channels) ? channels : [channels];
  const botMember = interaction.guild?.members.me ?? (await interaction.guild?.members.fetchMe());

  const hasRequiredPermissions = selectedChannels.every((channel) =>
    botMember && channel?.permissionsFor(botMember)?.has(REQUIRED_FEED_PERMISSION_FLAGS),
  );

  if (hasRequiredPermissions) return true;

  const response = {
    content: `I am missing one or more of these permissions for these channels/myself:\n${REQUIRED_FEED_PERMISSION_LABELS}`,
    flags: MessageFlags.Ephemeral,
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(response);
  } else {
    await interaction.reply(response);
  }

  return false;
}

module.exports = {
  REQUIRED_FEED_PERMISSIONS,
  check,
};
