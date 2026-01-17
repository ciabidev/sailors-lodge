// Make sure to run node deploy-commands.js in the same directory as your bot's source code!

require('dotenv').config();
const { REST, Routes, SlashCommandSubcommandBuilder, SlashCommandBuilder } = require("discord.js");

const guildId = process.env.GUILD_ID;
const devMode = process.env.DEV_MODE === 'true';
const productionToken = process.env.PRODUCTION_TOKEN;
const devToken = process.env.DEV_TOKEN;
const productionClientId = process.env.PRODUCTION_CLIENT_ID;
const devClientId = process.env.DEV_CLIENT_ID;

console.log("dev mode: " + devMode);

const token = devMode === true ? devToken : productionToken;
const clientId = devMode === true ? devClientId : productionClientId;
const fs = require("node:fs");
const path = require("node:path");

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  // Grab all the command files from the commands directory you created earlier
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (
      !(command.data instanceof SlashCommandBuilder) ||
      command.data instanceof SlashCommandSubcommandBuilder
    ) {
      continue; // skip subcommand files
    }
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();
