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
    ]
});
const {TOKEN} = require('./config.json');
const {handleVoiceStateUpdate, handleButtonInteraction} = require('./voiceChannelManager');


client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
client.on('voiceStateUpdate', (oldState, newState) => {
    handleVoiceStateUpdate(client, oldState, newState);
});
client.on("interactionCreate", async (interaction) => {
    await handleButtonInteraction(interaction);
});

client.login(TOKEN);