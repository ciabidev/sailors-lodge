module.exports = async function sendPartyTip(user) {
  try {
    const dmUser = await user.client.users.fetch(user.id);
    await dmUser.send({
      content:
        "> ℹ️ TIP: Use `!a` before your message to announce to the rest of the party! For example: !a Hello everyone. Images work too",
    });
  } catch (error) {
    console.warn(`[party-tip] Failed to DM party tip to ${user.id}:`, error);
  }
};
