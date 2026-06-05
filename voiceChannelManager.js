const {
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const DEFAULT_CHANNEL_NAMES = {
    '1290237362487689226': 'Chat 1',
    '1290237397476577313': 'Chat 2',
    '1290237424848474122': 'Chat 3'
};

const channelMessages = new Map();
const MESSAGE_TIMEOUT_MS = 5 * 60 * 1000;
const presenceCache = new Map();


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

function detectGamesFromCache(voiceChannel) {
    const gameCounts = new Map();

    for (const [, member] of voiceChannel.members) {
        const activity = member.presence?.activities?.find(a => a.type === 0);
        if (activity) {
            gameCounts.set(activity.name, (gameCounts.get(activity.name) || 0) + 1);
        }
    }

    return [...gameCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name); // gibt immer ein Array zurück, ggf. leer []
}

function buildButtonRow(detectedGames = []) { // Fallback auf leeres Array
    const row = new ActionRowBuilder();

    for (const game of detectedGames) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`game_${game}`)
                .setLabel(game.length > 80 ? game.slice(0, 80) : game)
                .setStyle(ButtonStyle.Primary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('game_custom')
            .setLabel('Anderes Spiel...')
            .setStyle(ButtonStyle.Secondary)
    );

    return row;
}

async function handleVoiceStateUpdate(client, oldState, newState) {
    const member = newState.member;
    if (!member) return;
    const username = member.user.tag;

    // User hat Channel verlassen
    if (!newState.channelId) {
        console.log(`${username} left ${oldState.channel?.name}`);
        const channel = oldState.channel;
        if (channel && channel.members.size === 0 && DEFAULT_CHANNEL_NAMES[channel.id]) {
            try {
                await channel.setName(DEFAULT_CHANNEL_NAMES[channel.id]);
                console.log(`Renamed back to: ${DEFAULT_CHANNEL_NAMES[channel.id]}`);
            } catch (err) {
                console.error('Failed to rename channel:', err);
            }

            // Nachricht löschen falls noch vorhanden
            const saved = channelMessages.get(channel.id);
            if (saved) {
                try {
                    await saved.message.delete();
                } catch (_) {
                }
                clearTimeout(saved.timeout);
                channelMessages.delete(channel.id);
            }
        }
        return;
    }

    // User hat Channel betreten
    if (!oldState.channelId && DEFAULT_CHANNEL_NAMES[newState.channelId]) {
        console.log(`${username} joined ${newState.channel?.name}`);

        setTimeout(async () => {
            try {
                const channel = await client.channels.fetch(newState.channelId);
                if (!channel || channel.type !== ChannelType.GuildVoice) return;
                if (channel.members.size === 0) return;

                // Presences aus Cache lesen
                await channel.guild.members.fetch({withPresences: true});

                // Debug:
                let presenceCount = 0;
                for (const [, member] of channel.members) {
                    console.log(`${member.user.tag} presence:`, member.presence?.activities?.map(a => a.name));
                    if (member.presence) presenceCount++;
                }
                console.log(`Members with presence: ${presenceCount}/${channel.members.size}`);


                const detectedGames = detectGamesFromCache(channel);

                console.log(`Detected games in ${channel.name}:`, detectedGames);

                const row = buildButtonRow(detectedGames);
                const content = detectedGames.length > 0
                    ? 'Welches Spiel wird gespielt?'
                    : 'Welches Spiel wird gespielt? (Keines erkannt)';

                // Nachricht in den Text-Channel schicken (falls Voice-Channel textfähig)
                // Alternativ: in einen definierten Text-Channel
                const sentMessage = await channel.send({content, components: [row]});

                // Auto-Delete nach 5 Minuten
                const timeout = setTimeout(async () => {
                    try {
                        await sentMessage.delete();
                    } catch (_) {
                    }
                    channelMessages.delete(channel.id);
                }, MESSAGE_TIMEOUT_MS);

                channelMessages.set(channel.id, {message: sentMessage, timeout});
            } catch (err) {
                console.error('Error in voiceStateUpdate handler:', err);
            }
        }, 5000);
    }
}

async function handleButtonInteraction(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('game_')) return;

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
        await interaction.reply({content: 'Du bist in keinem Voice-Channel!', ephemeral: true});
        return;
    }

    // "Anderes Spiel..." → Modal öffnen
    if (interaction.customId === 'game_custom') {
        const modal = new ModalBuilder()
            .setCustomId(`modal_gamename_${voiceChannel.id}`)
            .setTitle('Spiel eingeben');

        const input = new TextInputBuilder()
            .setCustomId('gamename_input')
            .setLabel('Spielname')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('z.B. Minecraft')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    // Spiel-Button geklickt
    const gameName = interaction.customId.replace('game_', '');
    await renameAndCleanup(interaction, voiceChannel, gameName);
}

async function handleModalSubmit(interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('modal_gamename_')) return;

    const channelId = interaction.customId.replace('modal_gamename_', '');
    const gameName = interaction.fields.getTextInputValue('gamename_input');

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel || voiceChannel.id !== channelId) {
        await interaction.reply({content: 'Channel nicht gefunden.', ephemeral: true});
        return;
    }

    await renameAndCleanup(interaction, voiceChannel, gameName);
}

async function renameAndCleanup(interaction, voiceChannel, gameName) {
    try {
        await voiceChannel.setName(gameName);
        await interaction.reply({content: `Channel umbenannt zu: **${gameName}**`, ephemeral: true});

        const saved = channelMessages.get(voiceChannel.id);
        if (saved) {
            try {
                await saved.message.delete();
            } catch (_) {
            }
            clearTimeout(saved.timeout);
            channelMessages.delete(voiceChannel.id);
        }
    } catch (err) {
        console.error('Failed to rename channel:', err);
        await interaction.reply({content: 'Fehler beim Umbenennen.', ephemeral: true});
    }
}

module.exports = {handleVoiceStateUpdate, handleButtonInteraction, handleModalSubmit};