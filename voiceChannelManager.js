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

const channelMessages = new Map();

const presenceCache = new Map();

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

async function detectGame(voiceChannel) {

    await voiceChannel.guild.members.fetch({withPresences: true});

    const members = voiceChannel.members;
    const gameCounts = new Map();

    for (const [, member] of members) {
        // Presence explizit fetchen statt nur aus Cache lesen
        const fetchedMember = await voiceChannel.guild.members.fetch({
            user: member.id,
            withPresences: true
        });

        console.log(`Presence von ${fetchedMember.user.tag}:`, fetchedMember.presence);
        console.log(`Activities:`, fetchedMember.presence?.activities);


        const activity = fetchedMember.presence?.activities.find(a => a.type === 0);
        if (activity) {
            const game = activity.name;
            gameCounts.set(game, (gameCounts.get(game) || 0) + 1);
        }
    }

    const total = members.size;
    for (const [game, count] of gameCounts) {
        if (count / total >= 0.5) return game;
    }
    return null;
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
        if (countBeforeLeave === 0) {
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

        setTimeout(async () => {
            const channel = await client.channels.fetch(newState.channelId);
            const game = await detectGame(channel);
            console.log(`Auto-detected Game ${game} in ${channel.name}`);
            if (game) await channel.setName(game);
        }, 5000);
    } else {
        console.log(`${username} moved from ${oldState.channel?.name} to ${newState.channel?.name}`);
    }

    // Send message when user joins a tracked voice channel
    if (newState.channelId && DEFAULT_CHANNEL_NAMES[newState.channelId]) {
        try {
            let channel = await client.channels.fetch(newState.channelId);
            if (channel?.isTextBased()) {
                const sentMessage = await channel.send({
                    content: "Welches Spiel wird aktuell gespielt?",
                    components: [row]
                });
                channelMessages.set(newState.channelId, sentMessage);
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

    if (!voiceChannel) {
        await interaction.reply({content: "Du bist in keinem Voice-Channel!", ephemeral: true});
        return;
    }

    try {
        await voiceChannel.setName(gameName);
        //await interaction.deferUpdate();
        await interaction.reply({content: `Chat name changed to ${gameName}`, ephemeral: true});

        const savedMessage = channelMessages.get(voiceChannel.id);
        if (savedMessage) {
            await savedMessage.delete();
            channelMessages.delete(voiceChannel.id);
        }
    } catch (e) {
        console.error("Failed to rename channel:", e);
        await interaction.reply({content: "Failed to change", ephemeral: true});
    }

}

module.exports = {handleVoiceStateUpdate, handleButtonInteraction};