const { Events } = require("discord.js");

module.exports = {
  name: Events.ThreadCreate,
  async execute(thread) {
    try {
      
      await thread.client.modules.dockRelay.relayThread(thread);
    } catch (error) {
      console.error("[thread-create] Failed to relay Dock thread:", error);
    }
  },
};
