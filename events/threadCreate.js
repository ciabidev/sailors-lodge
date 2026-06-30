const { Events } = require("discord.js");
const { reportError } = require("../src/reportError");

module.exports = {
  name: Events.ThreadCreate,
  async execute(thread) {
    try {
      if (thread.name?.startsWith(thread.client.modules.dockRelay.RELAYED_THREAD_MARKER)) return;

      const dockFollows = await thread.client.modules.dockRelay.getWritableDockFollows(
        thread.client,
        thread.parentId,
        thread.guildId,
      );
      if (!dockFollows.length) return;

      // A parent channel can publish to multiple Docks. Thread creation should
      // follow the same target-selection rule as messages, then relay the thread
      // once for each selected Dock.
      async function relayToSelectedDocks(selectedDockFollows) {
        for (const sendingFollower of selectedDockFollows) {
          await thread.client.modules.dockRelay.relayThread(thread, sendingFollower);
        }
      }

      if (dockFollows.length > 1) {
        // Reuse the user's recent route for this parent channel when available;
        // otherwise ask them which Dock networks should receive this thread.
        let rememberedDockFollows = thread.client.modules.dockTargetPicker.getRemembered(
          thread,
          dockFollows,
        ); // with a thread, rememberedDockFollows can either be in the memory, or the dockFollows of the message it was attached to (aka starter message). this will make sense later below
        const starterMessage = await thread.fetchStarterMessage().catch(() => null);
        if (starterMessage) {
          const dockMessage =
            (await thread.client.modules.db.getDockMessageFromRoot(
              starterMessage.channel.id,
              starterMessage.id,
            )) ??
            (await thread.client.modules.db.getDockMessageFromDelivery(
              starterMessage.channel.id,
              starterMessage.id,
            ));

          if (dockMessage?.deliveries?.length) {
            const deliveredChannelIds = new Set(
              dockMessage.deliveries.map((delivery) => delivery.channelId),
            );

            rememberedDockFollows = [];

            for (const dockFollow of dockFollows) {
              const followers = await thread.client.modules.db.getDockFollowers(dockFollow.dockId);

              const matches = followers.some((follower) =>
                (follower.channelIds ?? [follower.channelId]).some((channelId) =>
                  deliveredChannelIds.has(channelId),
                ),
              );

              if (matches) rememberedDockFollows.push(dockFollow);
            }
          }
        }
        if (rememberedDockFollows?.length) {
          await relayToSelectedDocks(rememberedDockFollows);
          return;
        }

        await thread.client.modules.dockTargetPicker.prompt(
          thread,
          dockFollows,
          relayToSelectedDocks,
          {
            promptContent: `This channel can create threads in multiple Docks. Choose where <#${thread.id}> should go.`,
            selectedContent: (dockNames) =>
              `Thread sent to ${dockNames}. I'll keep creating threads here in those Docks for 5 minutes.`,
            changedContent: (dockNames) =>
              `Thread route changed. I'll keep creating threads here in ${dockNames} for 5 minutes.`,
          },
        );
        return;
      }

      await relayToSelectedDocks(dockFollows);
    } catch (error) {
      await reportError(error, {
        source: "thread-create",
        context: thread,
      });
    }
  },
};
