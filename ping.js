const {REST, Routes} = require("discord.js");

const commands = [
    {
        name: "ping",
        description: "Ping",
    },
];
const rest = new REST({version: '10'}).setToken(TOKEN);
try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(CLIENT_ID), {body: {commands}});
} catch (e) {
    console.error(e);
}