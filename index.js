const { readdirSync } = require('fs');
const { Client, Collection, Intents } = require('discord.js');
const {
  token,
  client_id,
  test_guild_id,
  prefix,
  AppClientID,
  AppSecretToken,
  welcomechannel,
} = require('./config.json');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const Discord = require('discord.js');
const { MessageEmbed } = require('discord.js');
const { ContextMenuCommandBuilder } = require('@discordjs/builders');
const { default: TwitchApi } = require('node-twitch');
const { config } = require('process');
const { channel } = require('diagnostics_channel');
const TwitchAPI = require('node-twitch').default;

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

// Twitch Auto Announcer

let channelName = 0;

const twitch = new TwitchApi({
  client_id: AppClientID,
  client_secret: AppSecretToken,
});
for (let i = 0; i < 4; i++) {
if (i = 0) {
  channelName = 'olervi'
} else if (i = 1) {
  channelName = 'ChannelName2'
} else if (i = 2) {
  channelName = 'ChannelName3'
} else if (i = 3) {
  channelName = 'ChannelName4'
} else if (i = 4) {
  channelName= 'ChannelName4'
}
let IsLiveMemory = false;
const run = async function Run() {
  await twitch.getStreams({ channel: channelName }).then(async (data) => {
    const r = data.data[0];
    let ThisGuildOnly = client.guilds.cache.get('972472318804779008');
    const ChannelAnnounceLive = ThisGuildOnly.channels.cache.find(
      (x) => x.id === '974259006325542972'
    );

    if (r !== undefined) {
      if (r.type === 'live') {
        if (IsLiveMemory === false || IsLiveMemory === undefined) {
          IsLiveMemory = true;
        } else if (IsLiveMemory === true) {
        } else {
        }
      } else {
        if (IsLiveMemory === true) {
          IsLiveMemory = false;
        } else {
        }
      }
    } else {
      if (IsLiveMemory === true) {
        IsLiveMemory = false;
      } else {
      }
    }
  });
};
};

setInterval(run, 15000);

client.commands = new Collection();
client.slashCommands = new Collection();
client.buttonCommands = new Collection();
client.selectCommands = new Collection();
client.contextCommands = new Collection();
client.cooldowns = new Collection();
client.triggers = new Collection();

//Rich Presence

client.on('ready', () => {
  const activity = [`$help | `];
  let activities = activity[Math.floor(Math.random() * activity.length)];
  client.user.setPresence({
    activities: [{ name: activities }],
    status: 'idle',
  });
  console.log('Rich Presence started');
});

//Join Msg

client.on('guildMemberAdd', (member) => {
  var Welcomechannel = welcomechannel;
  const welcomeChannel = member.guild.channels.cache.find(
    (channel) => channel.name === `${Welcomechannel}`
  );
  var embed = new Discord.MessageEmbed()
    .setDescription(`**${member} trat den Schamanen bei`)
    .setColor(color)
    .setTimestamp()
    .footer(client.user.username, member.user.displayAvatarURL());
  welcomeChannel.send(embed);
  console.log('Member +');
});
client.on('guildMemberRemove', (member) => {
  var Welcomechannel = welcomechannel;
  const welcomeChannel = member.guild.channels.cache.find(
    (channel) => channel.name === `${Welcomechannel}`
  );
  var embed = new Discord.MessageEmbed()
    .setDescription(`**${member} traf sich mit einem Verschwindungszauber`)
    .setColor(color)
    .setTimestamp()
    .footer(client.user.username, member.user.displayAvatarURL());
  welcomeChannel.send(embed);
  console.log('Member -');
});

//Rerading event files
const eventFiles = readdirSync('./events').filter((file) =>
  file.endsWith('.js')
);

const commandFiles = readdirSync('./commands/').filter((file) =>
  file.endsWith('.js')
);
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

//Registration Msg-based Commands

const commandFolders = readdirSync('./commands');

// Loop through all files and store commands in commands collection.

for (const folder of commandFolders) {
  const commandFiles = readdirSync(`./commands/${folder}`).filter((file) =>
    file.endsWith('.js')
  );
  for (const file of commandFiles) {
    const command = require(`./commands/${folder}/${file}`);
    client.commands.set(command.name, command);
  }
}

//Registration of Slash-Commands

const slashCommands = readdirSync('./interactions/slash');

// Loop through all files and store slash-commands in slashCommands collection.

