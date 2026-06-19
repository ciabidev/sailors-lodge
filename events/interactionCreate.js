const {
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  ActionRowBuilder,
  MessageFlags,
  ChannelType,
  Events,
  RoleSelectMenuBuilder,
  ModalBuilder,
  LabelBuilder,
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
      let modalId;
      let dockId;
      let partyId;
      let dmFlag;

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

        const selectedChannels = Array.from(channels.values());
        const channelIds = selectedChannels.map((channel) => channel.id);

        if (
          !(await interaction.client.modules.dockBotPerms.check(interaction, selectedChannels))
        ) {
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
          await interaction.client.modules.db.setDockFollower(
            dockId,
            interaction.guildId,
            interaction.guild.name,
            channelIds,
            [],
          );

          return interaction.reply({
            content: `Updated ${dock.name} with ${selectedChannels.length} channel${selectedChannels.length === 1 ? "" : "s"}: ${selectedChannels
              .map((channel) => `<#${channel.id}>`)
              .join(", ")}.`,
            flags: MessageFlags.Ephemeral,
          });
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
          interaction.guild.name,
          channelIds,
          [],
        );

        return interaction.reply({
          content: `Published! ${selectedChannels.length} Channel(s): ${selectedChannels
            .map((channel) => `<#${channel.id}>`)
            .join(", ")}. \n Please use \`/dock manage\` to configure your Home Ping Roles and more `,
          flags: MessageFlags.Ephemeral,
        });
      }

      [modalId, dockId] = interaction.customId.split(":");
      if (modalId === "dock-follow-modal" || modalId === "dock-configure-follower-modal") {
        const isConfiguringFollower = modalId === "dock-configure-follower-modal";
        const channels = interaction.fields.getSelectedChannels("dock-follow-channel", true, [
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
        ]);
        const [channelId] = channels.keys();
        const [channel] = channels.values();
        const roles = interaction.fields.getSelectedRoles("dock-follow-ping-roles", false);
        const roleIds = roles ? Array.from(roles.keys()) : [];

        if (!(await interaction.client.modules.dockBotPerms.check(interaction, channel))) {
          return;
        }
        const existingFollower = await interaction.client.modules.db.getDockFollower(
          dockId,
          interaction.guildId,
        );

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

        await interaction.client.modules.db.setDockFollower(
          dockId,
          interaction.guildId,
          interaction.guild.name,
          [channelId],
          roleIds,
        );
        const dock = await interaction.client.modules.db.getDock(dockId);

        interaction.reply({
          content: isConfiguringFollower
            ? `Updated Dock \`${dock.name}\` to post in <#${channelId}>.`
            : `Followed Dock \`${dock.name}\` in <#${channelId}>.`,
          flags: MessageFlags.Ephemeral,
        });

        if (!isConfiguringFollower) {
          interaction.client.modules.dockRelay.relayAlert({
            client: interaction.client,
            dockId,
            content: `🎊 **${interaction.guild.name}** is now following \`${interaction.client.modules.escapeMarkdown(dock.name)}\` in <#${channelId}>.`,
          });
        }

        return;
      }

      [modalId, dockId] = interaction.customId.split(":");
      if (modalId === "dock-home-ping-roles") {
        const [, dockId] = interaction.customId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);

        if (!dock) return;

        const selfFollow = await interaction.client.modules.db.getDockFollower(
          dockId,
          interaction.guildId,
        );

        const channelIds = selfFollow?.channelIds?.length ? selfFollow.channelIds : dock.channelIds;
        const roles = interaction.fields.getSelectedRoles("dock-home-ping-roles", false);
        const roleIds = roles ? Array.from(roles.keys()) : [];
        await interaction.client.modules.db.setDockFollower(
          dockId,
          interaction.guildId,
          interaction.guild.name,
          channelIds,
          roleIds,
        );

        await interaction.reply({
          content: `Updated Home Ping Roles for Dock \`${interaction.client.modules.escapeMarkdown(dock.name)}\` to ${roleIds.map((roleId) => `<@&${roleId}>`).join(", ")}.`,
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

    if (interaction.isButton()) {
      const buttonId = interaction.customId;
      let [action] = buttonId.split(":");

      if (buttonId === "docks-prev" || buttonId === "docks-next") {
        let state = dockBrowsePages.get(interaction.user.id);
        if (!state) return;

        let { pages } = state;

        state.pageIndex =
          buttonId === "docks-prev"
            ? (state.pageIndex - 1 + pages.length) % pages.length
            : (state.pageIndex + 1) % pages.length;

        await interaction.update({
          components: [
            interaction.client.modules.dockBrowsePage({
              pages,
              pageIndex: state.pageIndex,
              client: interaction.client,
            }),
            interaction.message.components[1],
          ],
        });

        return;
      }

      if (buttonId === "docks-manage-prev" || buttonId === "docks-manage-next") {
        let state = dockManagePages.get(interaction.user.id);
        if (!state) return;

        const pages = state.pages[state.mode] ?? [];
        const pageCount = Math.max(pages.length, 1);

        state.pageIndex =
          buttonId === "docks-manage-prev"
            ? (state.pageIndex - 1 + pageCount) % pageCount
            : (state.pageIndex + 1) % pageCount;

        const pageSelector = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("docks-manage-prev")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pages.length <= 1),
          new ButtonBuilder()
            .setCustomId("docks-manage-next")
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pages.length <= 1),
        );

        await interaction.update({
          components: [
            interaction.client.modules.dockManagePage({
              pages,
              pageIndex: state.pageIndex,
              mode: state.mode,
              guildId: state.guildId,
              client: interaction.client,
            }),
            interaction.message.components[1],
            pageSelector,
          ],
          flags: interaction.message.flags,
        });

        return;
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
        let state = dockManagePages.get(interaction.user.id);
        if (!state) return;

        const pages = state.pages[state.mode] ?? [];
        const modeSelector = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("docks-manage-mode:published")
            .setLabel("Manage Published")
            .setEmoji("👑")
            .setStyle(state.mode === "published" ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("docks-manage-mode:following")
            .setLabel("Manage Followed")
            .setEmoji("🌐")
            .setStyle(state.mode === "following" ? ButtonStyle.Primary : ButtonStyle.Secondary),
        );
        const pageSelector = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("docks-manage-prev")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pages.length <= 1),
          new ButtonBuilder()
            .setCustomId("docks-manage-next")
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pages.length <= 1),
        );

        delete state.followerManager;

        await interaction.update({
          components: [
            interaction.client.modules.dockManagePage({
              pages,
              pageIndex: state.pageIndex,
              mode: state.mode,
              guildId: state.guildId,
              client: interaction.client,
            }),
            modeSelector,
            pageSelector,
          ],
          flags: interaction.message.flags,
        });

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
          "dock-configure-follower-modal",
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

        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId("dock-home-ping-roles")
          .setMaxValues(25)
          .setRequired(false);

        if (selfFollow?.pingRoleIds?.length) {
          roleSelect.setDefaultRoles(selfFollow.pingRoleIds.slice(0, 25));
        }

        return interaction.showModal(
          new ModalBuilder()
            .setTitle("Home Ping Roles")
            .setCustomId(`dock-home-ping-roles:${dockId}`)
            .addLabelComponents(
              new LabelBuilder()
                .setLabel("Home Ping Roles")
                .setDescription("These roles will be pinged whenever a dock ping is recieved")
                .setRoleSelectMenuComponent(roleSelect),
            ),
        );
      }

      if (buttonId.startsWith("dock-manage-followers")) {
        const [, dockId] = buttonId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);

        if (!dock || dock.guildId !== interaction.guildId) {
          return interaction.reply({
            content: "I couldn't find that Dock in this Discord server.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const followers = (await interaction.client.modules.db.getDockFollowers(dockId))
          .filter((follower) => follower.guildId !== dock.guildId)
          .sort((a, b) => (a.guildName ?? "").localeCompare(b.guildName ?? ""));
        let state = dockManagePages.get(interaction.user.id);
        if (!state) {
          state = {
            pages: { published: [], following: [] },
            pageIndex: 0,
            mode: "published",
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

      if (buttonId.startsWith("dock-alter-follower")) {
        const [, dockId, guildId] = buttonId.split(":");
        const dock = await interaction.client.modules.db.getDock(dockId);

        if (!dock || dock.guildId !== interaction.guildId) {
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

        await interaction.client.modules.db.setDockFollowerContributor(
          dockId,
          guildId,
          follower.contributor !== true,
        );

        const followers = (await interaction.client.modules.db.getDockFollowers(dockId))
          .filter((follower) => follower.guildId !== dock.guildId)
          .sort((a, b) => (a.guildName ?? "").localeCompare(b.guildName ?? ""));
        const pages = interaction.client.modules.chunkArray(followers, 3);
        let state = dockManagePages.get(interaction.user.id);
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
            pages: state.followerManager.pages,
            pageIndex: state.followerManager.pageIndex,
            client: interaction.client,
          }),
          flags: interaction.message.flags,
        });

        return;
      }

      if (interaction.customId.startsWith("docks-manage-mode")) {
        const [, mode] = interaction.customId.split(":");
        const state = dockManagePages.get(interaction.user.id);
        if (!state) return;

        state.mode = mode;
        state.pageIndex = 0;

        const pages = state.pages[state.mode] ?? [];
        const modeSelector = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("docks-manage-mode:published")
            .setLabel("Manage Published")
            .setEmoji("👑")
            .setStyle(state.mode === "published" ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("docks-manage-mode:following")
            .setLabel("Manage Followed")
            .setEmoji("🌐")
            .setStyle(state.mode === "following" ? ButtonStyle.Primary : ButtonStyle.Secondary),
        );
        const pageSelector = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("docks-manage-prev")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pages.length <= 1),
          new ButtonBuilder()
            .setCustomId("docks-manage-next")
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pages.length <= 1),
        );

        await interaction.update({
          components: [
            interaction.client.modules.dockManagePage({
              pages,
              pageIndex: state.pageIndex,
              mode: state.mode,
              guildId: state.guildId,
              client: interaction.client,
            }),
            modeSelector,
            pageSelector,
          ],
          flags: interaction.message.flags,
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
