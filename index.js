require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const {handleVoiceStateUpdate, handleButtonInteraction, handleModalSubmit} = require('./voiceChannelManager');
const configCommand = require('./configCommand');
const embedCommand = require('./embedCommand');
const twitchCommand = require('./twitchCommand');
const {startPoller: startTwitchPoller} = require('./twitchAnnouncer');
const {startPoller: startAmpPoller} = require('./ampMonitor');
const ampCommand = require("./ampCommand");

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


client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    try {
        const rest = new REST({version: '10'}).setToken(TOKEN);
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            {
                body: [
                    configCommand.data.toJSON(),
                    embedCommand.data.toJSON(),
                    twitchCommand.data.toJSON(),
                    ampCommand.data.toJSON()
                ]
            }
        );
        console.log('Slash Commands registered');
    } catch (e) {
        console.error('Error whilst registering Slash Commands:', e)
    }

    startTwitchPoller(client);
    startAmpPoller(client);
});
client.on('voiceStateUpdate', (oldState, newState) => {
    // switch if config value is set to enable this feature
    handleVoiceStateUpdate(client, oldState, newState);
});
client.on("interactionCreate", async (interaction) => {
    console.log('Interaction:', interaction.type, interaction.customId ?? interaction.commandName);
// Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'config') await configCommand.handle(interaction);
        if (interaction.commandName === 'embed') await embedCommand.handle(interaction);
        if (interaction.commandName === 'twitch') await twitchCommand.handle(interaction);
        if (interaction.commandName === 'amp') await ampCommand.handle(interaction, client);
        return;
    }

    // Embed Builder — Buttons, Modals, Select
    if (interaction.isButton() && interaction.customId.startsWith('eb_')) {
        await embedCommand.handle(interaction);
        return;
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ebm_')) {
        await embedCommand.handle(interaction);
        return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'eb_channel_select') {
        await embedCommand.handle(interaction);
        return;
    }

    // Voice Channel Manager — Modals & Buttons
    if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
        return;
    }
    await handleButtonInteraction(interaction);
});

client.login(TOKEN);