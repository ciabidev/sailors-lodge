const { Events } = require("discord.js");

module.exports = {
  name: Events.ThreadCreate,
  async execute(thread) {
    try {
      // threads stay on one dock network even when the parent channel follows multiple docks
      const [connection] =
        await thread.client.modules.dockRelay.getWritableConnections(
          thread.client,
          thread.parentId,
          thread.guildId,
        );
      if (!connection) return;
      
      await thread.client.modules.dockRelay.relayThread(thread, connection.follower);
    } catch (error) {
      console.error("[thread-create] Failed to relay Dock thread:", error);
    }
  },
};
