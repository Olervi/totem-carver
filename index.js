const { readdirSync } = require('fs');
const { Client, Collection, Intents, EmbedBuilder, ChannelType, GuildMember} = require('discord.js');
const {
  token,
  client_id,
  test_guild_id,
  prefix,
  AppClientID,
  AppSecretToken,
  welcome_channel,
  createVcC,
  createVc,
  guildID
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

let channelName = 'olervi';

const twitch = new TwitchApi({
  client_id: AppClientID,
  client_secret: AppSecretToken,
});

let IsLiveMemory = false;
const run = async function Run() {
  await twitch.getStreams({ channel: channelName }).then(async (data) => {
    const r = data.data[0];
    let ThisGuildOnly = client.guilds.cache.get('1186250191393787934');
    const ChannelAnnounceLive = ThisGuildOnly.channels.cache.get('1186251892515422258')

    if (r !== undefined) {
      if (r.type === 'live') {
        if (IsLiveMemory === false || IsLiveMemory === undefined) {
          IsLiveMemory = true;
        } else if (IsLiveMemory === true) {} else {}
        } else if (IsLiveMemory === true){
          IsLiveMemory = false;
      } else {}
    } else if (IsLiveMemory === true){
        IsLiveMemory = false;
      } else {}
  });
}


setInterval(run, 15000);

client.commands = new Collection();
client.slashCommands = new Collection();
client.buttonCommands = new Collection();
client.selectCommands = new Collection();
client.contextCommands = new Collection();
client.cooldowns = new Collection();
client.triggers = new Collection();
client.on('guildMemberRemove', (member) => {
  let Welcome_channel = welcome_channel;
  const welcomeChannel = client.channels.cache.find(
    (channel) => channel.name === `${Welcome_channel}`
  );
  let embed = new EmbedBuilder()
    .setDescription(`**${member} traf sich mit einem Verschwindungszauber`)
    .setColor("GREEN")
    .setTimestamp()
    .setFooter(client.user.username, member.user.displayAvatarURL());
  Welcome_channel.send(embed);
  console.log('Member '+ client.user.username + 'left');
});

//Rereading event files
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
const commandJsonData = [
  ...Array.from(client.slashCommands.values()).map((c) => c.data.toJSON()),
  ...Array.from(client.contextCommands.values()).map((c) => c.data),
];
const rest = new REST().setToken(token);
(async () => {
  try {
    console.log('Started refreshing (/) commands');
    await rest.put(
        Routes.applicationGuildCommands(client_id, test_guild_id),
        {body: commandJsonData}
    )
  } catch (e) {
    console.error('Error during command registration:', e);
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
let amount = [];
client.on('voiceStateUpdate', async(oldMember, newMember) => {
  const category = createVcC;
  if (newMember.channel === createVc){
    await newMember.guild.channels.create(
      `${newMember.member.displayName}'s Channel`, {
        type: ChannelType.GuildVoice,
          permissionOverwrites: [
            {
              id: '1186250191393787934', //@everyone
              deny: ['CONNECT'],
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
      }).then(async (channel) => {
      amount.push({ newID: channel.id, guild: channel.guild });
      await newMember.setChannel(channel.id);
    });
  }
  if (amount.length > 0)
    for (let i = 0; i < amount.length; i++) {
      let ch = client.channels.cache.get(amount[i].newID);
      if (!ch.members.cache.hasAny(GuildMember)) {
        await ch.delete;
        return amount.splice(i, 1);
      }
    }
});
// Login into your client application with bot's token.
async function startBot() {
  try {
    await client.login(token);
    console.log(`Logged in as ${client.user.tag}`);
  } catch (error) {
    console.error('Error during login:', error);
  }
}
(async () => {
  await startBot();
})();