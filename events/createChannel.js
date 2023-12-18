const {SlashCommandBuilder, PermissionFlagsBits, ChannelType}
= require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("createchannel")
        .setDefaultPermission(true),
    async execute(interaction){
        await interaction.reply({
            content: "Fetched all input and working on request!",
        });
        try {
            await interaction.guild.channels.create({
                name: "new",
                type: ChannelType.GuildVoice,
            });
            await interaction.editReply({
                content: "Your channel was created!",
            });

        } catch (error){
            console.log(error);
            await interaction.editReply({
                content: "Your channel could not be created",
            });
        }
    }
}