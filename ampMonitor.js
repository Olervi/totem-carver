const {EmbedBuilder} = require('discord.js');
const configManager = require('./configManager');

const POLL_INTERVAL_MS = 60 * 1000;

// Token-Cache pro Port: port → { token, expiry }
const tokenCache = new Map();

// ─── AMP API ──────────────────────────────────────────────────────────────────

async function ampRequest(baseUrl, endpoint, data = {}, token = null) {
    const url = `${baseUrl}/API/${endpoint}`;
    const body = {SESSIONDATA: token, ...data};

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.cubecoders-ampapi'
        },
        body: JSON.stringify(body)
    });

    const raw = await res.text();

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.error(`[AMP] JSON Parse Fehler bei ${endpoint}:`, raw.slice(0, 200));
        throw new Error(`AMP JSON Parse Fehler: ${endpoint}`);
    }

    // AMP gibt Unauthorized als 200 mit Title zurück
    if (parsed?.Title === 'Unauthorized Access') {
        throw new Error(`AMP Unauthorized: ${endpoint}`);
    }

    return parsed;
}

// ─── Auth — pro Instanz (Port) eigener Token-Cache ────────────────────────────

async function getToken(baseUrl, port, username, password) {
    const cached = tokenCache.get(port);
    if (cached && Date.now() < cached.expiry) return cached.token;

    const res = await ampRequest(baseUrl, 'Core/Login', {
        username,
        password,
        token: '',
        rememberMe: false
    });

    if (!res.success) throw new Error(`AMP Login fehlgeschlagen (Port ${port}): ${res.resultReason}`);

    tokenCache.set(port, {
        token: res.sessionID,
        expiry: Date.now() + 20 * 60 * 1000
    });

    console.log(`[AMP] Login OK für Port ${port}`);
    return res.sessionID;
}

function invalidateToken(port) {
    tokenCache.delete(port);
}

// ─── Instanz-Status abrufen ───────────────────────────────────────────────────

async function fetchInstanceStatus(baseUrl, port, username, password) {
    const token = await getToken(baseUrl, port, username, password);
    const res = await ampRequest(baseUrl, 'Core/GetStatus', {}, token);
    return res;
}

// ─── Embed bauen ──────────────────────────────────────────────────────────────

function buildEmbed(instance, status) {
    // instance = Config-Objekt: { name, port, address }
    // status   = AMP Core/GetStatus Response oder null (wenn offline/fehler)

    const isRunning = !!status && !status?.Title; // kein Error-Objekt
    const state = status?.State ?? null;
    // AMP State: 0=Stopped, 10=PreStart, 20=Starting, 30=Running, 40=Restarting, 50=Stopping, 60=Failed
    const actuallyRunning = state === 30 || state === 20;

    const playerCurrent = status?.Metrics?.['Active Users']?.RawValue ?? 0;
    const playerMax = status?.Metrics?.['Active Users']?.MaxValue ?? 0;

    let color;
    if (!isRunning || !actuallyRunning) color = 0x747F8D; // Grau = offline
    else if (playerCurrent > 0) color = 0x57F287;         // Grün = Spieler online
    else color = 0xFEE75C;                                  // Gelb = leer

    const statusText = !isRunning || !actuallyRunning ? '🔴 Offline' : '🟢 Online';

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(instance.name)
        .addFields(
            {name: 'Status', value: statusText, inline: true},
            {name: '🌐 Adresse', value: `\`${instance.address}\``, inline: true},
        )
        .setFooter({text: 'Zuletzt aktualisiert'})
        .setTimestamp();

    if (isRunning && actuallyRunning) {
        embed.addFields({
            name: '👥 Spieler',
            value: playerMax > 0 ? `${playerCurrent} / ${playerMax}` : `${playerCurrent}`,
            inline: true
        });
    }

    return embed;
}

// ─── Polling ──────────────────────────────────────────────────────────────────

async function poll(client) {
    const cfg = configManager.load();
    const amp = cfg.amp;

    if (!amp?.enabled) return;
    if (!amp.channelId || !amp.baseUrl || !amp.username || !amp.password) return;

    const instances = amp.instances ?? [];
    if (!instances.length) {
        console.log('[AMP] Keine Instanzen konfiguriert');
        return;
    }

    let channel;
    try {
        channel = await client.channels.fetch(amp.channelId);
    } catch (err) {
        console.warn(`[AMP] Channel nicht abrufbar:`, err.message);
        return;
    }
    if (!channel) return;

    const messageIds = amp.messageIds ?? {};
    let changed = false;

    for (const instance of instances) {
        const instanceUrl = `${amp.baseUrl}:${instance.port}`;

        let status = null;
        try {
            status = await fetchInstanceStatus(instanceUrl, instance.port, amp.username, amp.password);
        } catch (err) {
            console.warn(`[AMP] Status für ${instance.name} (Port ${instance.port}) nicht abrufbar:`, err.message);
            if (err.message.includes('Unauthorized')) invalidateToken(instance.port);
        }

        const embed = buildEmbed(instance, status);
        const key = String(instance.port);

        if (messageIds[key]) {
            try {
                const msg = await channel.messages.fetch(messageIds[key]);
                await msg.edit({embeds: [embed]});
            } catch {
                // Nachricht nicht mehr vorhanden — neu erstellen
                const sent = await channel.send({embeds: [embed]});
                messageIds[key] = sent.id;
                changed = true;
            }
        } else {
            const sent = await channel.send({embeds: [embed]});
            messageIds[key] = sent.id;
            changed = true;
        }

        console.log(`[AMP] ${instance.name} (${instance.port}) aktualisiert`);
    }

    if (changed) {
        configManager.set('amp.messageIds', messageIds);
    }
}

function startPoller(client) {
    const cfg = configManager.load();
    if (!cfg.amp?.baseUrl) {
        console.log('[AMP] Nicht konfiguriert — warte auf /amp setup');
        return;
    }
    console.log(`[AMP] Poller gestartet`);
    poll(client);
    setInterval(() => poll(client), POLL_INTERVAL_MS);
}

async function pollOnce(client) {
    await poll(client);
}

module.exports = {startPoller, pollOnce};