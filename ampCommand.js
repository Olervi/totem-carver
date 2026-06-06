const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const configManager = require('./configManager');
const {pollOnce} = require('./ampMonitor');

const data = new SlashCommandBuilder()
    .setName('amp')
    .setDescription('CubeCoders AMP Server-Monitor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('AMP Verbindung und Status-Channel einrichten')
        .addStringOption(opt => opt
            .setName('url')
            .setDescription('AMP URL (z.B. http://192.168.1.1:8080)')
            .setRequired(true))
        .addStringOption(opt => opt
            .setName('username')
            .setDescription('AMP Benutzername')
            .setRequired(true))
        .addStringOption(opt => opt
            .setName('password')
            .setDescription('AMP Passwort')
            .setRequired(true))
        .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('Channel für den Live-Status')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub => sub
        .setName('toggle')
        .setDescription('AMP Monitor aktivieren/deaktivieren')
        .addStringOption(opt => opt
            .setName('status')
            .setDescription('An oder Aus')
            .setRequired(true)
            .addChoices(
                {name: 'Aktivieren', value: 'enable'},
                {name: 'Deaktivieren', value: 'disable'}
            )))
    .addSubcommand(sub => sub
        .setName('refresh')
        .setDescription('Status sofort aktualisieren'))
    .addSubcommand(sub => sub
        .setName('show')
        .setDescription('Aktuelle AMP Konfiguration anzeigen'))
    .addSubcommand(sub => sub
        .setName('reset')
        .setDescription('Gespeicherte Message-IDs zurücksetzen (neue Nachrichten erstellen)'));

async function handle(interaction, client) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'amp') return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
        const url = interaction.options.getString('url').replace(/\/$/, ''); // trailing slash entfernen
        const username = interaction.options.getString('username');
        const password = interaction.options.getString('password');
        const channel = interaction.options.getChannel('channel');

        await interaction.deferReply({ephemeral: true});

        // Verbindung testen
        try {
            const testRes = await fetch(`${url}/API/Core/Login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.cubecoders-ampapi'
                },
                body: JSON.stringify({username, password, token: '', rememberMe: false})
            });
            const testData = await testRes.json();
            console.log('[AMP Debug] Login Response:', JSON.stringify(testData, null, 2));
            if (!testData.success) {
                return interaction.editReply(`❌ Login fehlgeschlagen: ${testData.resultReason}`);
            }
        } catch (err) {
            return interaction.editReply(`❌ AMP nicht erreichbar: ${err.message}\nURL prüfen: \`${url}\``);
        }

        // Config speichern
        const cfg = configManager.load();
        cfg.amp = {
            enabled: true,
            url,
            username,
            password,
            channelId: channel.id,
            messageIds: {}
        };
        configManager.save(cfg);

        await interaction.editReply([
            '✅ **AMP Setup gespeichert:**',
            `🌐 URL: \`${url}\``,
            `👤 User: \`${username}\``,
            `📢 Channel: <#${channel.id}>`,
            '',
            '⏳ Ersten Status-Update wird gleich gesendet...'
        ].join('\n'));

        // Sofort ersten Poll ausführen
        await pollOnce(client);
        return;
    }

    if (sub === 'toggle') {
        const enable = interaction.options.getString('status') === 'enable';
        configManager.set('amp.enabled', enable);
        return interaction.reply({
            content: `🖥️ AMP Monitor: ${enable ? '✅ Aktiviert' : '❌ Deaktiviert'}`,
            ephemeral: true
        });
    }

    if (sub === 'refresh') {
        await interaction.deferReply({ephemeral: true});
        await pollOnce(client);
        return interaction.editReply('🔄 Status wurde aktualisiert.');
    }

    if (sub === 'show') {
        const amp = configManager.get('amp');
        if (!amp?.url) {
            return interaction.reply({
                content: '⚠️ AMP ist noch nicht konfiguriert. Nutze `/amp setup`.',
                ephemeral: true
            });
        }

        const instanceCount = Object.keys(amp.messageIds ?? {}).length;
        const embed = new EmbedBuilder()
            .setTitle('🖥️ AMP Konfiguration')
            .setColor(0x5865F2)
            .addFields(
                {name: '🌐 URL', value: `\`${amp.url}\``, inline: true},
                {name: '👤 User', value: `\`${amp.username}\``, inline: true},
                {name: '📢 Channel', value: `<#${amp.channelId}>`, inline: true},
                {name: '🔄 Status', value: amp.enabled ? '✅ Aktiv' : '❌ Deaktiviert', inline: true},
                {name: '🖥️ Bekannte Instanzen', value: String(instanceCount), inline: true}
            )
            .setTimestamp();

        return interaction.reply({embeds: [embed], ephemeral: true});
    }

    if (sub === 'reset') {
        configManager.set('amp.messageIds', {});
        return interaction.reply({
            content: '🗑️ Message-IDs zurückgesetzt — beim nächsten Update werden neue Nachrichten erstellt.',
            ephemeral: true
        });
    }
}

module.exports = {data, handle};