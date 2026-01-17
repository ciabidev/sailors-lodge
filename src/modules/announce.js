// announce to all party members using webhooks

module.exports = async function announcePartyMembers(client, party, messagePayload) {
  if (!party?.members?.length) return;

  for (const member of party.members) {
    try {
      const user = await client.users.fetch(member.id).catch(() => null);
      if (!user) continue;

      // Send the full message payload
      await user.send(messagePayload).catch(() => {});
    } catch (err) {
      console.error(`Failed to DM ${member.id}: ${err.message}`);
    }
  }
};