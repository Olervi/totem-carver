const {EmbedBuilder} = require('discord.js');
const configManager = require('./configManager');

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 Minuten
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Aktive Streams die schon announced wurden: twitchUsername → streamId
const announcedStreams = new Map();

let accessToken = null;
let tokenExpiry = 0;

// ─── Twitch OAuth Token ───────────────────────────────────────────────────────

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    const res = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
        {method: 'POST'}
    );

    if (!res.ok) throw new Error(`Twitch Token Fehler: ${res.status}`);

    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 1 Min Puffer
    return accessToken;
}

// ─── Twitch API Calls ─────────────────────────────────────────────────────────

async function fetchStreamData(twitchUsernames) {
    if (!twitchUsernames.length) return [];

    const token = await getAccessToken();
    const query = twitchUsernames.map(u => `user_login=${encodeURIComponent(u)}`).join('&');

    const res = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
        headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        }
    });

    if (!res.ok) throw new Error(`Twitch Streams API Fehler: ${res.status}`);
    const data = await res.json();
    return data.data ?? [];
}

async function fetchUserData(twitchUsernames) {
    if (!twitchUsernames.length) return [];

    const token = await getAccessToken();
    const query = twitchUsernames.map(u => `login=${encodeURIComponent(u)}`).join('&');

    const res = await fetch(`https://api.twitch.tv/helix/users?${query}`, {
        headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        }
    });

    if (!res.ok) throw new Error(`Twitch Users API Fehler: ${res.status}`);
    const data = await res.json();
    return data.data ?? [];
}

// ─── Embed bauen ─────────────────────────────────────────────────────────────

function buildAnnouncementEmbed(stream, userData, customText) {
    const thumbnailUrl = stream.thumbnail_url
        .replace('{width}', '1280')
        .replace('{height}', '720') + `?t=${Date.now()}`; // Cache-Busting

    const twitchUrl = `https://twitch.tv/${stream.user_login}`;
    const profileImage = userData?.profile_image_url ?? null;

    const embed = new EmbedBuilder()
        .setColor(0x9146FF) // Twitch-Lila
        .setAuthor({
            name: `${stream.user_name} ist jetzt live!`,
            iconURL: profileImage ?? undefined,
            url: twitchUrl
        })
        .setTitle(stream.title || 'Kein Titel')
        .setURL(twitchUrl)
        .addFields(
            {name: '🎮 Spiel', value: stream.game_name || 'Unbekannt', inline: true},
            {name: '👥 Zuschauer', value: String(stream.viewer_count ?? 0), inline: true}
        )
        .setImage(thumbnailUrl)
        .setFooter({text: 'Twitch', iconURL: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c1a5e4.png'})
        .setTimestamp();

    if (customText) {
        embed.setDescription(customText);
    }

    return embed;
}

// ─── Polling Loop ─────────────────────────────────────────────────────────────

async function poll(client) {
    try {
        const cfg = configManager.load();
        const twitch = cfg.twitch;

        if (!twitch?.enabled) return;
        if (!twitch.announcementChannelId) return;

        const guild = client.guilds.cache.first();
        if (!guild) return;

        const channel = guild.channels.cache.get(twitch.announcementChannelId);
        if (!channel) return;

        // Alle registrierten User aus Config
        const users = Object.entries(twitch.users ?? {});
        if (!users.length) return;

        const twitchUsernames = users.map(([, u]) => u.twitchUsername).filter(Boolean);
        if (!twitchUsernames.length) return;

        // Aktive Streams holen
        const [streams, userData] = await Promise.all([
            fetchStreamData(twitchUsernames),
            fetchUserData(twitchUsernames)
        ]);

        const userDataMap = Object.fromEntries(userData.map(u => [u.login.toLowerCase(), u]));

        // Streams die nicht mehr live sind aus announcedStreams entfernen
        const liveLogins = new Set(streams.map(s => s.user_login.toLowerCase()));
        for (const [login] of announcedStreams) {
            if (!liveLogins.has(login)) {
                announcedStreams.delete(login);
                console.log(`[Twitch] ${login} ist offline, bereit für nächsten Stream`);
            }
        }

        // Neue Streams announcen
        for (const stream of streams) {
            const login = stream.user_login.toLowerCase();

            // Schon announced für diesen Stream?
            if (announcedStreams.get(login) === stream.id) continue;

            // Custom Text aus Config holen
            const userEntry = users.find(([, u]) => u.twitchUsername?.toLowerCase() === login);
            const customText = userEntry?.[1]?.customText ?? null;

            const embed = buildAnnouncementEmbed(stream, userDataMap[login], customText);

            // Rolle pingen falls konfiguriert
            const pingContent = twitch.pingRoleId ? `<@&${twitch.pingRoleId}>` : null;

            await channel.send({
                content: pingContent,
                embeds: [embed]
            });

            announcedStreams.set(login, stream.id);
            console.log(`[Twitch] Announced: ${stream.user_name} (${stream.id})`);
        }

    } catch (err) {
        console.error('[Twitch] Polling Fehler:', err.message);
    }
}

function startPoller(client) {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        console.warn('[Twitch] TWITCH_CLIENT_ID oder TWITCH_CLIENT_SECRET fehlt — Poller deaktiviert');
        return;
    }

    console.log(`[Twitch] Poller gestartet (Interval: ${POLL_INTERVAL_MS / 1000}s)`);
    poll(client); // Sofort einmal laufen
    setInterval(() => poll(client), POLL_INTERVAL_MS);
}

module.exports = {startPoller};