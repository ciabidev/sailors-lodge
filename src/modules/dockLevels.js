const levels = Object.freeze({
  "no-access": {
    label: "No Access",
    description: "Can't receive or send messages across the Dock.",
    emoji: "🕜",
  },
  passive: {
    label: "Passive",
    description: "Can receive Dock messages.",
    emoji: "📥",
  },
  sender: {
    label: "Sender",
    description: "Can receive and send messages across the Dock.",
    emoji: "📤",
  },
  contributor: {
    label: "Contributor",
    description: "Can publish messages and trigger Dock pings.",
    emoji: "📣",
  },
  admin: {
    label: "Admin",
    description: "Can publish, ping, and manage follower access.",
    emoji: "🛠️",
  },
});

const order = Object.freeze(Object.keys(levels));
const DEFAULT_LEVEL = "passive";

function isValid(level) {
  return order.includes(level);
}

function normalize(level) {
  return isValid(level) ? level : DEFAULT_LEVEL;
}

function hasAtLeast(level, requiredLevel) {
  return order.indexOf(normalize(level)) >= order.indexOf(requiredLevel);
}

function canSend(level) {
  return hasAtLeast(level, "sender");
}

function canRead(follower) {
  return Boolean(
    follower &&
    !follower.banned &&
    hasAtLeast(follower.level, "passive"),
  );
}

function canPing(level) {
  return hasAtLeast(level, "contributor");
}

function canManage(level) {
  return hasAtLeast(level, "admin");
}

async function guildCanManage(client, dock, guildId) {
  if (dock.guildId === guildId) return true;
  const follower = await client.modules.db.getDockFollower(dock._id, guildId);
  return canRead(follower) && canManage(follower.level);
}

function get(level) {
  const normalized = normalize(level);
  return { id: normalized, ...levels[normalized] };
}

function previous(level) {
  return order[Math.max(order.indexOf(normalize(level)) - 1, 0)];
}

function next(level) {
  return order[Math.min(order.indexOf(normalize(level)) + 1, order.length - 1)];
}

module.exports = {
  DEFAULT_LEVEL,
  levels,
  order,
  isValid,
  normalize,
  get,
  previous,
  next,
  canRead,
  canSend,
  canPing,
  canManage,
  guildCanManage,
};
