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

    // ── Setup & Globales ──────────────────────────────────────────────────────
    .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('AMP Verbindung und Status-Channel einrichten')
        .addStringOption(opt => opt
            .setName('url')
            .setDescription('AMP Basis-URL ohne Port (z.B. http://localhost oder https://amp.example.com)')
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
        .setDescription('Gespeicherte Message-IDs zurücksetzen (neue Nachrichten erstellen)'))

    // ── Instanz-Verwaltung ────────────────────────────────────────────────────
    .addSubcommand(sub => sub
        .setName('instance-add')
        .setDescription('Instanz zum Monitor hinzufügen')
        .addStringOption(opt => opt
            .setName('name')
            .setDescription('Anzeigename der Instanz (z.B. "Minecraft SMP")')
            .setRequired(true))
        .addIntegerOption(opt => opt
            .setName('port')
            .setDescription('Port der Instanz (z.B. 8081)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(65535))
        .addStringOption(opt => opt
            .setName('adresse')
            .setDescription('Angezeigte Adresse (Standard: amp-url:port)')
            .setRequired(false)))

    .addSubcommand(sub => sub
        .setName('instance-remove')
        .setDescription('Instanz aus dem Monitor entfernen')
        .addIntegerOption(opt => opt
            .setName('port')
            .setDescription('Port der zu entfernenden Instanz')
            .setRequired(true)))

    .addSubcommand(sub => sub
        .setName('instance-list')
        .setDescription('Alle konfigurierten Instanzen anzeigen'));

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handle(interaction, client) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'amp') return;

    const sub = interaction.options.getSubcommand();

    // ── /amp setup ────────────────────────────────────────────────────────────
    if (sub === 'setup') {
        const baseUrl = interaction.options.getString('url').replace(/\/$/, '');
        const username = interaction.options.getString('username');
        const password = interaction.options.getString('password');
        const channel = interaction.options.getChannel('channel');

        await interaction.deferReply({ephemeral: true});

        // Verbindung testen — Login auf der Basis-URL (kein Port)
        try {
            const testRes = await fetch(`${baseUrl}/API/Core/Login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.cubecoders-ampapi'
                },
                body: JSON.stringify({username, password, token: '', rememberMe: false})
            });
            const testData = await testRes.json();
            if (!testData.success) {
                return interaction.editReply(`❌ Login fehlgeschlagen: ${testData.resultReason}`);
            }
        } catch (err) {
            return interaction.editReply(`❌ AMP nicht erreichbar: ${err.message}\nURL prüfen: \`${baseUrl}\``);
        }

        const cfg = configManager.load();
        cfg.amp = {
            enabled: true,
            baseUrl,
            username,
            password,
            channelId: channel.id,
            instances: cfg.amp?.instances ?? [],
            messageIds: {}
        };
        configManager.save(cfg);

        await interaction.editReply([
            '✅ **AMP Setup gespeichert:**',
            `🌐 Basis-URL: \`${baseUrl}\``,
            `👤 User: \`${username}\``,
            `📢 Channel: <#${channel.id}>`,
            '',
            `Füge jetzt Instanzen hinzu mit \`/amp instance-add\``
        ].join('\n'));
        return;
    }

    // ── /amp toggle ───────────────────────────────────────────────────────────
    if (sub === 'toggle') {
        const enable = interaction.options.getString('status') === 'enable';
        configManager.set('amp.enabled', enable);
        return interaction.reply({
            content: `🖥️ AMP Monitor: ${enable ? '✅ Aktiviert' : '❌ Deaktiviert'}`,
            ephemeral: true
        });
    }

    // ── /amp refresh ──────────────────────────────────────────────────────────
    if (sub === 'refresh') {
        await interaction.deferReply({ephemeral: true});
        await pollOnce(client);
        return interaction.editReply('🔄 Status wurde aktualisiert.');
    }

    // ── /amp show ─────────────────────────────────────────────────────────────
    if (sub === 'show') {
        const amp = configManager.get('amp');
        if (!amp?.baseUrl) {
            return interaction.reply({
                content: '⚠️ AMP ist noch nicht konfiguriert. Nutze `/amp setup`.',
                ephemeral: true
            });
        }

        const instances = amp.instances ?? [];
        const instanceList = instances.length
            ? instances.map(i => `\`${i.port}\` — **${i.name}** (${i.address})`).join('\n')
            : '*(keine Instanzen konfiguriert)*';

        const embed = new EmbedBuilder()
            .setTitle('🖥️ AMP Konfiguration')
            .setColor(0x5865F2)
            .addFields(
                {name: '🌐 Basis-URL', value: `\`${amp.baseUrl}\``, inline: true},
                {name: '👤 User', value: `\`${amp.username}\``, inline: true},
                {name: '📢 Channel', value: `<#${amp.channelId}>`, inline: true},
                {name: '🔄 Status', value: amp.enabled ? '✅ Aktiv' : '❌ Deaktiviert', inline: true},
                {name: '🖥️ Instanzen', value: instanceList}
            )
            .setTimestamp();

        return interaction.reply({embeds: [embed], ephemeral: true});
    }

    // ── /amp reset ────────────────────────────────────────────────────────────
    if (sub === 'reset') {
        configManager.set('amp.messageIds', {});
        return interaction.reply({
            content: '🗑️ Message-IDs zurückgesetzt — beim nächsten Update werden neue Nachrichten erstellt.',
            ephemeral: true
        });
    }

    // ── /amp instance-add ─────────────────────────────────────────────────────
    if (sub === 'instance-add') {
        const amp = configManager.get('amp');
        if (!amp?.baseUrl) {
            return interaction.reply({
                content: '⚠️ AMP ist noch nicht konfiguriert. Nutze zuerst `/amp setup`.',
                ephemeral: true
            });
        }

        const name = interaction.options.getString('name');
        const port = interaction.options.getInteger('port');
        const customAddress = interaction.options.getString('adresse');

        const cfg = configManager.load();
        const instances = cfg.amp.instances ?? [];

        // Doppelter Port?
        if (instances.find(i => i.port === port)) {
            return interaction.reply({
                content: `⚠️ Port \`${port}\` ist bereits konfiguriert.`,
                ephemeral: true
            });
        }

        // Standard-Adresse aus baseUrl ableiten (http(s)://host → host:port)
        const hostMatch = amp.baseUrl.match(/^https?:\/\/(.+)$/);
        const host = hostMatch ? hostMatch[1] : amp.baseUrl;
        const address = customAddress ?? `${host}:${port}`;

        instances.push({name, port, address});
        configManager.set('amp.instances', instances);

        return interaction.reply({
            content: `✅ Instanz hinzugefügt:\n**${name}** — Port \`${port}\` — Adresse \`${address}\``,
            ephemeral: true
        });
    }

    // ── /amp instance-remove ──────────────────────────────────────────────────
    if (sub === 'instance-remove') {
        const port = interaction.options.getInteger('port');
        const cfg = configManager.load();
        const instances = cfg.amp?.instances ?? [];

        const index = instances.findIndex(i => i.port === port);
        if (index === -1) {
            return interaction.reply({
                content: `⚠️ Keine Instanz mit Port \`${port}\` gefunden.`,
                ephemeral: true
            });
        }

        const removed = instances[index];
        instances.splice(index, 1);
        configManager.set('amp.instances', instances);

        // Message-ID für diese Instanz auch entfernen
        const messageIds = cfg.amp?.messageIds ?? {};
        if (messageIds[String(port)]) {
            delete messageIds[String(port)];
            configManager.set('amp.messageIds', messageIds);
        }

        return interaction.reply({
            content: `🗑️ Instanz **${removed.name}** (Port \`${port}\`) entfernt.`,
            ephemeral: true
        });
    }

    // ── /amp instance-list ────────────────────────────────────────────────────
    if (sub === 'instance-list') {
        const instances = configManager.get('amp.instances') ?? [];

        if (!instances.length) {
            return interaction.reply({
                content: '*(Keine Instanzen konfiguriert — nutze `/amp instance-add`)*',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🖥️ AMP Instanzen')
            .setColor(0x5865F2)
            .setDescription(instances.map(i =>
                `**${i.name}**\nPort: \`${i.port}\` — Adresse: \`${i.address}\``
            ).join('\n\n'))
            .setTimestamp();

        return interaction.reply({embeds: [embed], ephemeral: true});
    }
}

module.exports = {data, handle};