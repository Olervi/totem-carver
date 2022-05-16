const { readdirSync } = require ("fs");
const { Client, Collection, Intents } = require ("discord.js");
const { token, client_id, test_guild_id } = require ("./config.json");
const { REST } = require ("@discordjs/rest");
const { Routes } = require ('discord-api-types/v9');

const client = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
	partials: ["MESSAGE", "CHANNEL", "REACTION" ]
	
});


const eventFiles = readdirSync("./events")
	.filter((file) => file.endsWith(".js"));

const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
 
    client.commands.set(command.name, command);
}

// Loop through all files and execute the event when it is actually emmited.
for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args, client));
	} else {
		client.on(
			event.name,
			async (...args) => await event.execute(...args, client)
		);
	}
}



client.commands = new Collection();
client.slashCommands = new Collection();
client.buttonCommands = new Collection();
client.selectCommands = new Collection();
client.contextCommands = new Collection();
client.cooldowns = new Collection();
client.triggers = new Collection();

//Registration Msg-based Commands

const commandFolders = readdirSync("./commands");

// Loop through all files and store commands in commands collection.

for (const folder of commandFolders) {
	const commandFiles = readdirSync(`./commands/${folder}`)
		.filter((file) => file.endsWith(".js"));
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		client.commands.set(command.name, command);
	}
}


//Registration of Slash-Commands

const slashCommands = readdirSync("./interactions/slash");

// Loop through all files and store slash-commands in slashCommands collection.

for (const module of slashCommands) {
	const commandFiles = readdirSync(`./interactions/slash/${module}`)
		.filter((file) => file.endsWith(".js"));

	for (const commandFile of commandFiles) {
		const command = require(`./interactions/slash/${module}/${commandFile}`);
		client.slashCommands.set(command.data.name, command);
	}
}


const contextMenus = readdirSync("./interactions/context-menus");

// Loop through all files and store slash-commands in slashCommands collection.

for (const folder of contextMenus) {
	const files = readdirSync(`./interactions/context-menus/${folder}`)
		.filter((file) => file.endsWith(".js"));
	for (const file of files) {
		const menu = require(`./interactions/context-menus/${folder}/${file}`);
		const keyName = `${folder.toUpperCase()} ${menu.data.name}`;
		client.contextCommands.set(keyName, menu);
	}
}


const buttonCommands = readdirSync("./interactions/buttons");

// Loop through all files and store button-commands in buttonCommands collection.

for (const module of buttonCommands) {
	const commandFiles = readdirSync(`./interactions/buttons/${module}`)
		.filter((file) => file.endsWith(".js"));

	for (const commandFile of commandFiles) {
		const command = require(`./interactions/buttons/${module}/${commandFile}`);
		client.buttonCommands.set(command.id, command);
	}
}


const selectMenus = readdirSync("./interactions/select-menus");

 // Loop through all files and store select-menus in slashCommands collection.
 
 for (const module of selectMenus) {
	 const commandFiles = readdirSync(`./interactions/select-menus/${module}`)
		 .filter((file) => file.endsWith(".js"));
	 for (const commandFile of commandFiles) {
		 const command = require(`./interactions/select-menus/${module}/${commandFile}`);
		 client.selectCommands.set(command.id, command);
	 }
 }


const rest = new REST({ version: "10" }).setToken(token);


const commandJsonData = [
	...Array.from(client.slashCommands.values()).map((c) => c.data.toJSON()),
	...Array.from(client.contextCommands.values()).map((c) => c.data),
];

(async () => {
	try {
		console.log("Started refreshing application (/) commands.");

		await rest.put(
			/**
			 * Here we are sending to discord our slash commands to be registered.
					There are 2 types of commands, guild commands and global commands.
					Guild commands are for specific guilds and global ones are for all.
					In development, you should use guild commands as guild commands update
					instantly, whereas global commands take upto 1 hour to be published. To
					deploy commands globally, replace the line below with:
				Routes.applicationCommands(client_id)
			 */

			Routes.applicationGuildCommands(client_id, test_guild_id),
			{ body: commandJsonData }
		);

		console.log("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
})();


const triggerFolders = readdirSync("./triggers");

// Loop through all files and store commands in commands collection.

for (const folder of triggerFolders) {
	const triggerFiles = readdirSync(`./triggers/${folder}`)
		.filter((file) => file.endsWith(".js"));
	for (const file of triggerFiles) {
		const trigger = require(`./triggers/${folder}/${file}`);
		client.triggers.set(trigger.name, trigger);
	}
}

client.on('ready', () => {
	if (command === 'reactionrole') {
        client.commands.get('reactionrole').execute(message, args, Discord, client);
    } 
  
});

// Login into your client application with bot's token.

client.login(token);
