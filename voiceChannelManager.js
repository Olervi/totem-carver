const {ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const DEFAULT_CHANNEL_NAMES = {
    '1290237362487689226': 'Chat 1',
    '1290237397476577313': 'Chat 2',
    '1290237424848474122': 'Chat 3'
};
const GAME_CHANNEL_NAMES = {
    leaguebutton: "League Chat",
    overwatchbutton: "Overwatch Chat",
    valorantbutton: "Valorant Chat"
};

const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('leaguebutton')
            .setLabel('League')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('overwatchbutton')
            .setLabel('Overwatch')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('valorantbutton')
            .setLabel('Valorant')
            .setStyle(ButtonStyle.Primary)
    );

async function userCount(client, channelId) {
    try {
        if (!channelId) return 0;
        let voiceChannel = await client.channels.fetch(channelId);
        if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) return 0;
        return voiceChannel.members?.size ?? 0;
    } catch (err) {
        console.error("While performing userCount:", err);
        return 0;
    }
}

async function handleVoiceStateUpdate(client, oldState, newState) {
    const member = newState.member;
    if (!member) return;
    const userid = member.id;
    const username = client.users.cache.get(userid)?.tag || 'Unknown user';

    if (newState.channelId === null) {
        console.log(`${username} left ${oldState.channel?.name}`);
        let countBeforeLeave = await userCount(client, oldState.channelId);
        console.log(`Users in ${oldState.channel?.name} before leaving: ${countBeforeLeave}`);

        // If the count before leaving was 1, it means they were the last one
        if (countBeforeLeave === 1) {
            try {
                let oldChannel = await client.channels.fetch(oldState.channelId);
                if (oldChannel) {
                    await oldChannel.setName(DEFAULT_CHANNEL_NAMES[oldState.channelId]);
                    console.log(`Renamed channel back to: ${DEFAULT_CHANNEL_NAMES[oldState.channelId]}`);
                }
            } catch (error) {
                console.error("Failed to rename channel:", error);
            }
        }
    } else if (oldState.channelId === null) {
        console.log(`${username} joined ${newState.channel?.name}`);
    } else {
        console.log(`${username} moved from ${oldState.channel?.name} to ${newState.channel?.name}`);
    }

    // Send message when user joins a tracked voice channel
    if (newState.channelId && DEFAULT_CHANNEL_NAMES[newState.channelId]) {
        try {
            let channel = await client.channels.fetch(newState.channelId);
            if (channel?.isTextBased()) {
                await channel.send({
                    content: "Welches Spiel wird aktuell gespielt?",
                    components: [row]
                });
            }
        } catch (error) {
            console.error("Failed to send message with buttons:", error);
        }
    }
}

//Handle button interactions
async function handleButtonInteraction(interaction) {
    if (!interaction.isButton()) return;
    const gameName = GAME_CHANNEL_NAMES[interaction.customId];
    let voiceChannel = interaction.member.voice.channel;

    try {
        await voiceChannel.setName(gameName);
        await interaction.deferUpdate();
        await interaction.reply({content: `Chat name changed to ${gameName}`, ephemeral: true});
    } catch (e) {
        console.error("Failed to rename channel:", e);
        await interaction.reply({content: "Failed to change", ephemeral: true});
    }

}

module.exports = {handleVoiceStateUpdate, handleButtonInteraction};