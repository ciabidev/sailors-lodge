const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");

const EXPIRES_AFTER_MS = 5 * 60 * 1000;
const MAX_DOCK_OPTIONS = 24;

function getSelections(client) {
  if (!client.dockTargetSelections) {
    client.dockTargetSelections = new Map();
  }
  if (!client.dockTargetMemory) {
    client.dockTargetMemory = new Map();
  }
  if (!client.dockTargetControls) {
    client.dockTargetControls = new Map();
  }

  return client.dockTargetSelections;
}

function getOptions(choices, includeAll = true) {
  const shownChoices = choices.slice(0, MAX_DOCK_OPTIONS);
  const options = shownChoices.map(({ dock }) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(dock.name.slice(0, 100))
      .setDescription((dock.guildName ?? dock.guildId).slice(0, 100))
      .setValue(dock._id.toString()),
  );

  if (includeAll) {
    options.unshift(
      new StringSelectMenuOptionBuilder()
        .setLabel(choices.length > shownChoices.length ? `All ${choices.length} available Docks` : "All available Docks")
        .setValue("all"),
    );
  }

  return options;
}

function getSourceDetails(source) {
  // The same picker is used by messageCreate and threadCreate. Keep the public
  // API simple by accepting the Discord object directly and normalizing only
  // the fields the picker needs.
  return {
    client: source.client,
    authorId: source.author?.id ?? source.ownerId,
    guildId: source.guildId,
    // For threads, remember routes by the parent channel so future threads in
    // that channel reuse the same 5-minute Dock selection as messages do.
    channelId: source.channel?.id ?? source.parentId ?? source.id,
    sendPrompt: (payload) => {
      // Thread prompts go in the parent channel so the bot's select-menu message
      // does not become part of the new thread history we relay below.
      if (source.isThread?.() && typeof source.parent?.send === "function") {
        return source.parent.send(payload);
      }
      if (typeof source.reply === "function") return source.reply(payload);
      if (typeof source.send === "function") return source.send(payload);
      throw new Error("Dock target picker source cannot send a prompt");
    },
  };
}

async function prompt(source, dockFollows, onSelect, options = {}) {
  if (dockFollows.length === 0) return;
  if (dockFollows.length === 1) return onSelect(dockFollows);

  const {
    client,
    authorId,
    guildId,
    channelId,
    sendPrompt,
  } = getSourceDetails(source);

  const docks = await Promise.all(
    dockFollows.map(async (dockFollow) => ({
      dockFollow,
      dock: await client.modules.db.getDock(dockFollow.dockId),
    })),
  );
  const choices = docks.filter(({ dock }) => dock);
  if (choices.length === 0) return;
  if (choices.length === 1) return onSelect(choices.map(({ dockFollow }) => dockFollow));

  const selectionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const menuOptions = getOptions(choices);

  const selections = getSelections(client);
  // The select menu interaction arrives later in interactionCreate, after the
  // original event has returned. Store the callback and enough context to finish
  // the relay once the user chooses Docks.
  selections.set(selectionId, {
    authorId,
    guildId,
    channelId,
    choices,
    onSelect,
    selectedContent: options.selectedContent,
    changedContent: options.changedContent,
    expiresAt: Date.now() + EXPIRES_AFTER_MS,
  });
  setTimeout(() => selections.delete(selectionId), EXPIRES_AFTER_MS);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`dock-target:${selectionId}`)
    .setPlaceholder("Choose Docks")
    .setMinValues(1)
    .setMaxValues(menuOptions.length)
    .addOptions(menuOptions);

  return sendPrompt({
    content: options.promptContent ??
      "This channel can send to multiple Docks. Choose where this message should go.",
    components: [new ActionRowBuilder().addComponents(select)],
    allowedMentions: { repliedUser: false },
  }).catch(async (error) => {
    selections.delete(selectionId);
    await client.modules.dockRelay.reportDockRelayError(error, {
      client,
      channelId,
      userId: authorId,
      source: "dock-target-picker",
    });
  });
}

function getRemembered(source, dockFollows) {
  const { client, authorId, guildId, channelId } = getSourceDetails(source);
  getSelections(client);
  // Memory is scoped to user + guild + source channel. For threads, channelId is
  // the parent channel, matching the channel-level rule users are choosing for.
  const key = `${guildId}:${channelId}:${authorId}`;
  const memory = client.dockTargetMemory.get(key);

  if (!memory || memory.expiresAt < Date.now()) {
    client.dockTargetMemory.delete(key);
    return null;
  }

  const dockIds = new Set(memory.dockIds);
  const rememberedDockFollows = dockFollows.filter((dockFollow) =>
    dockIds.has(dockFollow.dockId.toString()),
  );
  if (!rememberedDockFollows.length) return null;

  return rememberedDockFollows;
}

