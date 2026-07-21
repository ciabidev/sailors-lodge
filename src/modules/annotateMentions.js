function annotateMentions(client, content) {
  if (!content) return content;

  return String(content).replace(/<@!?(\d{17,20})>(?!\s*\[)/g, (mention, userId) => {
    const user = client.users.cache.get(userId);
    const username = user?.username;
    if (!username) return mention;

    const escape = client.modules.escapeMarkdown;
    return `${mention} [${escape(username)}]`;
  });
}

module.exports = annotateMentions;
