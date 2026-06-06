const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULTS = {
    voiceManager: {
        enabled: true,
        gameDetection: true,
        timeoutMinutes: 5,
        trackedChannels: {}
    }
};

function load() {
    if (!fs.existsSync(CONFIG_PATH)) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2));
        return DEFAULTS;
    }
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
        console.error('Could not read config.json. Falling back to Defaults.')
        return DEFAULTS;
    }
}

function save(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function get(keyPath) {
    const config = load();
    return keyPath.split('.').reduce((obj, k) => obj?.[k], config);
}

function set(keyPath, value) {
    const config = load();
    const keys = keyPath.split('.');
    let obj = config;
    for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]] ??= {};
    }
    obj[keys.at(-1)] = value;
    save(config);
}

module.exports = {load, save, get, set}