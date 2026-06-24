// Uses Discord's local channel cache first, then fetches from Discord if needed.
module.exports = async function fetchChannel(client, channelId) {
  return client.channels.cache.get(channelId) ??
    (await client.channels.fetch(channelId).catch(() => null));
};
