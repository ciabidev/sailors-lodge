const { Events } = require("discord.js");
const { reportError } = require("../src/reportError");

module.exports = {
  name: Events.ThreadCreate,
  async execute(thread) {
    try {
      // threads stay on one dock network even when the parent channel follows multiple docks
      const [sendingFollower] =
        await thread.client.modules.dockRelay.getWritableDockFollows(
          thread.client,
          thread.parentId,
          thread.guildId,
        );
      if (!sendingFollower) return;
      
      await thread.client.modules.dockRelay.relayThread(thread, sendingFollower);
    } catch (error) {
      await reportError(error, {
        source: "thread-create",
        context: thread,
      });
    }
  },
};
