const {
  EmbedBuilder,
  MessageFlags,
  SlashCommandSubcommandBuilder,
} = require("discord.js");

const NOTICE_TYPES = {
  update: {
    label: "Developer Update",
    icon: "📣",
    color: 0x5865f2,
  },
  maintenance: {
    label: "Maintenance Notice",
    icon: "🛠️",
    color: 0xfee75c,
  },
  incident: {
    label: "Service Alert",
    icon: "🚨",
    color: 0xed4245,
  },
};

async function isDeveloper(interaction) {
  const configuredDeveloperIds = (process.env.DEVELOPER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (configuredDeveloperIds.includes(interaction.user.id)) return true;

  const application = await interaction.client.application.fetch();
  const owner = application.owner;
  if (!owner) return false;

  // Team-owned applications expose a members collection; user-owned apps expose a user.
  return owner.members
    ? owner.members.has(interaction.user.id)
    : owner.id === interaction.user.id;
}

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("devannounce")
    .setDescription("Broadcast an official developer notice to every Dock.")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The announcement body.")
        .setMaxLength(4000)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The kind of notice being published.")
        .addChoices(
          { name: "Developer update", value: "update" },
          { name: "Maintenance", value: "maintenance" },
          { name: "Service alert", value: "incident" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("An optional custom headline.")
        .setMaxLength(200),
    ),

  async execute(interaction) {
    if (!(await isDeveloper(interaction))) {
      return interaction.reply({
        content: "Only an authorized Sailors Lodge developer can use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const message = interaction.options.getString("message", true);
    const type = interaction.options.getString("type") ?? "update";
    const notice = NOTICE_TYPES[type];
    const title = interaction.options.getString("title") ?? notice.label;
    const botAvatar = interaction.client.user.displayAvatarURL();

    const embed = new EmbedBuilder()
      .setColor(notice.color)
      .setAuthor({
        name: "Sailors Lodge • Official Developer Notice",
        iconURL: botAvatar,
      })
      .setTitle(`${notice.icon} ${title}`)
      .setDescription(message)
      .addFields({
        name: "Published by",
        value: `${interaction.user} • Sailors Lodge Development Team`,
      })
      .setFooter({
        text: "This notice was broadcast through the official Sailors Lodge bot.",
        iconURL: botAvatar,
      })
      .setTimestamp();

    const docks = await interaction.client.modules.db.getDocks();
    let sent = 0;
    let failed = 0;

    for (const dock of docks) {
      try {
        await interaction.client.modules.dockRelay.relayAlert({
          client: interaction.client,
          dockId: dock._id,
          embeds: [embed],
          allowedMentions: { parse: [] },
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`[devannounce] Failed to broadcast to Dock ${dock._id}:`, error);
      }
    }

    const failureSummary = failed ? ` ${failed} failed; check the bot logs.` : "";
    return interaction.editReply(
      `Official developer notice broadcast to ${sent} Dock${sent === 1 ? "" : "s"}.${failureSummary}`,
    );
  },
};
