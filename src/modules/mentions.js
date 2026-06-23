function formatRoleMentions(roleIds = []) {
  return roleIds
    .map((roleId) => `<@&${roleId}>`)
    .join(" ");
}

module.exports = {
  formatRoleMentions,
};
