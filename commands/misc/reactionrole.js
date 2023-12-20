const { MessageEmbed } = require("discord.js");



module.exports =  {
    name: 'reactionrole',
    description: "Sets up a reaction role message!",
        /** 
        * @param {Object} message 
        * @param {String[]} args
        * @type {Object}
		* @description Embed of Help command for a specific command.
        */
    execute(client, message, Discord, args) {
        const channel = '974258504862945372';
        
        const yellowTeamRole = (role => role.name === "Testgelb");
     //   const blueTeamRole = message.guild.roles.cache.find(role => role.name === "Testblau");
        const blueTeamRole = (role => role.name === "Testblau");

        const yellowTeamEmoji = client.emojis.chace.find(emoji => emoji.name === "thumbup");
        const blueTeamEmoji = client.emojis.chace.find(emoji => emoji.name === "thumbdown");
 
        let embed = new MessageEmbed()
        .setColor('#e42643')
        .setTitle('Choose a team to play on!')
        .setDescription('Choosing a team will allow you to interact with your teammates!\n\n'
            + `${yellowTeamEmoji} for yellow team\n`
            + `${blueTeamEmoji} for blue team`); 
        //const channel = require ();
        //let messageEmbed = await message.channel.send(embed);
        message.channel.send({ embeds: [embed] }).then(embedMessage => {
            embedMessage.react(yellowTeamEmoji)
            embedMessage.react(blueTeamEmoji);
            
        }) ;
        //embed.react(yellowTeamEmoji);
        //embed.react(yellowTeamEmoji);
        //embed.react(blueTeamEmoji);
 
        client.on('messageReactionAdd', async (reaction, user) => {
            if (reaction.message.partial) await reaction.message.fetch();
            if (reaction.partial) await reaction.fetch();
            if (user.bot) return;
            if (!reaction.message.guild) return;
 
            if (reaction.message.channel.id == channel) {
                if (reaction.emoji.name === yellowTeamEmoji) {
                    await reaction.message.guild.members.cache.get(user.id).roles.add(yellowTeamRole);
                }
                if (reaction.emoji.name === blueTeamEmoji) {
                    await reaction.message.guild.members.cache.get(user.id).roles.add(blueTeamRole);
                }
            } else {

            }
 
        });
 
        client.on('messageReactionRemove', async (reaction, user) => {
 
            if (reaction.message.partial) await reaction.message.fetch();
            if (reaction.partial) await reaction.fetch();
            if (user.bot) return;
            if (!reaction.message.guild) return;
 
 
            if (reaction.message.channel.id == channel) {
                if (reaction.emoji.name === yellowTeamEmoji) {
                    await reaction.message.guild.members.cache.get(user.id).roles.remove(yellowTeamRole);
                }
                if (reaction.emoji.name === blueTeamEmoji) {
                    await reaction.message.guild.members.cache.get(user.id).roles.remove(blueTeamRole);
                }
            } else {

            }
        });
    }
 
}   
