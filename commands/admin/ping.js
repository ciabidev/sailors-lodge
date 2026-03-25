const {
  SlashCommandSubcommandGroupBuilder,
  MessageFlags,
  PermissionsBitField,
  ContainerBuilder,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandGroupBuilder()
    .setName("ping")
    .setDescription("Manage Ping Groups with hosts, pings, and channels (e.g. Luck V).")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a Ping group.")
        .addStringOption((option) =>
          option.setName("name").setDescription("The name of the ping group.").setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName("pingrole")
            .setDescription("The role pinged when this group is pinged")
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName("allowedroles")
            .setDescription("The roles allowed to ping this group.")
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName("followedchannel")
            .setDescription(
              "The channel listening for other server's announcement keywords (followed announcements)",
            )
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("keywords")
            .setDescription("Comma-separated keywords for followed pings (optional).")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a ping group.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the ping group.")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Edit a ping group.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the ping group.")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName("pingrole")
            .setDescription("The role pinged when this group is pinged")
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName("allowedroles")
            .setDescription("The role allowed to ping this group.")
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName("followedchannel")
            .setDescription(
              "The channel listening for other server's announcement keywords (followed announcements)",
            )
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("keywords")
            .setDescription("Comma-separated keywords for followed pings (optional).")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all ping groups."),
    ),

  async autocomplete(interaction) {
    if (
      interaction.options.getSubcommand() === "remove" ||
      interaction.options.getSubcommand() === "edit"
    ) {
      // algorithm for autocomplete
      const name = interaction.options.getString("name");
      const settings = await interaction.client.modules.db.getSettings(interaction.guildId);
      const pingGroups = settings.pingGroups ?? [];
      const filtered = pingGroups.filter((group) => group.name.startsWith(name));
      return interaction.respond(filtered.map((group) => ({ name: group.name, value: group.name })));
    }
  },
  async execute(interaction) {
    const { guildId } = interaction;
    const settings = await interaction.client.modules.db.getSettings(guildId);
    const pingGroups = settings.pingGroups;

    // check if permissions
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.options.getSubcommand() === "add") {
      const name = interaction.options.getString("name");
      const role = interaction.options.getRole("pingrole");
      const allowedRole = interaction.options.getRole("allowedroles");
      const followedChannel = interaction.options.getChannel("followedchannel");
      const keywordsRaw = interaction.options.getString("keywords");

      if (!name || !role) {
        return interaction.reply({
          content: "Please provide a name and ping role.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (pingGroups.some((group) => group.name === name)) {
        return interaction.reply({
          content: "A ping group with that name already exists.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const pingGroup = {
        name,
        roleId: role.id,
        allowedRoles: allowedRole ? [allowedRole.id] : [],
        followedChannelId: followedChannel?.id ?? null,
        followedKeywords: keywordsRaw
          ? keywordsRaw
              .split(",")
              .map((keyword) => keyword.trim())
              .filter((keyword) => keyword.length > 0)
          : [],
      };

      pingGroups.push(pingGroup);
      await interaction.client.modules.db.setSettings(guildId, { pingGroups });
      return interaction.reply({
        content: `Ping group ${name} added.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.options.getSubcommand() === "remove") {
      const name = interaction.options.getString("name");

      if (!name) {
        return interaction.reply({
          content: "Please provide a name.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const index = pingGroups.findIndex((group) => group.name === name);

      if (index === -1) {
        return interaction.reply({
          content: "A ping group with that name does not exist.",
          flags: MessageFlags.Ephemeral,
        });
      }

      pingGroups.splice(index, 1);
      await interaction.client.modules.db.setSettings(guildId, { pingGroups });
      return interaction.reply({
        content: `Ping group ${name} removed.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.options.getSubcommand() === "edit") {
      const name = interaction.options.getString("name");
      const role = interaction.options.getRole("pingrole");
      const allowedRole = interaction.options.getRole("allowedroles");
      const followedChannel = interaction.options.getChannel("followedchannel");
      const keywordsRaw = interaction.options.getString("keywords");

      if (!name) {
        return interaction.reply({
          content: "Please provide a name.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const index = pingGroups.findIndex((group) => group.name === name);
      if (index === -1) {
        return interaction.reply({
          content: "A ping group with that name does not exist.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const hasUpdates =
        role || allowedRole || followedChannel || typeof keywordsRaw === "string";
      if (!hasUpdates) {
        return interaction.reply({
          content: "Provide at least one field to update.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const updatedGroup = { ...pingGroups[index] };
      if (role) updatedGroup.roleId = role.id;
      if (allowedRole) updatedGroup.allowedRoles = [allowedRole.id];
      if (followedChannel) updatedGroup.followedChannelId = followedChannel.id;
      if (typeof keywordsRaw === "string") {
        updatedGroup.followedKeywords = keywordsRaw
          .split(",")
          .map((keyword) => keyword.trim())
          .filter((keyword) => keyword.length > 0);
      }

      pingGroups[index] = updatedGroup;
      await interaction.client.modules.db.setSettings(guildId, { pingGroups });
      return interaction.reply({
        content: `Ping group ${name} updated.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.options.getSubcommand() === "list") {
      const pingGroups = settings.pingGroups;
      if (!pingGroups || pingGroups.length === 0) {
        return interaction.reply({
          components: [new TextDisplayBuilder().setContent("No ping groups are set.")],
          flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
        });
      }

      const container = new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent("# Ping Groups"),
      );

      for (const group of pingGroups) {
        const allowedRoles =
          Array.isArray(group.allowedRoles) && group.allowedRoles.length
            ? group.allowedRoles.map((roleId) => `<@&${roleId}>`).join(", ")
            : "None";

        const followedChannel = group.followedChannelId
          ? `<#${group.followedChannelId}>`
          : "None";
        const followedKeywords =
          Array.isArray(group.followedKeywords) && group.followedKeywords.length
            ? group.followedKeywords.join(", ")
            : "None";

        container.addTextDisplayComponents((t) =>
          t.setContent(
            `## ${group.name}\nRole: <@&${group.roleId}>\nAllowed Roles: ${allowedRoles}\nFollowed Channel: ${followedChannel}\nFollowed Keywords: ${followedKeywords}`,
          ),
        );
      }

      return interaction.reply({
        components: [container],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      });
    }
  },
};
