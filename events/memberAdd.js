const Discord = require("discord.js");
module.exports = {
    name: "memberAdd",
    once: false,
    execute(client) {
        client.on('guildMemberAdd', (member) => {
            let Welcome_channel = welcome_channel;
            const welcomeChannel = member.guild.channels.cache.find(
                (channel) => channel.name === `${Welcome_channel}`
            );
            let embed = new Discord.MessageEmbed()
                .setDescription(`**${member} trat den Schamanen bei`)
                .setColor("GREEN")
                .setTimestamp()
                .footer(client.user.username, member.user.displayAvatarURL());
            welcomeChannel.send(embed);
            console.log('Member '+ client.user.username + 'joined');
        });
    }
};