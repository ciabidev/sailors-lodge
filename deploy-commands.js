// Make sure to run node deploy-commands.js in the same directory as your bot's source code!

require('dotenv').config();
const {
  Client,
  REST,
  Routes,
  SlashCommandSubcommandBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("Missing required env var: DISCORD_TOKEN");
  process.exit(1);
}
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

// and deploy your commands!
(async () => {
  const client = new Client({ intents: [] });

  try {
    await client.login(token);
    const clientId = client.user?.id;
    if (!clientId) throw new Error("Discord did not return the bot application id.");

    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const rest = new REST().setToken(token);
    const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
})();
