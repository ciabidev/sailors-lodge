const {
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  ActionRowBuilder,
  MessageFlags,
  ChannelType,
  Events,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require("discord.js");
const Sentry = require("@sentry/node");
const { ObjectId } = require("mongodb");
const {
  buildReportErrorComponents,
  captureError,
  reportError,
} = require("../src/reportError");
const { buildBugReportModal } = require("../commands/utility/bugreport");

const issues = process.env.ISSUES_URL ?? process.env.ISSUES;
const { browsePages: dockBrowsePages } = require("../commands/dock/browse");
const { model } = require("mongoose");
const { managePages: dockManagePages } = require("../commands/dock/manage");

// modal submission and button clicks survive through restarts
module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const client = interaction.client;

    // ✅ Handle autocomplete first
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        captureError(error, {
          source: "autocomplete",
          tags: { command: interaction.commandName },
        });
        await interaction.respond([]).catch(() => {});
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      console.log(`[modal-submit] ${interaction.customId}`);
      let modalId;
      let dockId;
      let partyId;
      let dmFlag;

      if (interaction.customId.startsWith("bug-report-modal")) {
        const [, linkedEventId = ""] = interaction.customId.split(":");
        const goal = interaction.fields.getTextInputValue("goal").trim();
        const description = interaction.fields.getTextInputValue("description").trim();
        const steps = interaction.fields.getTextInputValue("steps").trim();
        const enteredEventId = interaction.fields.getTextInputValue("error_id").trim();
        const associatedEventId = linkedEventId || enteredEventId;
        const contactName = interaction.fields.getTextInputValue("contact_name").trim();

        if (associatedEventId && !/^[a-f\d]{32}$/i.test(associatedEventId)) {
          return interaction.reply({
            content: "That error ID is invalid. It should contain exactly 32 letters and numbers.",
            flags: [MessageFlags.Ephemeral],
          });
        }

        const message = [
          `What they were trying to do:\n${goal}`,
          `What went wrong:\n${description}`,
          steps ? `Steps to reproduce:\n${steps}` : null,
        ]
          .filter(Boolean)
          .join("\n\n");

        const feedbackId = Sentry.captureFeedback({
          message,
          name: contactName || undefined,
          source: "sailors-lodge",
          associatedEventId: associatedEventId || undefined,
          tags: {
            command: "bugreport",
            linked_error: Boolean(associatedEventId),
          },
        });

        return interaction.reply({
          content: `Thanks, your bug report was submitted. Report ID: \`${feedbackId}\``,
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (interaction.customId === "docks-browse-search-modal") {
        const search = interaction.fields.getTextInputValue("search");
        return interaction.client.modules.updateDockBrowsePage(interaction, { search });
      }
      if (interaction.customId === "docks-manage-search-modal") {
        const search = interaction.fields.getTextInputValue("search");
        return interaction.client.modules.updateDockManagePage(interaction, { search });
      }
      if (interaction.customId.startsWith("dock-ban-modal:")) {
        const [, dockId, followerGuildId] = interaction.customId.split(":");
        return interaction.client.modules.dockBans.banFollower(
          interaction,
          dockId,
          followerGuildId,
          interaction.fields.getTextInputValue("reason"),
        );
      }

      [modalId, partyId, dmFlag] = interaction.customId.split(":");
      if (modalId === "party-modal") {
        const name = interaction.fields.getTextInputValue("name");
        const description = interaction.fields.getTextInputValue("description") || "";
        const selectedStatus = interaction.fields.getStringSelectValues("status")[0];
        const status = ["not-started", "starting", "active"].includes(selectedStatus)
          ? selectedStatus
          : "not-started";
        const memberLimit = parseInt(interaction.fields.getTextInputValue("limit")) || 10;
        const visibility = interaction.fields.getStringSelectValues("visibility")[0];

        if (!partyId) {
          // CREATE branch
          const party = await interaction.client.modules.db.createParty(
            name,
            description,
            status,
            visibility,
            memberLimit,
            interaction.user,
          );

          // Send the party card (DM or channel)
          let dm = dmFlag === "true";
          let message;

          if (dm) {
            await interaction.reply({
              content: "Party card will be sent to you in DM",
              flags: [MessageFlags.Ephemeral],
            });
            message = await interaction.user.send({
              components: await interaction.client.modules.renderPartyCard(party, interaction),
              flags: [MessageFlags.IsComponentsV2],
              withResponse: true,
            });
          } else {
            const response = await interaction.reply({
              components: await interaction.client.modules.renderPartyCard(party, interaction),
              flags: [MessageFlags.IsComponentsV2],
              withResponse: true,
            });
            message = response.resource.message;
          }

          // Store message in DB
          await interaction.client.modules.db.addPartyCardMessage(party._id, {
            channelId: message.channelId,
            messageId: message.id,
            userId: interaction.user.id,
            guildId: interaction.guildId,
          });
          await interaction.client.modules.sendPartyTip(interaction.user);
        } else {
          // EDIT branch
          const party = await interaction.client.modules.db.getParty(new ObjectId(partyId));

          if (!party) {
            return interaction.reply({
              content: "This party does not exist.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          if (interaction.user.id !== party.host.id) {
            return interaction.reply({
              content: "Only the leader can submit this.",
              flags: [MessageFlags.Ephemeral],
            });
          }

          const updatedParty = await interaction.client.modules.db.updateParty(
            party._id,
            { $set: { name, description, status, memberLimit, visibility } },
            interaction,
          );

          try {
            await interaction.update({
              components: await interaction.client.modules.renderPartyCard(
                updatedParty,
                interaction,
              ),
            }); // edit and delete have been made into commands and are no longer buttons, this is just here in case we bring them back
          } catch (err) {
            if (err.code === 10008) {
              // error if used from a command
              interaction.reply({
                content: "Party updated successfully!",
                flags: [MessageFlags.Ephemeral],
              });
            } else {
              throw err;
            }
          }

          await interaction.client.modules.updatePartyCards(interaction, updatedParty);
        }
      }

      [modalId, dockId] = interaction.customId.split(":");
      if (modalId === "dock-publish-modal") {
        const [accessModeRaw, publishModeRaw] = interaction.fields
          .getStringSelectValues("dock-visibility")[0]
          .split("-");
        const publishMode = ["all", "manual"].includes(publishModeRaw) ? publishModeRaw : "all";
        const accessMode = ["open", "request"].includes(accessModeRaw) ? accessModeRaw : "open";
        const name = interaction.fields.getTextInputValue("name");
        const description = interaction.fields.getTextInputValue("description") || "";
        const keywordsRaw = interaction.fields.getTextInputValue("keywords") || "";
        const keywords = keywordsRaw
          .split(/[\n,]/)
          .map((keyword) => keyword.trim())
          .filter((keyword) => keyword.length > 0);
        const channels = interaction.fields.getSelectedChannels("channels", true, [
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
        ]);

        if (keywords.length > 25) {
          return interaction.reply({
            content: "You can only have up to 25 keywords.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const selectedChannels = Array.from(channels.values());
        const channelIds = selectedChannels.map((channel) => channel.id);

        if (!(await interaction.client.modules.dockBotPerms.check(interaction, selectedChannels))) {
          return;
        }

        for (const channelId of channelIds) {
          const docks = await interaction.client.modules.db.getDocksFromChannelId(channelId);
          const conflictingDock = docks.find((dock) => !dockId || dock._id.toString() !== dockId);
          if (conflictingDock) {
            return interaction.reply({
              content: `<#${channelId}> is already the source channel for another Dock.`,
              flags: MessageFlags.Ephemeral,
            });
          }

          const dockFollowers =
            await interaction.client.modules.db.getDockFollowsForChannel(channelId);
          const existingFollower = dockFollowers.find(
            (dockFollower) =>
              !dockId ||
              dockFollower.dockId.toString() !== dockId ||
              dockFollower.guildId !== interaction.guildId,
          );
          if (existingFollower) {
            return interaction.reply({
              content: `<#${channelId}> is already following another Dock. Choose a channel that is not following any Docks yet.`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }

        if (dockId) {
          const dock = await interaction.client.modules.db.getDock(dockId);

          if (!dock || dock.guildId !== interaction.guildId) {
            return interaction.reply({
              content: "I couldn't find that Dock in this Discord server.",
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.client.modules.db.updateDock(dockId, {
            $set: {
              name,
              guildId: interaction.guildId,
              guildName: interaction.guild.name,
              channelIds,
              description,
              keywords,
              publishMode,
              accessMode,
            },
            $unset: {
              channelNames: "",
            },
          });
          await interaction.client.modules.db.setDockFollower(dockId, interaction.guildId, {
            guildName: interaction.guild.name,
            channelIds,
            keywordPings: {},
          });

          return interaction.client.modules.updateDockManagePage(interaction);
        }

        const createdDock = await interaction.client.modules.db.createDock(
          name,
          interaction.guildId,
          interaction.guild.name,
          channelIds,
          description,
          keywords,
          publishMode,
          accessMode,
        );
        await interaction.client.modules.db.setDockFollower(
          createdDock.insertedId,
          interaction.guildId,
          {
            guildName: interaction.guild.name,
            channelIds,
            keywordPings: {},
          },
        );

        return interaction.reply({
          content: `Published ${selectedChannels.length} Channel(s): ${selectedChannels
            .map((channel) => `<#${channel.id}>`)
            .join(
              ", ",
            )}. \nPlease use \`/dock manage\` to configure your Home Ping Roles, Default Permission Levels and more. `,
          flags: MessageFlags.Ephemeral,
        });
      }

      [modalId, dockId] = interaction.customId.split(":");
      if (modalId === "dock-follow-modal" || modalId === "dock-configure-follower") {
        const isManagingDocks = modalId === "dock-configure-follower";
        const channels = interaction.fields.getSelectedChannels("dock-follow-channel", true, [
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
        ]);
        const [channelId] = channels.keys();
        const [channel] = channels.values();
        const hasKeywordField = interaction.fields.fields.has("keyword");
        const keyword = hasKeywordField
          ? interaction.fields.getStringSelectValues("keyword")[0]
          : null;
        const selectedRoles = hasKeywordField ? interaction.fields.getSelectedRoles("roles", false) : null;
        const roleIds = selectedRoles ? Array.from(selectedRoles.keys()) : [];

        if (!(await interaction.client.modules.dockBotPerms.check(interaction, channel))) {
          return;
        }
        const existingFollower = await interaction.client.modules.db.getDockFollower(
          dockId,
          interaction.guildId,
        );

        if (existingFollower?.banned) {
          return interaction.reply({
            content: "This server is banned from following that Dock.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const currentKeywordPings = Array.isArray(existingFollower?.keywordPings)
          ? {}
          : { ...(existingFollower?.keywordPings ?? {}) };
        if (keyword) currentKeywordPings[keyword] = roleIds;

        if (
          !isManagingDocks &&
          interaction.client.modules.dockLevels.canRead(existingFollower)
        ) {
          return interaction.reply({
            content: "This server is already following this Dock.",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (isManagingDocks && !existingFollower) {
          return interaction.reply({
            content: "This server is not following that Dock anymore.",
            flags: MessageFlags.Ephemeral,
          });
        }

        // receiving channels can share docks, but source channels stay separate to avoid cross-publishing
        const docks = await interaction.client.modules.db.getDocksFromChannelId(channelId);
        if (docks.length > 0) {
          return interaction.reply({
            content: `<#${channelId}> is already the source channel for docks: ${docks.map((dock) => interaction.client.modules.escapeMarkdown(dock.name)).join(", ")}. Choose a channel that is not used by Docks yet.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        const dock = await interaction.client.modules.db.getDock(dockId);
        if (!dock) {
          return interaction.reply({
            content: "I couldn't find that Dock anymore.",
            flags: MessageFlags.Ephemeral,
          });
        }

        await interaction.client.modules.db.setDockFollower(dockId, interaction.guildId, {
          guildName: interaction.guild.name,
          channelIds: [channelId],
          keywordPings: currentKeywordPings,
          level: isManagingDocks
            ? undefined
            : dock.accessMode === "request"
              ? "no-access"
              : interaction.client.modules.dockLevels.normalize(dock.defaultLevel),
        });
        if (!isManagingDocks) {
           await interaction.client.modules.updateDockBrowsePage(interaction);
        } else {
          await interaction.client.modules.updateDockManagePage(interaction)
        }
        const container = new ContainerBuilder();
        const escapedDockName = interaction.client.modules.escapeMarkdown(dock.name);
        const escapedGuildName = interaction.client.modules.escapeMarkdown(interaction.guild.name);
        try {
          if (dock.accessMode === "open") {
            container.addTextDisplayComponents((t) =>
              t.setContent(
                `### 🌐 New follower\n**${escapedGuildName}** is now following **${escapedDockName}**.\n\n-# Access level: ${interaction.client.modules.dockLevels.get(dock.defaultLevel).label}`,
              ),
            );
            if (!isManagingDocks) {
              interaction.client.modules.dockRelay.relayAlert({
                client: interaction.client,
                dockId,
                components: [container],
                flags: MessageFlags.IsComponentsV2,
              });
              
            }

          } else {
            const gatekeeperRoleId = dock.gatekeeperRoleId;
            const requester = `${interaction.user} [${interaction.client.modules.escapeMarkdown(interaction.user.username)}]`;
            
            container.addTextDisplayComponents((t) =>
              t.setContent(
                `### 📨 New follow request\n**${escapedGuildName}** wants to follow **${escapedDockName}**.`,
              ),
            );
            container.addTextDisplayComponents((t) =>
              t.setContent(
                `**Requested by:** ${requester}\n**Receiving channel:** ${channel.name}${gatekeeperRoleId ? `\n\n-# Gatekeepers: <@&${gatekeeperRoleId}>` : ""}`,
              ),
            );
            const actionRow =
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`dock-follow-request:accept:${dockId}:${interaction.guildId}`)
                  .setLabel("Approve")
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId(`dock-follow-request:deny:${dockId}:${interaction.guildId}`)
                  .setLabel("Deny")
                  .setStyle(ButtonStyle.Danger),
              );

            await interaction.client.modules.dockRelay.relayAlert({
              client: interaction.client,
              dockId,
              components: [container, actionRow],
              flags: MessageFlags.IsComponentsV2,
              guildIds: [dock.guildId],
            });
            
            await interaction.followUp({
              content: "Follow request sent.",
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch (err) {
          await reportError(err, {
            source: "modal-submit",
            context: interaction,
            tags: { modal: interaction.customId },
          });
        }

        return;
      }

      [modalId, dockId] = interaction.customId.split(":");
      if (modalId === "dock-home-ping-roles") {
        const dock = await interaction.client.modules.db.getDock(dockId);

        if (!dock || dock.guildId !== interaction.guildId) {
          return interaction.reply({
            content: "I couldn't find that Dock in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const selfFollow = await interaction.client.modules.db.getDockFollower(
          dockId,
          interaction.guildId,
        );
        if (!selfFollow) return;

        // set keyword pings
        const channelIds = selfFollow?.channelIds?.length ? selfFollow.channelIds : dock.channelIds;
        let keywords
        let roles
        if (dock.keywords?.length > 0) {
          keywords = interaction.fields.getStringSelectValues("keyword", false);
          roles = interaction.fields.getSelectedRoles("roles", false);
          const roleIds = roles ? [...roles.keys()] : [];
          const keywordPings = Array.isArray(selfFollow.keywordPings)
            ? {}
            : { ...(selfFollow.keywordPings ?? {}) };
          keywords.forEach((keyword) => {
            keywordPings[keyword] = roleIds;
          });

          await interaction.client.modules.db.setDockFollower(dockId, interaction.guildId, {
            guildName: interaction.guild.name,
            channelIds,
            keywordPings,
          });
        }
     
        
        console.log( interaction.fields.getSelectedRoles("gatekeeper"))
        // set gatekeeper role
        const gatekeeperRole = interaction.fields.getSelectedRoles("gatekeeper")
        const gatekeeperRoleId = gatekeeperRole ? [...gatekeeperRole.keys()][0] : null;
        if (gatekeeperRoleId) {
          await interaction.client.modules.db.updateDock(dockId, {
            $set: {
              gatekeeperRoleId,
            },
          });
        }

        await interaction.client.modules.updateDockManagePage(interaction);
      }

      [modalId, dockId] = interaction.customId.split(":");
      if (modalId === "dock-default-level") {
        const dock = await interaction.client.modules.db.getDock(dockId);

        if (
          !dock ||
          !(await interaction.client.modules.dockLevels.guildCanManage(
            interaction.client,
            dock,
            interaction.guildId,
          ))
        ) {
          return interaction.reply({
            content: "I couldn't find that Dock in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }
        const level = interaction.fields.getStringSelectValues("level")[0];
        const levelDetails = interaction.client.modules.dockLevels.get(level);
        await interaction.client.modules.db.updateDock(dockId, {
          $set: {
            defaultLevel: level,
          },
        });
        interaction.reply({
            content: "Default access updated.",
            flags: MessageFlags.Ephemeral,
          });
        return interaction.client.modules.dockRelay.relayAlert({
          client: interaction.client,
          dockId,
          components: [
            new ContainerBuilder().addTextDisplayComponents((t) =>
              t.setContent(
                `### ⚙️ Default access updated\nThe default access level for **${interaction.client.modules.escapeMarkdown(dock.name)}** is now **${levelDetails.label}**.\n\n-# Updated by ${interaction.client.modules.escapeMarkdown(interaction.guild.name)}`,
              ),
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }
    async function handlePartyButton(interaction) {
      const btn = interaction;
      let [action, partyId] = btn.customId.split(":");
      if (partyId) {
        let party = await btn.client.modules.db.getParty(new ObjectId(partyId));
        switch (action) {
          // edit and delete have been made into commands and are no longer buttons, this is just here in case we bring them back
          case "party-edit":
            await btn.client.modules.editParty(btn, party);
            break;

          case "party-delete":
            await btn.client.modules.deleteParty(btn, party);
            break;
          case "party-join":
            await btn.client.modules.joinParty(btn, party.joinCode);
            break;
          case "party-leave":
            await btn.client.modules.leaveParty(btn, party);
            break;
          case "party-card-refresh":
            const updatedParty = await btn.client.modules.db.getPartyFromJoinCode(party.joinCode);
            const updatedCard = await btn.client.modules.renderPartyCard(updatedParty, btn);
            await btn.deferUpdate();
            await btn.editReply({
              components: [...updatedCard],
            });
            break;
          case "party-delete-confirm":
            await btn.update({
              components: [new TextDisplayBuilder().setContent("Deleting party...")],
            });
            await btn.client.modules.db.deleteParty(party._id, btn);
            btn.editReply({
              components: [new TextDisplayBuilder().setContent("Party deleted.")],
            });
            party = await btn.client.modules.db.getParty(new ObjectId(partyId));
            await btn.client.modules.updatePartyCards(btn, party);
            break;
          case "party-delete-cancel":
            await btn.editReply({
              components: [new TextDisplayBuilder().setContent("Cancelled.")],
            });
            break;
        }
      }
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("dock-set-follower-level")
    ) {
      const [, dockId, guildId] = interaction.customId.split(":");
      const newLevel = interaction.values[0];
      const dock = await interaction.client.modules.db.getDock(dockId);

      if (
        !dock ||
        !(await interaction.client.modules.dockLevels.guildCanManage(
          interaction.client,
          dock,
          interaction.guildId,
        ))
      ) {
        return interaction.reply({
          content: "I couldn't find that Dock in this Discord server.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const follower = await interaction.client.modules.db.getDockFollower(dockId, guildId);
      if (!follower || follower.banned || follower.guildId === dock.guildId) {
        return interaction.reply({
          content: "I couldn't find that follower anymore.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const guild = await interaction.client.guilds.fetch(follower.guildId).catch(() => null);
      const dockLevels = interaction.client.modules.dockLevels;
      const levelDetails = dockLevels.get(newLevel);
      const followerGuildName = interaction.client.modules.escapeMarkdown(
        guild?.name ?? follower.guildName ?? follower.guildId,
      );

      await interaction.client.modules.db.setDockFollower(dockId, guildId, { level: newLevel });
      const followers = (await interaction.client.modules.db.getDockFollowers(dockId))
        .filter((dockFollower) => dockFollower.guildId !== dock.guildId)
        .sort((a, b) => (a.guildName ?? "").localeCompare(b.guildName ?? ""));
      const pages = interaction.client.modules.chunkArray(followers, 3);
      const state = dockManagePages.get(interaction.user.id);
      if (!state) return;

      state.followerManager = {
        dock,
        pages,
        pageIndex: Math.min(state.followerManager?.pageIndex ?? 0, Math.max(pages.length - 1, 0)),
      };

      await interaction.update({
        components: interaction.client.modules.manageFollowersPage({
          dock,
          pages,
          pageIndex: state.followerManager.pageIndex,
          client: interaction.client,
        }),
      });

      if (newLevel !== follower.level) {
        await interaction.client.modules.dockRelay.relayAlert({
          client: interaction.client,
          dockId,
          components: [
            new ContainerBuilder().addTextDisplayComponents((text) =>
              text.setContent(
                `### 🛡️ Follower access updated\n**${followerGuildName}** now has **${levelDetails.label}** access to **${interaction.client.modules.escapeMarkdown(dock.name)}**.\n\n-# ${levelDetails.description} • Updated by ${interaction.client.modules.escapeMarkdown(interaction.guild.name)}`,
              ),
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      await interaction.followUp({
        content: `**${followerGuildName}** now has **${levelDetails.label}** access to **${interaction.client.modules.escapeMarkdown(dock.name)}**`,
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    if (interaction.isButton()) {
      const buttonId = interaction.customId;
      let [action] = buttonId.split(":");

      if (buttonId.startsWith("report-error:")) {
        const [, eventId] = buttonId.split(":");
        return interaction.showModal(buildBugReportModal(eventId));
      }

      if (buttonId === "docks-browse-search") {
        const state = dockBrowsePages.get(interaction.user.id);
        if (!state) return interaction.client.modules.updateDockBrowsePage(interaction);

        const searchInput = new TextInputBuilder()
          .setCustomId("search")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Dock name, publisher, or channel")
          .setRequired(false);
        if (state.search) searchInput.setValue(state.search);

        return interaction.showModal(
          new ModalBuilder()
            .setCustomId("docks-browse-search-modal")
            .setTitle("Search Docks")
            .addLabelComponents(
              new LabelBuilder().setLabel("Search").setTextInputComponent(searchInput),
            ),
        );
      }

      if (buttonId === "docks-browse-search-clear") {
        return interaction.client.modules.updateDockBrowsePage(interaction, { search: "" });
      }

      if (buttonId === "docks-manage-search") {
        const state = dockManagePages.get(interaction.user.id);
        if (!state) return interaction.client.modules.updateDockManagePage(interaction);

        const searchInput = new TextInputBuilder()
          .setCustomId("search")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Dock name, publisher, or channel")
          .setRequired(false);
        if (state.search) searchInput.setValue(state.search);

        return interaction.showModal(
          new ModalBuilder()
            .setCustomId("docks-manage-search-modal")
            .setTitle("Search Managed Docks")
            .addLabelComponents(
              new LabelBuilder().setLabel("Search").setTextInputComponent(searchInput),
            ),
        );
      }

      if (buttonId === "docks-manage-search-clear") {
        return interaction.client.modules.updateDockManagePage(interaction, { search: "" });
      }

      if (buttonId === "docks-prev" || buttonId === "docks-next") {
        const state = dockBrowsePages.get(interaction.user.id);
        if (!state) return interaction.client.modules.updateDockBrowsePage(interaction);

        const pageCount = Math.max(state.pageCount, 1);
        const pageIndex =
          buttonId === "docks-prev"
            ? (state.pageIndex - 1 + pageCount) % pageCount
            : (state.pageIndex + 1) % pageCount;

        return interaction.client.modules.updateDockBrowsePage(interaction, { pageIndex });
      }

      if (buttonId === "docks-manage-prev" || buttonId === "docks-manage-next") {
        let state = dockManagePages.get(interaction.user.id);
        if (!state) return interaction.client.modules.updateDockManagePage(interaction);

        const pageCount = Math.max(state.pageCount ?? 1, 1);
        const pageIndex =
          buttonId === "docks-manage-prev"
            ? (state.pageIndex - 1 + pageCount) % pageCount
            : (state.pageIndex + 1) % pageCount;

        return interaction.client.modules.updateDockManagePage(interaction, { pageIndex });
      }

      if (buttonId === "dock-manage-followers-prev" || buttonId === "dock-manage-followers-next") {
        let state = dockManagePages.get(interaction.user.id);
        if (!state?.followerManager) return;

        const pageCount = Math.max(state.followerManager.pages.length, 1);
        state.followerManager.pageIndex =
          buttonId === "dock-manage-followers-prev"
            ? (state.followerManager.pageIndex - 1 + pageCount) % pageCount
            : (state.followerManager.pageIndex + 1) % pageCount;

        await interaction.update({
          components: interaction.client.modules.manageFollowersPage({
            dock: state.followerManager.dock,
            pages: state.followerManager.pages,
            pageIndex: state.followerManager.pageIndex,
            client: interaction.client,
          }),
          flags: interaction.message.flags,
        });

        return;
      }

      if (buttonId === "dock-manage-followers-back") {
        await interaction.client.modules.updateDockManagePage(interaction, { resetPage: true });

        return;
      }

      if (buttonId.startsWith("dock-follow:")) {
        let [, dockId] = buttonId.split(":");
        let dock = await interaction.client.modules.db.getDock(dockId);
        let accessMode = dock?.accessMode ?? "open";

        if (interaction.inGuild()) {
          await interaction.client.modules.dockFollowModal(interaction, dockId);
          return;
        }
      }

      if (buttonId.startsWith("dock-configure-owner")) {
        const [, dockId] = buttonId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);

        if (!dock || dock.guildId !== interaction.guildId) {
          return interaction.reply({
            content: "I couldn't find that Dock in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }

        return interaction.client.modules.dockPublishModal(
          interaction,
          dock,
          `dock-publish-modal:${dock._id}`,
        );
      }

      if (buttonId.startsWith("dock-configure-follower")) {
        const [, dockId] = buttonId.split(":");
        const follower = await interaction.client.modules.db.getDockFollower(
          dockId,
          interaction.guildId,
        );

        if (!follower) {
          return interaction.reply({
            content: "This server is not following that Dock anymore.",
            flags: MessageFlags.Ephemeral,
          });
        }

        return interaction.client.modules.dockFollowModal(
          interaction,
          dockId,
          "dock-configure-follower",
          follower,
        );
      }

      if (buttonId.startsWith("dock-toggle-own-pings:")) {
        const [, dockId] = buttonId.split(":");
        const follower = await interaction.client.modules.db.getDockFollower(
          dockId,
          interaction.guildId,
        );

        if (!follower) {
          return interaction.reply({
            content: "This server is not connected to that Dock anymore.",
            flags: MessageFlags.Ephemeral,
          });
        }

        await interaction.client.modules.db.setDockFollower(dockId, interaction.guildId, {
          pingOwnServer: follower.pingOwnServer === false,
        });

        return interaction.client.modules.updateDockManagePage(interaction);
      }

      if (buttonId.startsWith("dock-home-ping-roles")) {
        const [, dockId] = buttonId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);

        if (!dock || dock.guildId !== interaction.guildId) {
          return interaction.reply({
            content: "I couldn't find that Dock in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }
        const selfFollow = await interaction.client.modules.db.getDockFollower(
          dockId,
          interaction.guildId,
        );

        return interaction.client.modules.dockFollowModal(
          interaction,
          dockId,
          "dock-home-ping-roles",
          selfFollow,
        );
      }

      if (buttonId.startsWith("dock-manage-followers")) {
        const [, dockId] = buttonId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);

        if (
          !dock ||
          !(await interaction.client.modules.dockLevels.guildCanManage(
            interaction.client,
            dock,
            interaction.guildId,
          ))
        ) {
          if (!dock) {
            return interaction.reply({
              content: "I couldn't find that Dock in this Discord server.",
              flags: MessageFlags.Ephemeral,
            });
          }
          return interaction.reply({
            content: "You don't have permission to manage this Dock.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const followers = (await interaction.client.modules.db.getDockFollowers(dockId))
          .filter((follower) => follower.guildId !== dock.guildId)
          .sort((a, b) => (a.guildName ?? "").localeCompare(b.guildName ?? ""));
        let state = dockManagePages.get(interaction.user.id);
        if (!state) {
          state = {
            pageIndex: 0,
            mode: dock.guildId === interaction.guildId ? "published" : "following",
            guildId: interaction.guildId,
          };
          dockManagePages.set(interaction.user.id, state);
        }
        state.followerManager = {
          dock,
          pages: interaction.client.modules.chunkArray(followers, 3),
          pageIndex: 0,
        };

        await interaction.update({
          components: interaction.client.modules.manageFollowersPage({
            dock,
            pages: state.followerManager.pages,
            pageIndex: state.followerManager.pageIndex,
            client: interaction.client,
          }),
          flags: interaction.message.flags,
        });

        return;
      }

      if (buttonId.startsWith("dock-manage-default-level")) {
        const [, dockId] = interaction.customId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);
        if (
          !dock ||
          !(await interaction.client.modules.dockLevels.guildCanManage(
            interaction.client,
            dock,
            interaction.guildId,
          ))
        ) {
          return interaction.reply({
            content: "I couldn't find that Dock in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }
        interaction.client.modules.dockDefaultLevelModal(interaction, dockId, dock.defaultLevel);
        return;
      }

      if (buttonId.startsWith("docks-manage-mode")) {
        const [, mode] = interaction.customId.split(":");
        await interaction.client.modules.updateDockManagePage(interaction, { mode });

        return;
      }

      if (buttonId.startsWith("dock-unfollow")) {
        const [, dockId] = buttonId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);
        if (!dock) {
          return interaction.reply({
            content: "I couldn't find that Dock",
            flags: MessageFlags.Ephemeral,
          });
        }

        await interaction.client.modules.dockRelay.relayAlert({
          client: interaction.client,
          dockId,
          components: [
            new ContainerBuilder().addTextDisplayComponents((t) =>
              t.setContent(
                `### 🚪 Follower left\n**${interaction.client.modules.escapeMarkdown(interaction.guild.name)}** stopped following **${interaction.client.modules.escapeMarkdown(dock.name)}**.`,
              ),
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });

        await interaction.client.modules.db.removeDockFollower(dockId, interaction.guildId);
        await interaction.client.modules.updateDockManagePage(interaction);
        await interaction.followUp({
          content: `Unfollowed Dock **${interaction.client.modules.escapeMarkdown(dock.name)}**.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (buttonId.startsWith("dock-delete-cancel")) {
        return interaction.client.modules.updateDockManagePage(interaction);
      }

      if (buttonId.startsWith("dock-delete:")) {
        const [, dockId] = interaction.customId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);
        if (!dock || dock.guildId !== interaction.guildId) {
          return interaction.reply({
            content: "I couldn't find that Dock in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const confirmation = new ContainerBuilder().addTextDisplayComponents((text) =>
          text.setContent(
            `## Delete ${interaction.client.modules.escapeMarkdown(dock.name)}?\nThis permanently removes the Dock and disconnects every follower.`,
          ),
        );
        const actions = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`dock-delete-cancel:${dockId}`)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`dock-delete-confirm:${dockId}`)
            .setLabel("Delete Dock")
            .setStyle(ButtonStyle.Danger),
        );

        return interaction.update({ components: [confirmation, actions] });
      }

      if (buttonId.startsWith("dock-delete-confirm")) {
        const [, dockId] = interaction.customId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);
        if (!dock || dock.guildId !== interaction.guildId) {
          return interaction.reply({
            content: "I couldn't find that Dock in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }
        const guild = await interaction.client.guilds.fetch(dock.guildId).catch(() => null);
        const guildName = guild?.name ?? dock.guildName ?? interaction.guild.name;

        await interaction.client.modules.dockRelay
          .relayAlert({
            client: interaction.client,
            dockId,
            components: [
              new ContainerBuilder().addTextDisplayComponents((t) =>
                t.setContent(
                  `### 🗑️ Dock deleted\n**${interaction.client.modules.escapeMarkdown(dock.name)}** was deleted by **${interaction.client.modules.escapeMarkdown(guildName)}**.`,
                ),
              ),
            ],
            flags: MessageFlags.IsComponentsV2,
          })
          .then(async () => {
            await interaction.client.modules.db.removeDock(dock._id);
            await interaction.client.modules.updateDockManagePage(interaction);
          });

        return;
      }

      if (buttonId.startsWith("dock-follow-request")) {
        const [, action, dockId, followerGuildId] = buttonId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);
        if (!dock || dock.guildId !== interaction.guildId || !followerGuildId) {
          return interaction.reply({
            content: "I couldn't find that Dock request in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }
        const follower = await interaction.client.modules.db.getDockFollower(
          dockId,
          followerGuildId,
        );
        if (!follower || follower.banned || follower.level !== "no-access") {
          return interaction.reply({
            content: "This follow request is no longer pending.",
            flags: MessageFlags.Ephemeral,
          });
        }
        const canApprove =
            interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
            interaction.member?.roles?.cache?.has(dock.gatekeeperRoleId);

        if (!canApprove) {
          return interaction.reply({
            content: "You don't have permission to approve/deny follower requests.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const container = new ContainerBuilder();
        const escapedDockName = interaction.client.modules.escapeMarkdown(dock.name);
        const escapedFollowerName = interaction.client.modules.escapeMarkdown(
          follower.guildName ?? follower.guildId,
        );
        const escapedPublisherName = interaction.client.modules.escapeMarkdown(
          interaction.guild.name,
        );
        if (action === "deny") {
          await interaction.reply({
            content: `Denied **${escapedFollowerName}**'s request to follow this Dock.`,
            flags: MessageFlags.Ephemeral,
          });
          await interaction.client.modules.dockRelay.relayAlert({
            client: interaction.client,
            dockId,
            components: [
              new ContainerBuilder().addTextDisplayComponents((t) =>
                t.setContent(
                  `### ❌ Follow request denied\n**${escapedPublisherName}** denied your server’s request to follow **${escapedDockName}**.`,
                ),
              ),
            ],
            flags: MessageFlags.IsComponentsV2,
            guildIds: [follower.guildId],
          });
          await interaction.client.modules.db.removeDockFollower(dockId, follower.guildId);
        } else {
          await interaction.reply({
            content: `Approved **${escapedFollowerName}**'s request to follow this Dock.`,
            flags: MessageFlags.Ephemeral,
          });
          await interaction.client.modules.db.setDockFollower(dockId, follower.guildId, {
            level: dock.defaultLevel,
          });
          const levelDetails = interaction.client.modules.dockLevels.get(dock.defaultLevel);
          container.addTextDisplayComponents((t) =>
            t.setContent(
              `### ✅ Follow request approved\n**${escapedFollowerName}** is now following **${escapedDockName}**.\n\n-# Access level: ${levelDetails.label} • Approved by ${escapedPublisherName}`,
            ),
          );

          await interaction.client.modules.dockRelay.relayAlert({
            client: interaction.client,
            dockId,
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        }

      }
      // Handle party buttons
      let [, partyId] = buttonId.split(":");
      if (partyId && buttonId.startsWith("party")) {
        if (buttonId.startsWith("party-leave") && !interaction.deferred && !interaction.replied) {
          await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
          });
        }

        await handlePartyButton(interaction);
        return;
      }
    }

    // ✅ Handle normal slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        const isMissingAccess = error.code === 50001;
        const eventId = isMissingAccess
          ? null
          : await reportError(error, {
              notify: false,
              source: "discord-command",
              tags: {
                command: interaction.commandName,
              },
            });

        const content = isMissingAccess
          ? "I don't have access to this channel."
          : `Something went wrong while executing this command. Error ID: \`${eventId}\``;

        const reportPrompt = issues
          ? ` Please report it on our [issue board](${issues}).`
          : " Please report it to the bot developers.";

        const replyContent = {
          content: `${content}${isMissingAccess ? "" : reportPrompt}`,
          components: eventId ? buildReportErrorComponents(eventId) : [],
          flags: [MessageFlags.Ephemeral],
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyContent);
          } else {
            await interaction.reply(replyContent);
          }
        } catch (replyError) {
          if (replyError.code !== 10062) {
            throw replyError;
          }
          console.warn("Failed to send command error response: interaction expired.");
        }
      }
    }
  },
};
