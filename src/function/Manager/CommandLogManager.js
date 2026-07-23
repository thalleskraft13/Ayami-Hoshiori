'use strict';

const LogChannelManager = require('./LogChannelManager.js');
const CommandLogModel   = require('../../Mongodb/commandLog.js');

const COLOR = 0x7C8FFF;

class CommandLogManager {

    log(client, { commandName, subcommandName, options, guildId, guildName, userId, username }) {
        const fullName = subcommandName ? `/${commandName} ${subcommandName}` : `/${commandName}`;
        const optionsText = Object.keys(options ?? {}).length
            ? Object.entries(options).map(([k, v]) => `\`${k}\`: ${v}`).join('\n').slice(0, 1000)
            : '—';

        LogChannelManager.send('1522177449440448613', {
            embeds: [{
                title: `📜 ${fullName}`,
                color: COLOR,
                fields: [
                    { name: 'Usuário',  value: `${username ?? 'Desconhecido'} (\`${userId}\`)`, inline: false },
                    { name: 'Servidor', value: guildId ? `${guildName ?? 'Desconhecido'} (\`${guildId}\`)` : 'DM', inline: false },
                    { name: 'Opções',   value: optionsText, inline: false },
                ],
                timestamp: new Date().toISOString(),
            }],
        });

        CommandLogModel.create({
            commandName,
            subcommandName,
            options,
            guildId,
            guildName,
            userId,
            username,
        }).catch(err => console.error('[CommandLog] Falha ao persistir log:', err?.message ?? err));
    }
}

module.exports = new CommandLogManager();
