/**
 * @file Button Interaction Handler
 * @author Naman Vrati
 * @since 3.0.0
 */

module.exports = {
	name: "interactionCreate",

	/**
	 * @description Executes when an interaction is created and handle it.
	 * @author Naman Vrati
	 * @param {Object} interaction The interaction which was created
	 */

	async execute(interaction) {
		// Deconstructed client from interaction object.
		const { client } = interaction;

		// Checks if the interaction is a button interaction (to prevent weird bugs)

		if (!interaction.isButton()) return;
		/**
		 * @description The Interaction command object
		 * @type {Object}
		 */

		const command = client.buttonCommands.get(interaction.customId);

		// If the interaction is not a command in cache, return error message.
		// You can modify the error message at ./messages/defaultButtonError.js file!

		if (!command) {
			await require("../messages/defaultButtonError").execute(interaction);
			return;
		}

		// A try to execute the interaction.

		try {
			await command.execute(interaction);

		} catch (err) {
			console.error(err);
			await interaction.reply({
				content: "There was an issue while executing that button!",
				ephemeral: true,
			});

		}
	},
};