async function handleSelect(interaction) {
  const [, selectionId] = interaction.customId.split(":");
  const selections = getSelections(interaction.client);
  const selection = selections.get(selectionId);

  if (!selection || selection.expiresAt < Date.now()) {
    selections.delete(selectionId);
    return interaction.reply({
      content: "That Dock selection expired. Send the message again to choose a target.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.user.id !== selection.authorId) {
    return interaction.reply({
      content: "Only the message author can choose where this goes.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const selectedValues = new Set(interaction.values);
  const selectedChoices = selectedValues.has("all")
    ? selection.choices
    : selection.choices.filter(({ dock }) => selectedValues.has(dock._id.toString()));

  if (selectedChoices.length === 0) {
    return interaction.reply({
      content: "I couldn't find any selected Docks anymore.",
      flags: MessageFlags.Ephemeral,
    });
  }

  selections.delete(selectionId);
  await interaction.deferUpdate();

  const memoryKey = `${selection.guildId}:${selection.channelId}:${interaction.user.id}`;
  const selectedDockIds = selectedChoices.map(({ dock }) => dock._id.toString());
  interaction.client.dockTargetMemory.set(memoryKey, {
    dockIds: selectedDockIds,
    expiresAt: Date.now() + EXPIRES_AFTER_MS,
  });
  interaction.client.dockTargetControls.set(selectionId, {
    authorId: selection.authorId,
    memoryKey,
    choices: selection.choices,
    changedContent: selection.changedContent,
    expiresAt: Date.now() + EXPIRES_AFTER_MS,
  });
  setTimeout(() => interaction.client.dockTargetControls.delete(selectionId), EXPIRES_AFTER_MS);

  await selection.onSelect(selectedChoices.map(({ dockFollow }) => dockFollow));

  const dockNames = selectedChoices
    .map(({ dock }) => interaction.client.modules.escapeMarkdown(dock.name))
    .join(", ");
  const selectedContent = selection.selectedContent ??
    ((names) => `Sent to ${names}. I'll keep sending your messages here to those Docks for 5 minutes.`);
  await interaction.editReply({
    content: selectedContent(dockNames),
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`dock-target-memory:${selectionId}`)
          .setPlaceholder("Change Docks")
          .setMinValues(1)
          .setMaxValues(getOptions(selection.choices).length)
          .addOptions(getOptions(selection.choices)),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`dock-target-stop:${selectionId}`)
          .setLabel("Stop Routing")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  }).catch(() => {});
}

async function handleMemorySelect(interaction) {
  const [, selectionId] = interaction.customId.split(":");
  getSelections(interaction.client);
  const control = interaction.client.dockTargetControls.get(selectionId);

  if (!control || control.expiresAt < Date.now()) {
    interaction.client.dockTargetControls.delete(selectionId);
    return interaction.reply({
      content: "That Dock route expired.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.user.id !== control.authorId) {
    return interaction.reply({
      content: "Only the message author can change this route.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const selectedValues = new Set(interaction.values);
  const selectedChoices = selectedValues.has("all")
    ? control.choices
    : control.choices.filter(({ dock }) => selectedValues.has(dock._id.toString()));

  interaction.client.dockTargetMemory.set(control.memoryKey, {
    dockIds: selectedChoices.map(({ dock }) => dock._id.toString()),
    expiresAt: Date.now() + EXPIRES_AFTER_MS,
  });
  control.expiresAt = Date.now() + EXPIRES_AFTER_MS;

  const dockNames = selectedChoices
    .map(({ dock }) => interaction.client.modules.escapeMarkdown(dock.name))
    .join(", ");
  const changedContent = control.changedContent ??
    ((names) => `Route changed. I'll keep sending your messages here to ${names} for 5 minutes.`);
  return interaction.update({
    content: changedContent(dockNames),
  });
}

async function handleStop(interaction) {
  const [, selectionId] = interaction.customId.split(":");
  getSelections(interaction.client);
  const control = interaction.client.dockTargetControls.get(selectionId);

  if (!control) {
    return interaction.reply({
      content: "That Dock route already expired.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.user.id !== control.authorId) {
    return interaction.reply({
      content: "Only the message author can stop this route.",
      flags: MessageFlags.Ephemeral,
    });
  }

  interaction.client.dockTargetMemory.delete(control.memoryKey);
  interaction.client.dockTargetControls.delete(selectionId);

  return interaction.update({
    content: "Dock routing stopped.",
    components: [],
  });
}

module.exports = {
  getRemembered,
  handleMemorySelect,
  handleSelect,
  handleStop,
  prompt,
};
