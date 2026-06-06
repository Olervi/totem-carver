const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const configManager = require('./configManager');

const data = new SlashCommandBuilder()
    .setName('twitch')
    .setDescription('Twitch Announcement System verwalten')

    // Admin-only Subcommands
    .addSubcommandGroup(group => group
        .setName('admin')
        .setDescription('Admin-Einstellungen')
        .addSubcommand(sub => sub
            .setName('setup')
            .setDescription('Announcement-Channel und Ankündigungs-Rolle festlegen')
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('Channel für Announcements')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
            .addRoleOption(opt => opt
                .setName('streamer-rolle')
                .setDescription('Nur User mit dieser Rolle können sich registrieren')
                .setRequired(true))
            .addRoleOption(opt => opt
                .setName('ping-rolle')
                .setDescription('Diese Rolle wird beim Announcement gepingt (optional)')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('toggle')
            .setDescription('Twitch Announcements aktivieren/deaktivieren')
            .addStringOption(opt => opt
                .setName('status')
                .setDescription('An oder Aus')
                .setRequired(true)
                .addChoices(
                    {name: 'Aktivieren', value: 'enable'},
                    {name: 'Deaktivieren', value: 'disable'}
                )))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Alle registrierten Streamer anzeigen'))
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Streamer aus dem System entfernen')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('Discord User')
                .setRequired(true))))

    // User Subcommands (mit Streamer-Rolle nutzbar)
    .addSubcommand(sub => sub
        .setName('register')
        .setDescription('Deinen Twitch-Account registrieren')
        .addStringOption(opt => opt
            .setName('twitch-name')
            .setDescription('Dein Twitch-Benutzername')
            .setRequired(true)))
    .addSubcommand(sub => sub
        .setName('unregister')
        .setDescription('Deine Registrierung entfernen'))
    .addSubcommand(sub => sub
        .setName('customtext')
        .setDescription('Eigenen Text für dein Announcement setzen')
        .addStringOption(opt => opt
            .setName('text')
            .setDescription('Dein persönlicher Announcement-Text (leer lassen zum Zurücksetzen)')
            .setRequired(false)))
    .addSubcommand(sub => sub
        .setName('status')
        .setDescription('Deine Registrierung anzeigen'));

// ─── Hilfsfunktion: Hat User die Streamer-Rolle? ──────────────────────────────

