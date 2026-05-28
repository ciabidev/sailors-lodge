const fs = require("node:fs");
const path = require("node:path");
const { SlashCommandBuilder } = require("discord.js");

const SUBCOMMAND_TYPE = 1;
const SUBCOMMAND_GROUP_TYPE = 2;

function defaultFileFilter(file) {
  return file.endsWith(".js") && file !== "main.js";
}

function normalizeCommandName(name) {
  return name.replace(/-/g, "");
}

function loadSubcommands(dirname, fileFilter = defaultFileFilter) {
  return fs
    .readdirSync(dirname)
    .filter(fileFilter)
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const filePath = path.join(dirname, file);
      return {
        file,
        filePath,
        command: require(filePath),
      };
    });
}

function addSubcommand(builder, subcommand) {
  const data = subcommand.command?.data;
  const type = data?.toJSON?.().type;
  const constructorName = data?.constructor?.name;

  if (type === SUBCOMMAND_GROUP_TYPE || constructorName === "SlashCommandSubcommandGroupBuilder") {
    builder.addSubcommandGroup(() => data);
    return;
  }

  if (type === SUBCOMMAND_TYPE || constructorName === "SlashCommandSubcommandBuilder") {
    builder.addSubcommand(() => data);
    return;
  }

  throw new Error(`Unknown subcommand builder in ${subcommand.file}`);
}

function registerSubcommandFolder({
  name,
  description,
  dirname,
  configure,
  fileFilter = defaultFileFilter,
  normalizeName = normalizeCommandName,
}) {
  if (!name || !description || !dirname) {
    throw new Error("Subcommand modules require name, description, and dirname.");
  }

  const subcommands = loadSubcommands(dirname, fileFilter);
  const data = new SlashCommandBuilder().setName(name).setDescription(description);
  const handlers = new Map();

  if (configure) {
    configure(data);
  }

  for (const subcommand of subcommands) {
    addSubcommand(data, subcommand);

    const commandName = subcommand.command.data.toJSON().name;
    handlers.set(normalizeName(commandName), subcommand.filePath);
  }

  function getHandler(interaction) {
    const group = interaction.options.getSubcommandGroup(false) || null;
    const subcommand = interaction.options.getSubcommand(true);
    const handlerName = normalizeName(group || subcommand);
    const handlerPath = handlers.get(handlerName);

    if (!handlerPath) {
      throw new Error(`No handler found for /${name} ${group ? `${group} ${subcommand}` : subcommand}`);
    }

    return require(handlerPath);
  }

  return {
    data,

    async execute(interaction) {
      const handler = getHandler(interaction);
      return handler.execute(interaction);
    },

    async autocomplete(interaction) {
      const handler = getHandler(interaction);
      if (!handler.autocomplete) return;
      return handler.autocomplete(interaction);
    },
  };
}

module.exports = registerSubcommandFolder;
