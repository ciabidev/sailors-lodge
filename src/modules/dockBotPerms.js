const { MessageFlags, PermissionsBitField, ContainerBuilder } = require("discord.js");

const NOTICE_COOLDOWN_MS = 10 * 60 * 1000;

const REQUIRED_BOT_PERMISSIONS = [
  { flag: PermissionsBitField.Flags.ViewChannel, label: "View Channel" },
  { flag: PermissionsBitField.Flags.SendMessages, label: "Send Messages" },
  { flag: PermissionsBitField.Flags.ReadMessageHistory, label: "Read Message History" },
  { flag: PermissionsBitField.Flags.ManageWebhooks, label: "Manage Webhooks - For dock networks to function" },
  { flag: PermissionsBitField.Flags.MentionEveryone, label: "Mention all roles - Ping dock roles" },
  { flag: PermissionsBitField.Flags.SendMessagesInThreads, label: "Send Messages in Threads" },
  { flag: PermissionsBitField.Flags.ManageThreads, label: "Manage Threads" },
  { flag: PermissionsBitField.Flags.CreatePublicThreads, label: "Create Threads - auto thread creation for pings in docks" },
];

async function missingLabels(channels) {
  const selectedChannels = Array.isArray(channels) ? channels : [channels];
  const guild = selectedChannels.find(Boolean)?.guild;
  const botMember = guild?.members.me ?? (await guild?.members.fetchMe().catch(() => null));
  if (!botMember) return [];

  return REQUIRED_BOT_PERMISSIONS.filter(
    ({ flag }) => selectedChannels.some((channel) => !channel?.permissionsFor(botMember)?.has(flag)),
  ).map(({ label }) => label);
}

async function sendMissingPermissionNotice(client, channel, options = {}) {
  const thread = options.thread ?? null;
  const fallbackPermissions = options.fallbackPermissions ?? [];
  const userId = options.userId ?? null;
  const missingPermissions = [
    ...(await missingLabels(thread ? [channel, thread] : channel)),
    ...fallbackPermissions,
  ];
  const uniqueMissingPermissions = [...new Set(missingPermissions)].filter(Boolean);
  if (uniqueMissingPermissions.length === 0) return false;

  if (!client.dockPermissionNoticeCooldowns) {
    client.dockPermissionNoticeCooldowns = new Map();
  }

  const noticeChannelId = thread?.id ?? channel?.id ?? userId ?? "unknown";
  const noticeKey = `${noticeChannelId}:${uniqueMissingPermissions.join("|")}`;
  const lastNoticeAt = client.dockPermissionNoticeCooldowns.get(noticeKey) ?? 0;
  if (Date.now() - lastNoticeAt < NOTICE_COOLDOWN_MS) return true;
  client.dockPermissionNoticeCooldowns.set(noticeKey, Date.now());
  setTimeout(() => client.dockPermissionNoticeCooldowns.delete(noticeKey), NOTICE_COOLDOWN_MS);

  const container = new ContainerBuilder().addTextDisplayComponents((text) =>
    text.setContent(
      [
        "### Bot - Missing Permissions",
        `An action failed because I am missing permissions or access${channel?.id ? ` in <#${channel.id}>` : ""}`,
        uniqueMissingPermissions.map((label) => `- ${label}`).join("\n"),`\nIf you're a normal member, please notify your server admin about this`
      ].join("\n"),
    ),
  );

  const payload = {
    components: [container],
    allowedMentions: { parse: [] },
    flags: MessageFlags.IsComponentsV2,
  };

  const noticeTargets = [
    thread?.send ? thread : null,
    channel,
  ].filter(Boolean);

  let notice = null;
  for (const noticeTarget of noticeTargets) {
    notice = await noticeTarget.send(payload).catch(() => null);
    if (notice) break;
  }

  if (!notice && userId) {
    const user = await client.users.fetch(userId).catch(() => null);
    notice = await user?.send(payload).catch(() => null);
  }

  return Boolean(notice);
}

async function check(interaction, channels) {
  const missingPermissions = await missingLabels(channels);
 

  if (missingPermissions.length > 0) {
    const response = {
      content: `I am missing the following permissions:\n${missingPermissions.map((label) => `- ${label}`).join("\n")}`,
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
  REQUIRED_BOT_PERMISSIONS,
  check,
  missingLabels,
  sendMissingPermissionNotice,
};
