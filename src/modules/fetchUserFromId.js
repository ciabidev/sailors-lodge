module.exports = async (client, id) => {
  const user = await client.users.fetch(id);
  return user;
};