/**
 * @file Discord RP Event File
 */

module.exports = {
    name: "rPresence",
    once: true,
    /**
     * @description Executes when bot is ready
      * @param {Object} client Main Application Client
     */
execute(client) {
    const activity = [`$help | `];
    let activities = activity[Math.floor(Math.random() * activity.length)];
    client.user.setPresence({
        activities: [{name: activities}],
        status: 'online',
    });
    console.log('Rich Presence started');
},};