const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

// Laufende Builder-Sessions: userId → sessionData
const builderSessions = new Map();

// ─── Slash Command Definition ────────────────────────────────────────────────

const data = new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Custom Embed erstellen')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // /embed quick
    .addSubcommand(sub => sub
        .setName('quick')
        .setDescription('Embed direkt mit allen Optionen erstellen')
        .addStringOption(opt => opt
            .setName('titel')
            .setDescription('Titel des Embeds')
            .setRequired(true))
        .addStringOption(opt => opt
            .setName('beschreibung')
            .setDescription('Beschreibung / Haupttext')
            .setRequired(true))
        .addStringOption(opt => opt
            .setName('farbe')
            .setDescription('Hex-Farbe (z.B. #5865F2) — Standard: Blau')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('footer')
            .setDescription('Footer-Text')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('author')
            .setDescription('Author-Name')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('bild')
            .setDescription('Bild-URL (großes Bild unten)')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('thumbnail')
            .setDescription('Thumbnail-URL (kleines Bild oben rechts)')
            .setRequired(false))
        .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('Ziel-Channel (Standard: dieser Channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)))

    // /embed builder
    .addSubcommand(sub => sub
        .setName('builder')
        .setDescription('Embed interaktiv Schritt für Schritt aufbauen'));

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function parseColor(input) {
    if (!input) return 0x5865F2;
    const hex = input.replace('#', '');
    const parsed = parseInt(hex, 16);
    return isNaN(parsed) ? 0x5865F2 : parsed;
}

function sessionToEmbed(session) {
    const embed = new EmbedBuilder().setColor(parseColor(session.farbe));

    if (session.titel) embed.setTitle(session.titel);
    if (session.beschreibung) embed.setDescription(session.beschreibung);
    if (session.footer) embed.setFooter({text: session.footer});
    if (session.author) embed.setAuthor({name: session.author});
    if (session.bild) {
        try {
            embed.setImage(session.bild);
        } catch (_) {
        }
    }
    if (session.thumbnail) {
        try {
            embed.setThumbnail(session.thumbnail);
        } catch (_) {
        }
    }

    if (session.fields?.length > 0) {
        embed.addFields(session.fields.map(f => ({
            name: f.name,
            value: f.value,
            inline: f.inline ?? false
        })));
    }

    return embed;
}

function builderButtons(session) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_set_titel')
            .setLabel('📝 Titel')
            .setStyle(session.titel ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('eb_set_beschreibung')
            .setLabel('📄 Beschreibung')
            .setStyle(session.beschreibung ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('eb_set_farbe')
            .setLabel('🎨 Farbe')
            .setStyle(session.farbe ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('eb_set_footer')
            .setLabel('🔻 Footer')
            .setStyle(session.footer ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('eb_set_author')
            .setLabel('👤 Author')
            .setStyle(session.author ? ButtonStyle.Success : ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_set_bild')
            .setLabel('🖼️ Bild')
            .setStyle(session.bild ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('eb_set_thumbnail')
            .setLabel('🔲 Thumbnail')
            .setStyle(session.thumbnail ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('eb_add_field')
            .setLabel(`➕ Field (${session.fields?.length ?? 0}/25)`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled((session.fields?.length ?? 0) >= 25),
        new ButtonBuilder()
            .setCustomId('eb_clear_fields')
            .setLabel('🗑️ Fields leeren')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!session.fields?.length),
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('eb_send')
            .setLabel('📤 Senden')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!session.titel && !session.beschreibung),
        new ButtonBuilder()
            .setCustomId('eb_cancel')
            .setLabel('❌ Abbrechen')
            .setStyle(ButtonStyle.Danger),
    );

    return [row1, row2, row3];
}

function previewContent(session) {
    const lines = ['**Embed-Builder — Vorschau:**'];
    if (!session.titel && !session.beschreibung) {
        lines.push('*(Bitte mindestens Titel oder Beschreibung setzen)*');
    }
    return lines.join('\n');
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handle(interaction) {
    // Slash Command
    if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'quick') return handleQuick(interaction);
        if (sub === 'builder') return handleBuilderStart(interaction);
    }

    // Buttons
    if (interaction.isButton() && interaction.customId.startsWith('eb_')) {
        return handleBuilderButton(interaction);
    }

    // Modals
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ebm_')) {
        return handleBuilderModal(interaction);
    }

    // Channel-Select nach "Senden"
    if (interaction.isStringSelectMenu() && interaction.customId === 'eb_channel_select') {
        return handleChannelSelect(interaction);
    }
}

// /embed quick
async function handleQuick(interaction) {
    const titel = interaction.options.getString('titel');
    const beschreibung = interaction.options.getString('beschreibung');
    const farbe = interaction.options.getString('farbe');
    const footer = interaction.options.getString('footer');
    const author = interaction.options.getString('author');
    const bild = interaction.options.getString('bild');
    const thumbnail = interaction.options.getString('thumbnail');
    const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;

    const session = {titel, beschreibung, farbe, footer, author, bild, thumbnail, fields: []};
    const embed = sessionToEmbed(session);

    try {
        await targetChannel.send({embeds: [embed]});
        await interaction.reply({
            content: `✅ Embed gesendet in <#${targetChannel.id}>`,
            ephemeral: true
        });
    } catch (err) {
        console.error('Fehler beim Senden des Embeds:', err);
        await interaction.reply({
            content: '❌ Fehler beim Senden. Prüfe ob URLs gültig sind und der Bot Zugriff auf den Channel hat.',
            ephemeral: true
        });
    }
}

// /embed builder — Start
async function handleBuilderStart(interaction) {
    const session = {
        titel: '',
        beschreibung: '',
        farbe: '',
        footer: '',
        author: '',
        bild: '',
        thumbnail: '',
        fields: [],
    };
    builderSessions.set(interaction.user.id, session);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Neuer Embed')
        .setDescription('*(noch leer)*');

    await interaction.reply({
        content: previewContent(session),
        embeds: [embed],
        components: builderButtons(session),
        ephemeral: true
    });
}

// Builder Button-Klicks
async function handleBuilderButton(interaction) {
    const userId = interaction.user.id;
    const session = builderSessions.get(userId);

    if (!session) {
        return interaction.reply({content: '⚠️ Session abgelaufen. Starte mit `/embed builder` neu.', ephemeral: true});
    }

    const id = interaction.customId;

    // Abbrechen
    if (id === 'eb_cancel') {
        builderSessions.delete(userId);
        return interaction.update({
            content: '❌ Builder abgebrochen.',
            embeds: [],
            components: []
        });
    }

    // Fields leeren
    if (id === 'eb_clear_fields') {
        session.fields = [];
        return interaction.update({
            content: previewContent(session),
            embeds: [sessionToEmbed(session)],
            components: builderButtons(session)
        });
    }

    // Senden → Channel-Auswahl zeigen
    if (id === 'eb_send') {
        const channels = interaction.guild.channels.cache
            .filter(c => c.type === ChannelType.GuildText)
            .first(25);

        const options = channels.map(c => ({label: `#${c.name}`, value: c.id}));
        // Aktuellen Channel als erstes
        const currentFirst = [{label: `# Dieser Channel (${interaction.channel.name})`, value: interaction.channelId}];
        const allOptions = [
            ...currentFirst,
            ...options.filter(o => o.value !== interaction.channelId)
        ].slice(0, 25);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('eb_channel_select')
                .setPlaceholder('Channel auswählen...')
                .addOptions(allOptions)
        );

        return interaction.update({
            content: '📤 **In welchen Channel soll der Embed gesendet werden?**',
            embeds: [sessionToEmbed(session)],
            components: [row]
        });
    }

    // Modal-Felder
    const modalMap = {
        eb_set_titel: {
            id: 'ebm_titel',
            title: 'Titel setzen',
            label: 'Titel',
            key: 'titel',
            placeholder: 'z.B. Willkommen!'
        },
        eb_set_beschreibung: {
            id: 'ebm_beschreibung',
            title: 'Beschreibung setzen',
            label: 'Beschreibung',
            key: 'beschreibung',
            placeholder: 'Haupttext des Embeds...',
            long: true
        },
        eb_set_farbe: {
            id: 'ebm_farbe',
            title: 'Farbe setzen',
            label: 'Hex-Farbe',
            key: 'farbe',
            placeholder: '#5865F2'
        },
        eb_set_footer: {
            id: 'ebm_footer',
            title: 'Footer setzen',
            label: 'Footer-Text',
            key: 'footer',
            placeholder: 'z.B. Bot-Name • Datum'
        },
        eb_set_author: {
            id: 'ebm_author',
            title: 'Author setzen',
            label: 'Author-Name',
            key: 'author',
            placeholder: 'z.B. Servername'
        },
        eb_set_bild: {
            id: 'ebm_bild',
            title: 'Bild-URL setzen',
            label: 'Bild-URL',
            key: 'bild',
            placeholder: 'https://...'
        },
        eb_set_thumbnail: {
            id: 'ebm_thumbnail',
            title: 'Thumbnail-URL setzen',
            label: 'Thumbnail-URL',
            key: 'thumbnail',
            placeholder: 'https://...'
        },
        eb_add_field: {id: 'ebm_field', title: 'Field hinzufügen', label: null, key: null},
    };

    const def = modalMap[id];
    if (!def) return;

    const modal = new ModalBuilder().setCustomId(def.id).setTitle(def.title);

    if (id === 'eb_add_field') {
        // Zwei Inputs: Name + Wert
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_name')
                    .setLabel('Field-Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('z.B. Info')
                    .setRequired(true)
                    .setMaxLength(256)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_value')
                    .setLabel('Field-Wert')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('z.B. Hier steht der Inhalt...')
                    .setRequired(true)
                    .setMaxLength(1024)
            )
        );
    } else {
        const input = new TextInputBuilder()
            .setCustomId('value')
            .setLabel(def.label)
            .setStyle(def.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setPlaceholder(def.placeholder)
            .setRequired(false)
            .setMaxLength(def.long ? 4000 : 256)
            .setMinLength(0);

        const currentValue = session[def.key];
        if (currentValue && currentValue.length > 0) input.setValue(currentValue);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    await interaction.showModal(modal);
}

// Builder Modal-Eingaben
async function handleBuilderModal(interaction) {
    const userId = interaction.user.id;
    const session = builderSessions.get(userId);

    if (!session) {
        return interaction.reply({content: '⚠️ Session abgelaufen.', ephemeral: true});
    }

    const id = interaction.customId;

    const keyMap = {
        ebm_titel: 'titel',
        ebm_beschreibung: 'beschreibung',
        ebm_farbe: 'farbe',
        ebm_footer: 'footer',
        ebm_author: 'author',
        ebm_bild: 'bild',
        ebm_thumbnail: 'thumbnail',
    };

    if (id === 'ebm_field') {
        const name = interaction.fields.getTextInputValue('field_name');
        const value = interaction.fields.getTextInputValue('field_value');
        session.fields.push({name, value, inline: false});
    } else if (keyMap[id]) {
        session[keyMap[id]] = interaction.fields.getTextInputValue('value') || '';
    }

    await interaction.update({
        content: previewContent(session),
        embeds: [sessionToEmbed(session)],
        components: builderButtons(session)
    });
}

// Channel ausgewählt → Embed senden
async function handleChannelSelect(interaction) {
    const userId = interaction.user.id;
    const session = builderSessions.get(userId);

    if (!session) {
        return interaction.update({content: '⚠️ Session abgelaufen.', embeds: [], components: []});
    }

    const channelId = interaction.values[0];
    const targetChannel = interaction.guild.channels.cache.get(channelId);

    if (!targetChannel) {
        return interaction.update({content: '❌ Channel nicht gefunden.', embeds: [], components: []});
    }

    try {
        await targetChannel.send({embeds: [sessionToEmbed(session)]});
        builderSessions.delete(userId);
        await interaction.update({
            content: `✅ Embed gesendet in <#${channelId}>`,
            embeds: [],
            components: []
        });
    } catch (err) {
        console.error('Fehler beim Senden:', err);
        await interaction.update({
            content: '❌ Fehler beim Senden. Prüfe ob URLs gültig sind und der Bot Zugriff auf den Channel hat.',
            embeds: [],
            components: []
        });
    }
}

module.exports = {data, handle};