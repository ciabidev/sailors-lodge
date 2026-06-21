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
} = require("discord.js");
const { ObjectId } = require("mongodb");

const issues = process.env.ISSUES_URL;
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
        console.error("Autocomplete error:", error);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      console.log(`[modal-submit] ${interaction.customId}`);
      let modalId;
      let dockId;
      let partyId;
      let dmFlag;

      if (interaction.customId === "docks-browse-search-modal") {
        const search = interaction.fields.getTextInputValue("search");
        return interaction.client.modules.updateDockBrowsePage(interaction, { search });
      }
      if (interaction.customId === "docks-manage-search-modal") {
        const search = interaction.fields.getTextInputValue("search");
        return interaction.client.modules.updateDockManagePage(interaction, { search });
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
          content: `Published! ${selectedChannels.length} Channel(s): ${selectedChannels
            .map((channel) => `<#${channel.id}>`)
            .join(
              ", ",
            )}. \nPlease use \`/dock manage\` to configure your Home Ping Roles, Default Permission Levels and more. `,
          flags: MessageFlags.Ephemeral,
        });
      }

      [modalId, dockId] = interaction.customId.split(":");
      if (modalId === "dock-follow-modal" || modalId === "dock-configure-follower") {
        const isConfiguringFollower = modalId === "dock-configure-follower";
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
        const roles = hasKeywordField ? interaction.fields.getSelectedRoles("roles", false) : null;
        const roleIds = roles ? Array.from(roles.keys()) : [];

        if (!(await interaction.client.modules.dockBotPerms.check(interaction, channel))) {
          return;
        }
        const existingFollower = await interaction.client.modules.db.getDockFollower(
          dockId,
          interaction.guildId,
        );

        const currentKeywordPings = Array.isArray(existingFollower?.keywordPings)
          ? {}
          : { ...(existingFollower?.keywordPings ?? {}) };
        if (keyword) currentKeywordPings[keyword] = roleIds;

        if (!isConfiguringFollower && existingFollower) {
          return interaction.reply({
            content: "This server is already following this Dock.",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (isConfiguringFollower && !existingFollower) {
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
          level: isConfiguringFollower
            ? undefined
            : interaction.client.modules.dockLevels.normalize(dock.defaultLevel),
        });

        interaction.reply({
          content: isConfiguringFollower
            ? `Updated Dock \`${dock.name}\` to post in <#${channelId}>.`
            : `Followed Dock \`${dock.name}\` in <#${channelId}>.`,
          flags: MessageFlags.Ephemeral,
        });
        const container = new ContainerBuilder();
        container.addTextDisplayComponents((t) => t.setContent(`### New Dock Follower`));
        container.addTextDisplayComponents((t) =>
          t.setContent(
            `**${interaction.guild.name}** is now following this dock (\`${interaction.client.modules.escapeMarkdown(
              dock.name,
            )}\`).`,
          ),
        );
        container.addTextDisplayComponents((t) =>
          t.setContent(
            `**Permission Level:** ${interaction.client.modules.dockLevels.get(dock.defaultLevel).label}\n**Channels:** ${channels.map((channel) => channel.name ?? channel.id).join(", ")}`,
          ),
        );
        if (!isConfiguringFollower) {
          interaction.client.modules.dockRelay.relayAlert({
            client: interaction.client,
            dockId,
            components: [container],
            flags: MessageFlags.IsComponentsV2,
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

        const channelIds = selfFollow?.channelIds?.length ? selfFollow.channelIds : dock.channelIds;
        const keywords = interaction.fields.getStringSelectValues("keyword");
        const roles = interaction.fields.getSelectedRoles("roles", false);
        const roleIds = roles ? Array.from(roles.keys()) : [];
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

        await interaction.reply({
          content: `Updated \`${interaction.client.modules.escapeMarkdown(keywords.join(", "))}\` Home Ping Roles for Dock \`${interaction.client.modules.escapeMarkdown(dock.name)}\` to ${roleIds.map((roleId) => `<@&${roleId}>`).join(", ") || "none"}.`,
          flags: MessageFlags.Ephemeral,
        });
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
        await interaction.client.modules.db.updateDock(dockId, {
          $set: {
            defaultLevel: level,
          },
        });
        return interaction.client.modules.dockRelay.relayAlert({
          content: `Updated ${dock.name} default follower level to ${interaction.client.modules.dockLevels.get(level).label}.`,
          components: [
            new ContainerBuilder().addTextDisplayComponents((t) =>
              t.setContent(
                `The default level for this dock was changed to ${interaction.client.modules.dockLevels.get(level).label} by **${interaction.guild.name}**`,
              ),
            ),
          ],
          flags: MessageFlags.Ephemeral,
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
      if (!follower || follower.guildId === dock.guildId) {
        return interaction.reply({
          content: "I couldn't find that follower anymore.",
          flags: MessageFlags.Ephemeral,
        });
      }

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
        pageIndex: Math.min(
          state.followerManager?.pageIndex ?? 0,
          Math.max(pages.length - 1, 0),
        ),
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
        const guild = await interaction.client.guilds.fetch(follower.guildId).catch(() => null);
        const dockLevels = interaction.client.modules.dockLevels;
        const oldLevelIndex = dockLevels.order.indexOf(dockLevels.normalize(follower.level));
        const newLevelIndex = dockLevels.order.indexOf(newLevel);
        const action = newLevelIndex > oldLevelIndex ? "promoted" : "demoted";

        await interaction.client.modules.dockRelay.relayAlert({
          client: interaction.client,
          dockId,
          components: [
            new ContainerBuilder().addTextDisplayComponents((text) =>
              text.setContent(
                `The server **${guild?.name ?? follower.guildName ?? follower.guildId}** was ${action} to ${dockLevels.get(newLevel).label} by **${interaction.guild.name}**.\n` +
                  `-# **${dockLevels.get(newLevel).description}**`,
              ),
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      return;
    }

    if (interaction.isButton()) {
      const buttonId = interaction.customId;
      let [action] = buttonId.split(":");

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

        // return interaction.reply({
        //   content:
        //     accessMode === "request"
        //       ? "Dock request-to-join is coming soon."
        //       : "Dock followers are coming soon.",
        //   flags: MessageFlags.Ephemeral,
        // });

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
        if (!dock.keywords?.some(Boolean)) {
          return interaction.reply({
            content: "Add ping keywords to this Dock before assigning Home Ping Roles.",
            flags: MessageFlags.Ephemeral,
          });
        }

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
                `The server **${interaction.guild.name}** is no longer following this dock.`,
              ),
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });

        await interaction.client.modules.db.removeDockFollower(dockId, interaction.guildId);
        await interaction.client.modules.updateDockManagePage(interaction);
        await interaction.followUp({
          content: `Unfollowed Dock \`${interaction.client.modules.escapeMarkdown(dock.name)}\`.`,
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
                  `### Dock Deleted\nThe dock **${interaction.client.modules.escapeMarkdown(dock.name)}** has been deleted by ${guildName}.`,
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
        console.error(error);
        let content = error.message;
        if (error.stack) {
          content += `\n\n${error.stack}`;
        }

        if (error.code === 50001) {
          content = "I don't have access to this channel.";
        }

        const replyContent = {
          content: `An error occurred while executing this command, please report this to us via our [issue board](${issues})\n\`\`\`${content}\`\`\``,
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
          console.error("Failed to send command error response: interaction expired.");
        }
      }
    }
  },
};