function hasStreamerRole(member, roleId) {
    if (!roleId) return false;
    return member.roles.cache.has(roleId);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handle(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'twitch') return;

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    // ── Admin Commands ────────────────────────────────────────────────────────
    if (group === 'admin') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({content: '❌ Nur Admins können das.', ephemeral: true});
        }

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const streamerRole = interaction.options.getRole('streamer-rolle');
            const pingRole = interaction.options.getRole('ping-rolle');

            const cfg = configManager.load();
            cfg.twitch = {
                ...cfg.twitch,
                enabled: cfg.twitch?.enabled ?? true,
                announcementChannelId: channel.id,
                streamerRoleId: streamerRole.id,
                pingRoleId: pingRole?.id ?? null,
                users: cfg.twitch?.users ?? {}
            };
            configManager.save(cfg);

            return interaction.reply({
                content: [
                    '✅ **Twitch Setup gespeichert:**',
                    `📢 Announcement-Channel: <#${channel.id}>`,
                    `🎭 Streamer-Rolle: <@&${streamerRole.id}>`,
                    pingRole ? `🔔 Ping-Rolle: <@&${pingRole.id}>` : '🔕 Keine Ping-Rolle'
                ].join('\n'),
                ephemeral: true
            });
        }

        if (sub === 'toggle') {
            const enable = interaction.options.getString('status') === 'enable';
            configManager.set('twitch.enabled', enable);
            return interaction.reply({
                content: `📡 Twitch Announcements: ${enable ? '✅ Aktiviert' : '❌ Deaktiviert'}`,
                ephemeral: true
            });
        }

        if (sub === 'list') {
            const users = configManager.get('twitch.users') ?? {};
            const entries = Object.entries(users);

            if (!entries.length) {
                return interaction.reply({content: '*(Keine Streamer registriert)*', ephemeral: true});
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Registrierte Streamer')
                .setColor(0x9146FF)
                .setDescription(entries.map(([discordId, u]) =>
                    `<@${discordId}> → [${u.twitchUsername}](https://twitch.tv/${u.twitchUsername})${u.customText ? ' ✏️' : ''}`
                ).join('\n'))
                .setTimestamp();

            return interaction.reply({embeds: [embed], ephemeral: true});
        }

        if (sub === 'remove') {
            const user = interaction.options.getUser('user');
            const cfg = configManager.load();

            if (!cfg.twitch?.users?.[user.id]) {
                return interaction.reply({content: `⚠️ <@${user.id}> ist nicht registriert.`, ephemeral: true});
            }

            delete cfg.twitch.users[user.id];
            configManager.save(cfg);
            return interaction.reply({content: `🗑️ <@${user.id}> wurde entfernt.`, ephemeral: true});
        }
    }

    // ── User Commands ─────────────────────────────────────────────────────────
    const streamerRoleId = configManager.get('twitch.streamerRoleId');

    if (sub === 'register') {
        if (!hasStreamerRole(interaction.member, streamerRoleId)) {
            return interaction.reply({
                content: `❌ Du brauchst die <@&${streamerRoleId}> Rolle um dich zu registrieren.`,
                ephemeral: true
            });
        }

        const twitchName = interaction.options.getString('twitch-name').toLowerCase().trim();
        const cfg = configManager.load();
        if (!cfg.twitch) cfg.twitch = {users: {}};
        if (!cfg.twitch.users) cfg.twitch.users = {};

        cfg.twitch.users[interaction.user.id] = {
            twitchUsername: twitchName,
            customText: cfg.twitch.users[interaction.user.id]?.customText ?? null
        };
        configManager.save(cfg);

        return interaction.reply({
            content: `✅ Registriert! Dein Twitch-Account: [${twitchName}](https://twitch.tv/${twitchName})\nWenn du live gehst, wird es in <#${cfg.twitch.announcementChannelId ?? '?'}> announced.`,
            ephemeral: true
        });
    }

    if (sub === 'unregister') {
        const cfg = configManager.load();
        if (!cfg.twitch?.users?.[interaction.user.id]) {
            return interaction.reply({content: '⚠️ Du bist nicht registriert.', ephemeral: true});
        }
        delete cfg.twitch.users[interaction.user.id];
        configManager.save(cfg);
        return interaction.reply({content: '🗑️ Deine Registrierung wurde entfernt.', ephemeral: true});
    }

    if (sub === 'customtext') {
        if (!hasStreamerRole(interaction.member, streamerRoleId)) {
            return interaction.reply({
                content: `❌ Du brauchst die <@&${streamerRoleId}> Rolle.`,
                ephemeral: true
            });
        }

        const cfg = configManager.load();
        if (!cfg.twitch?.users?.[interaction.user.id]) {
            return interaction.reply({
                content: '⚠️ Du bist nicht registriert. Nutze zuerst `/twitch register`.',
                ephemeral: true
            });
        }

        const text = interaction.options.getString('text') ?? null;
        cfg.twitch.users[interaction.user.id].customText = text || null;
        configManager.save(cfg);

        return interaction.reply({
            content: text
                ? `✏️ Dein Announcement-Text wurde gesetzt:\n> ${text}`
                : '✏️ Dein custom Text wurde entfernt — es wird der Standard-Embed verwendet.',
            ephemeral: true
        });
    }

    if (sub === 'status') {
        const userData = configManager.get(`twitch.users.${interaction.user.id}`);
        if (!userData) {
            return interaction.reply({
                content: '❌ Du bist nicht registriert. Nutze `/twitch register`.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📡 Deine Twitch-Registrierung')
            .setColor(0x9146FF)
            .addFields(
                {
                    name: 'Twitch',
                    value: `[${userData.twitchUsername}](https://twitch.tv/${userData.twitchUsername})`,
                    inline: true
                },
                {name: 'Custom Text', value: userData.customText ?? '*(Standard)*', inline: true}
            );

        return interaction.reply({embeds: [embed], ephemeral: true});
    }
}

module.exports = {data, handle};