for (const module of slashCommands) {
  const commandFiles = readdirSync(`./interactions/slash/${module}`).filter(
    (file) => file.endsWith('.js')
  );

  for (const commandFile of commandFiles) {
    const command = require(`./interactions/slash/${module}/${commandFile}`);
    client.slashCommands.set(command.data.name, command);
  }
}

const contextMenus = readdirSync('./interactions/context-menus');

// Loop through all files and store slash-commands in slashCommands collection.

for (const folder of contextMenus) {
  const files = readdirSync(`./interactions/context-menus/${folder}`).filter(
    (file) => file.endsWith('.js')
  );
  for (const file of files) {
    const menu = require(`./interactions/context-menus/${folder}/${file}`);
    const keyName = `${folder.toUpperCase()} ${menu.data.name}`;
    client.contextCommands.set(keyName, menu);
  }
}

const buttonCommands = readdirSync('./interactions/buttons');

// Loop through all files and store button-commands in buttonCommands collection.

for (const module of buttonCommands) {
  const commandFiles = readdirSync(`./interactions/buttons/${module}`).filter(
    (file) => file.endsWith('.js')
  );

  for (const commandFile of commandFiles) {
    const command = require(`./interactions/buttons/${module}/${commandFile}`);
    client.buttonCommands.set(command.id, command);
  }
}

const selectMenus = readdirSync('./interactions/select-menus');

// Loop through all files and store select-menus in slashCommands collection.

for (const module of selectMenus) {
  const commandFiles = readdirSync(
    `./interactions/select-menus/${module}`
  ).filter((file) => file.endsWith('.js'));
  for (const commandFile of commandFiles) {
    const command = require(`./interactions/select-menus/${module}/${commandFile}`);
    client.selectCommands.set(command.id, command);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

const commandJsonData = [
  ...Array.from(client.slashCommands.values()).map((c) => c.data.toJSON()),
  ...Array.from(client.contextCommands.values()).map((c) => c.data),
];

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

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

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

const triggerFolders = readdirSync('./triggers');

// Loop through all files and store commands in commands collection.

for (const folder of triggerFolders) {
  const triggerFiles = readdirSync(`./triggers/${folder}`).filter((file) =>
    file.endsWith('.js')
  );
  for (const file of triggerFiles) {
    const trigger = require(`./triggers/${folder}/${file}`);
    client.triggers.set(trigger.name, trigger);
  }
}

client.on('message', (message) => {
  if (!message.content.startsWith('$') || message.author.bot) return;

  const args = message.content.slice(prefix.length).split(/ +/);
  const command = args.shift().toLowerCase();
  if (command === 'reactionrole') {
    client.commands.get('reactionrole').execute(client, message, Discord, args);
  }
});

//Channel creation

var amount = [];
client.on('voiceStateUpdate', async (oldMember, newMember) => {
  let category = client.channels.cache.get('978715909906657350');
  let voiceCh = client.channels.cache.get('978716141931364423');
  if (newMember.channel == voiceCh) {
    await newMember.guilds.channels
      .create(`${newMember.member.displayName}'s Channel`, {
        type: 'voice',
        parent: category,
        permissionOverwrites: [
          {
            id: '972472318804779008', //@everyone
            deny: ['CONNECT'],
          },
          {
            id: '978717484851011584', //Muted
            deny: ['VIEW_CHANNEL', 'CONNECT', 'SPEAK', 'STREAM'],
          },
          {
            id: newMember.id, //Person
            allow: [
              'VIEW_CHANNEL',
              'CONNECT',
              'MANAGE_CHANNELS',
              'MANAGE_ROLES',
            ],
          },
          {
            id: newMember.id, //Member
            allow: [
              'VIEW_CHANNEL',
              'CONNECT',
              'SPEAK',
              'STREAM',
              //'PRIORITY_SPEAKER',
              'MANAGE_CHANNELS',
            ],
          },
        ],
      })
      .then(async (channel) => {
        amount.push({ newID: channel.id, guild: channel.guild });
        await newMember.setChannel(channel.id);
      });
  }
  if (amount.length > 0)
    for (let i = 0; i < amount.length; i++) {
      let ch = client.channels.cache.get(amount[i].newID);
      if (ch.members.size === 0) {
        await ch.delete();
        return amount.splice(i, 1);
      }
    }
});
// Login into your client application with bot's token.

client.login(token);
