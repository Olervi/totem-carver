const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");

const configManager = require('./configManager')

const data =
    new SlashCommandBuilder()
        .setName('config')
        .setDescription('Bot-Konfiguration verwalten')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('show')
            .setDescription('Aktuelle Konfiguration verwalten'))
        .addSubcommand(sub => sub
            .setName('voice-manager')
            .setDescription('Voice Channel Manager aktivieren/deaktivieren')
            .addStringOption(opt => opt
                .setName('status')
                .setDescription('An oder Aus')
                .setRequired(true)
                .addChoices({name: 'Aktivieren', value: 'enable'}, {name: 'Deaktivieren', value: 'disable'})))
        .addSubcommand(sub => sub
            .setName('game-detection')
            .setDescription('Game Detection aktivieren/deaktivieren')
            .addStringOption(opt => opt
                .setName('status')
                .setDescription('An oder Aus')
                .setRequired(true)
                .addChoices({name: 'Aktivieren', value: 'enable'}, {name: 'Deaktivieren', value: 'disable'})))
        .addSubcommand(sub => sub
            .setName('timeout')
            .setDescription('Auto-Delete Timeout in Minuten festlegen')
            .addIntegerOption(opt => opt
                .setName('minuten')
                .setDescription('0 = kein Auto-Delete')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(60)))
        .addSubcommand(sub => sub
            .setName('tracked-channels')
            .setDescription('Überwachte Voice-Channels verwalten')
            .addStringOption(opt => opt
                .setName('aktion')
                .setDescription('Hinzufügen oder entfernen')
                .setRequired(true)
                .addChoices({name: 'Hinzufügen', value: 'add'}, {name: 'Entfernen', value: 'remove'}))
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('Voice-Channel')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('standardname')
                .setDescription('Name bei leerem Channel (nur bei Hinzufügen)')
                .setRequired(false)));

async function handle(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'config') return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
        const cfg = configManager.load();
        const vm = cfg.voiceManager;
        const channels = Object.entries(vm.trackedChannels ?? {})
            .map(([id, name]) => `<#${id}> -> \`${name}\``)
            .join('\n') || '*(keine*)';

        const embed = new EmbedBuilder()
            .setTitle(' Bot-Konfiguration')
            .setColor(0x5865F2)
            .addFields(
                {name: 'Voice Manager', value: vm.enabled ? 'Aktiv' : 'Deaktiviert', inline: true},
                {name: 'Game Detection', value: vm.gameDetection ? 'Aktiv' : 'Deaktiviert', inline: true},
                {
                    name: 'Timeout',
                    value: vm.timeoutMinutes > 0 ? `${vm.timeoutMinutes} Min.` : 'Deaktiviert',
                    inline: true
                },
                {name: 'Überwachte Channels', value: channels}
            )
            .setTimestamp();

        return interaction.reply({embeds: [embed], ephemeral: true});
    }
    if (sub === 'voice-manager') {
        const enable = interaction.options.getString('status') === 'enable';
        configManager.set('voiceManager.enabled', enable);
        return interaction.reply({content: `Voice Manager: ${enable ? 'Aktiviert' : 'Deaktiviert'}`, ephemeral: true});
    }

    if (sub === 'game-detection') {
        const enable = interaction.options.getString('status') === 'enable';
        configManager.set('voiceManager.gameDetection', enable);
        return interaction.reply({content: `Game Detection: ${enable ? 'Aktiviert' : 'Deaktiviert'}`, ephemeral: true});
    }

    if (sub === 'timeout') {
        const minutes = interaction.options.getInteger('minuten');
        configManager.set('voiceManager.timeoutMinutes', minutes);
        return interaction.reply({
            content: `Timeout gesetzt auf: ${minutes > 0 ? `${minutes} Minuten` : '*(deaktiviert)*'}`,
            ephemeral: true
        });
    }

    if (sub === 'tracked-channels') {
        const aktion = interaction.options.getString('aktion');
        const channel = interaction.options.getChannel('channel');
        const config = configManager.load();
        const tracked = config.voiceManager.trackedChannels ?? {};

        if (aktion === 'add') {
            const standardname = interaction.options.getString('standardname') ?? channel.name;
            tracked[channel.id] = standardname;
            configManager.set('voiceManager.trackedChannels', tracked);
            return interaction.reply({
                content: `<#${channel.id}> hinzugefügt (Standardname: \`${standardname}\`)`,
                ephemeral: true
            });
        }

        if (aktion === 'remove') {
            if (!tracked[channel.id]) {
                return interaction.reply({content: `<#${channel.id}> ist nicht in der Liste.`, ephemeral: true});
            }
            delete tracked[channel.id];
            configManager.set('voiceManager.trackedChannels', tracked);
            return interaction.reply({content: `<#${channel.id}> entfernt.`, ephemeral: true});
        }
    }

}

module.exports = {data, handle};