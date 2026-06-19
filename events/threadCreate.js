const { Events } = require("discord.js");

module.exports = {
  name: Events.ThreadCreate,
  async execute(thread) {
    try {
      const dockFollower = await thread.client.modules.db.getDockFollowForChannel(
        thread.parentId,
      );
      const dock = dockFollower
        ? await thread.client.modules.db.getDock(dockFollower.dockId)
        : null;

      if (!dock) return;
      if (dock.guildId !== dockFollower.guildId && dockFollower.contributor !== true) return;
      
      await thread.client.modules.dockRelay.relayThread(thread);
    } catch (error) {
      console.error("[thread-create] Failed to relay Dock thread:", error);
    }
  },
};
