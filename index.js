require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
} = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
    ]
});
const TOKEN = process.env.TOKEN;
const {handleVoiceStateUpdate, handleButtonInteraction} = require('./voiceChannelManager');


client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
client.on('voiceStateUpdate', (oldState, newState) => {
    // switch if config value is set to enable this feature
    handleVoiceStateUpdate(client, oldState, newState);
});
client.on("interactionCreate", async (interaction) => {
    if (interaction.isModalSubmit()) {
        await handleButtonInteraction(interaction);
    } else {
        await handleButtonInteraction(interaction);
    }
});

client.login(TOKEN);