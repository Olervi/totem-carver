const { Client, Intents } = require('discord.js');
const config = require('../config.json')
const {ClientReady} = require("events");
const client = new Client({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES
        ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

client.once("ready", () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});



client.login(config.token);