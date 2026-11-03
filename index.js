require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    Collection 
} = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] 
});

const ALLOWED_ROLES = ['Manager', 'Assistant Manager'];

const cooldowns = new Collection();
const COOLDOWN_TIME = 5 * 60 * 1000;

const commands = [
    new SlashCommandBuilder()
        .setName('freeagent')
        .setDescription('Post your free agent application to the designated channel.')
        .addStringOption(option =>
            option.setName('info')
                .setDescription('Details about your role, availability, experience, or positions')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('lf')
        .setDescription('Post a Looking For (LF) request to the designated channel.')
        .addStringOption(option =>
            option.setName('details')
                .setDescription('Details about your team or teams you are looking for')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('scout')
        .setDescription('Post a scouting announcement (Managers only).')
        .addStringOption(option =>
            option.setName('details')
                .setDescription('Details about the scouting session or requirements')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('contract')
        .setDescription('Offer a contract to a player (Managers only).')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('The player you want to offer a contract to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('team')
                .setDescription('The team offering the contract')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Role or position offered (e.g. Starter, Sub, Rotational, Assistant Manager)')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Successfully registered all commands with cooldowns!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const userId = interaction.user.id;
    const commandName = interaction.commandName;
    const cooldownKey = `${userId}-${commandName}`;

    if (!cooldowns.has(cooldownKey)) {
        cooldowns.set(cooldownKey, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(cooldownKey);
    const expirationTime = timestamps.get(userId) || 0;

    if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        const minutesLeft = Math.floor(timeLeft / 60);
        const secondsLeft = Math.floor(timeLeft % 60);
        
        return interaction.reply({
            content: `⏳ Please wait **${minutesLeft}m ${secondsLeft}s** before using the \`/${commandName}\` command again.`,
            ephemeral: true
        });
    }

    timestamps.set(userId, now + COOLDOWN_TIME);
    setTimeout(() => timestamps.delete(userId), COOLDOWN_TIME);

    if (commandName === 'freeagent') {
        const info = interaction.options.getString('info');
        const targetChannel = interaction.guild.channels.cache.get(process.env.CHANNEL_ID);

        if (!targetChannel) {
            return interaction.reply({ 
                content: 'Error: Target channel for Free Agent not found in configuration.', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00A0E9)
            .setAuthor({ 
                name: interaction.user.username, 
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(info)
            .setFooter({ text: `${interaction.guild.name}` })
            .setTimestamp();

        try {
            await targetChannel.send({ content: `${interaction.user}`, embeds: [embed] });
            await interaction.reply({ content: `Your Free Agent profile has been posted to ${targetChannel}.`, ephemeral: true });
        } catch (error) {
            console.error('Error sending message:', error);
            await interaction.reply({ content: 'An error occurred while attempting to post to the channel.', ephemeral: true });
        }
    }

    if (commandName === 'lf') {
        const details = interaction.options.getString('details');
        const targetChannel = interaction.guild.channels.cache.get(process.env.LF_CHANNEL_ID);

        if (!targetChannel) {
            return interaction.reply({ content: 'Error: Target channel for LF not found in configuration.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00A0E9)
            .setAuthor({ 
                name: interaction.user.username, 
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(details)
            .setFooter({ text: `${interaction.guild.name}` })
            .setTimestamp();

        try {
            await targetChannel.send({ content: `${interaction.user}`, embeds: [embed] });
            await interaction.reply({ content: `Your LF request has been posted to ${targetChannel}.`, ephemeral: true });
        } catch (error) {
            console.error('Error sending message:', error);
            await interaction.reply({ content: 'An error occurred while attempting to post to the channel.', ephemeral: true });
        }
    }

    if (commandName === 'scout') {
        const member = interaction.member;
        const hasPermission = member.roles.cache.some(role => ALLOWED_ROLES.includes(role.name));

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to use this command. Requires Manager or Assistant Manager role.',
                ephemeral: true
            });
        }

        const details = interaction.options.getString('details');
        const targetChannel = interaction.guild.channels.cache.get(process.env.SCOUT_CHANNEL_ID);

        if (!targetChannel) {
            return interaction.reply({ content: 'Error: Target channel for Scout not found in configuration.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00A0E9)
            .setAuthor({ 
                name: interaction.user.username, 
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(details)
            .setFooter({ text: `${interaction.guild.name}` })
            .setTimestamp();

        try {
            await targetChannel.send({ content: `${interaction.user}`, embeds: [embed] });
            await interaction.reply({ content: `Your Scout announcement has been posted to ${targetChannel}.`, ephemeral: true });
        } catch (error) {
            console.error('Error sending message:', error);
            await interaction.reply({ content: 'An error occurred while attempting to post to the channel.', ephemeral: true });
        }
    }

    if (commandName === 'contract') {
        const member = interaction.member;
        const hasPermission = member.roles.cache.some(role => ALLOWED_ROLES.includes(role.name));

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to use this command. Requires Manager or Assistant Manager role.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('player');
        const team = interaction.options.getString('team');
        const role = interaction.options.getString('role');
        const contractsChannel = interaction.guild.channels.cache.get(process.env.CONTRACTS_CHANNEL_ID);

        if (!contractsChannel) {
            return interaction.reply({ 
                content: 'Error: Contracts channel not found in configuration.', 
                ephemeral: true 
            });
        }

        if (targetUser.bot) {
            return interaction.reply({ content: 'You cannot offer a contract to a bot.', ephemeral: true });
        }

        const dmEmbed = new EmbedBuilder()
            .setColor(0x00A0E9)
            .setTitle('📄 Contract Offer Received!')
            .setDescription(`**${interaction.user.username}** has offered you a contract in **${interaction.guild.name}**.\n\n*Note: This offer expires in 3 minutes.*`)
            .addFields(
                { name: '⚽ Team', value: team, inline: true },
                { name: '📋 Role', value: role, inline: true },
                { name: '👤 Offered By', value: `${interaction.user}`, inline: true }
            )
            .setFooter({ text: `${interaction.guild.name}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('accept_contract')
                .setLabel('Accept Contract')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('decline_contract')
                .setLabel('Decline Contract')
                .setStyle(ButtonStyle.Danger)
        );

        try {
            const dmMessage = await targetUser.send({
                embeds: [dmEmbed],
                components: [row]
            });

            await interaction.reply({ 
                content: `Contract offer successfully sent to ${targetUser} via DM!`, 
                ephemeral: true 
            });

            const collector = dmMessage.createMessageComponentCollector({ time: 180000 });

            collector.on('collect', async buttonInteraction => {
                const isAccepted = buttonInteraction.customId === 'accept_contract';
                const statusText = isAccepted ? 'ACCEPTED' : 'REJECTED';
                const statusColor = isAccepted ? 0x2ECC71 : 0xE74C3C;

                const announcementEmbed = new EmbedBuilder()
                    .setColor(statusColor)
                    .setAuthor({ 
                        name: targetUser.username, 
                        iconURL: targetUser.displayAvatarURL({ dynamic: true }) 
                    })
                    .setTitle(`📄 Contract ${statusText}`)
                    .setDescription(
                        `Player ${targetUser} has **${statusText.toLowerCase()}** the contract offer!\n\n` +
                        `⚽ **Team:** ${team}\n` +
                        `📋 **Role:** ${role}\n` +
                        `👤 **Manager:** ${interaction.user}`
                    )
                    .setFooter({ text: `${interaction.guild.name}` })
                    .setTimestamp();

                await contractsChannel.send({
                    content: `${targetUser} ${interaction.user}`,
                    embeds: [announcementEmbed]
                });

                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('accept_contract')
                        .setLabel(isAccepted ? 'Accepted' : 'Accept Contract')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('decline_contract')
                        .setLabel(!isAccepted ? 'Declined' : 'Decline Contract')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );

                await buttonInteraction.update({
                    content: `You have **${statusText.toLowerCase()}** the contract offer from **${team}**.`,
                    components: [disabledRow]
                });

                collector.stop();
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    try {
                        const expiredRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('expired')
                                .setLabel('Expired')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );

                        await dmMessage.edit({
                            content: '⏰ This contract offer has expired (3 minutes passed without response).',
                            components: [expiredRow]
                        });
                    } catch (e) {
                        // ignore
                    }
                }
            });

        } catch (error) {
            console.error('Error sending DM:', error);
            await interaction.reply({ 
                content: `Could not send DM to ${targetUser}. They might have DMs disabled.`, 
                ephemeral: true 
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);