const {EmbedBuilder} = require('discord.js');
const configManager = require('./configManager');

const POLL_INTERVAL_MS = 60 * 1000; // 1 Minute

// messageId pro Instanz-ID speichern: instanceId → messageId
// wird in config.json persistiert damit Bot-Restarts safe sind

let sessionToken = null;
let tokenExpiry = 0;

// ─── AMP API ──────────────────────────────────────────────────────────────────

async function ampRequest(baseUrl, endpoint, data = {}, token = null) {
    const url = `${baseUrl}/API/${endpoint}`;
    const body = {SESSIONDATA: token, ...data};

    const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Accept': 'application/vnd.cubecoders-ampapi'},
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`AMP API Fehler ${res.status}: ${endpoint}`);
    return res.json();
}

async function getSessionToken(baseUrl, username, password) {
    if (sessionToken && Date.now() < tokenExpiry) return sessionToken;

    const res = await ampRequest(baseUrl, 'Core/Login', {
        username,
        password,
        token: '',
        rememberMe: false
    });

    console.log('[AMP Debug] Login Response:', JSON.stringify(res, null, 2));

    if (!res.success) throw new Error(`AMP Login fehlgeschlagen: ${res.resultReason}`);

    sessionToken = res.sessionID;
    tokenExpiry = Date.now() + 20 * 60 * 1000; // 20 Min, dann neu einloggen
    return sessionToken;
}

async function getInstances(baseUrl, username, password) {
    const token = await getSessionToken(baseUrl, username, password);
    const res = await ampRequest(baseUrl, 'ADSModule/GetInstances', {}, token);

    console.log('[AMP Debug] GetInstances Response:', JSON.stringify(res, null, 2));

    // AMP gibt verschachtelte Struktur zurück
    const instances = [];
    for (const target of res) {
        for (const inst of (target.AvailableInstances ?? [])) {
            instances.push(inst);
        }
    }
    return instances;
}

async function getInstanceStatus(baseUrl, username, password, instanceId) {
    const token = await getSessionToken(baseUrl, username, password);
    return ampRequest(baseUrl, 'ADSModule/GetInstanceStatus', {InstanceId: instanceId}, token);
}

// ─── Embed bauen ──────────────────────────────────────────────────────────────

function statusColor(running, hasPlayers) {
    if (!running) return 0x747F8D; // Grau = offline
    if (hasPlayers) return 0x57F287; // Grün = online mit Spielern
    return 0xFEE75C; // Gelb = online aber leer
}

function statusEmoji(running) {
    return running ? '🟢' : '🔴';
}

function buildInstanceEmbed(inst, status) {
    const running = inst.Running ?? false;
    const appState = inst.AppState ?? 0; // 20 = Running
    const isRunning = running || appState === 20;

    const playerCurrent = status?.Metrics?.['Active Users']?.RawValue ?? 0;
    const playerMax = status?.Metrics?.['Active Users']?.MaxValue ?? 0;
    const cpuUsage = status?.Metrics?.['CPU Usage']?.Percent ?? null;
    const memUsage = status?.Metrics?.['Memory Usage']?.RawValue ?? null;
    const memMax = status?.Metrics?.['Memory Usage']?.MaxValue ?? null;
    const uptime = status?.Metrics?.['Uptime']?.RawValue ?? null;

    const embed = new EmbedBuilder()
        .setColor(statusColor(isRunning, playerCurrent > 0))
        .setTitle(`${statusEmoji(isRunning)} ${inst.FriendlyName ?? inst.InstanceName}`)
        .setTimestamp();

    if (!isRunning) {
        embed.setDescription('**Offline**');
        return embed;
    }

    const fields = [
        {
            name: '👥 Spieler',
            value: playerMax > 0 ? `${playerCurrent} / ${playerMax}` : `${playerCurrent}`,
            inline: true
        },
    ];

    if (cpuUsage !== null) {
        fields.push({name: '💻 CPU', value: `${cpuUsage.toFixed(1)}%`, inline: true});
    }

    if (memUsage !== null && memMax !== null) {
        const memMB = Math.round(memUsage / 1024 / 1024);
        const memMaxMB = Math.round(memMax / 1024 / 1024);
        fields.push({name: '🧠 RAM', value: `${memMB} / ${memMaxMB} MB`, inline: true});
    }

    if (uptime) {
        fields.push({name: '⏱️ Uptime', value: String(uptime), inline: true});
    }

    if (inst.IP && inst.Port) {
        fields.push({name: '🌐 Adresse', value: `\`${inst.IP}:${inst.Port}\``, inline: true});
    }

    embed.addFields(fields);
    embed.setFooter({text: `Zuletzt aktualisiert`});

    return embed;
}

// ─── Polling & Message Management ────────────────────────────────────────────

async function poll(client) {
    try {
        const cfg = configManager.load();
        const amp = cfg.amp;

        console.log('[AMP Debug] Poll gestartet, enabled', amp?.enabled, 'url:', amp?.url);

        if (!amp?.enabled) return;
        if (!amp.channelId || !amp.url || !amp.username || !amp.password) {
            console.log('[AMP Debug] Config unvollständig');
            return;
        }

        const guild = client.guilds.cache.first();
        if (!guild) return;

        const channel = guild.channels.cache.get(amp.channelId);
        if (!channel) return;

        const instances = await getInstances(amp.url, amp.username, amp.password);
        console.log('[AMP Debug] Instanzen gefunden:', instances.length);
        if (!instances.length) return;

        const messageIds = cfg.amp.messageIds ?? {};
        let changed = false;

        for (const inst of instances) {
            const instId = inst.InstanceID;
            let status = null;

            try {
                status = await getInstanceStatus(amp.url, amp.username, amp.password, instId);
            } catch (_) {
                // Status nicht verfügbar → trotzdem Embed zeigen
            }

            const embed = buildInstanceEmbed(inst, status);

            // Existierende Nachricht editieren oder neue erstellen
            if (messageIds[instId]) {
                try {
                    const msg = await channel.messages.fetch(messageIds[instId]);
                    await msg.edit({embeds: [embed]});
                } catch (_) {
                    // Nachricht nicht mehr vorhanden → neu erstellen
                    const sent = await channel.send({embeds: [embed]});
                    messageIds[instId] = sent.id;
                    changed = true;
                }
            } else {
                const sent = await channel.send({embeds: [embed]});
                messageIds[instId] = sent.id;
                changed = true;
            }
        }

        if (changed) {
            configManager.set('amp.messageIds', messageIds);
        }

    } catch (err) {
        console.error('[AMP] Polling Fehler:', err.message, err.stack);
        // Token zurücksetzen falls Login-Problem
        if (err.message.includes('Login')) {
            sessionToken = null;
            tokenExpiry = 0;
        }
    }
}

function startPoller(client) {
    const cfg = configManager.load();
    if (!cfg.amp?.url) {
        console.log('[AMP] Nicht konfiguriert — Poller pausiert bis /amp setup ausgeführt wird');
        return;
    }

    console.log('[AMP] Poller gestartet');
    poll(client);
    setInterval(() => poll(client), POLL_INTERVAL_MS);
}

// Einmaliger Poll z.B. nach /amp setup
async function pollOnce(client) {
    await poll(client);
}

module.exports = {startPoller, pollOnce};