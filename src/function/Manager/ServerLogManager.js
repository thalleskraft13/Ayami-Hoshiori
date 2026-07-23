'use strict';

const LogChannelManager = require('./LogChannelManager.js');
const { GuildDb }        = require('../../Mongodb/guild.js');
const GuildEventLog       = require('../../Mongodb/guildEventLog.js');

const LOG_CHANNEL_ID = '1522177373792112860';
const COLOR_JOIN  = 0x57F287;
const COLOR_LEAVE = 0xED4245;

class ServerLogManager {

    async handleGuildCreate(data) {
        try {
            await GuildDb.findOneAndUpdate(
                { guildId: data.id },
                { $setOnInsert: { guildId: data.id } },
                { upsert: true }
            );

            const info = {
                guildId:     data.id,
                guildName:   data.name,
                ownerId:     data.owner_id,
                memberCount: data.member_count ?? 0,
            };

            await GuildEventLog.create({ ...info, event: 'join' });

            LogChannelManager.send(LOG_CHANNEL_ID, {
                embeds: [{
                    title: '📥 Entrei em um novo servidor',
                    color: COLOR_JOIN,
                    fields: [
                        { name: 'Nome',     value: info.guildName ?? 'Desconhecido', inline: true },
                        { name: 'ID',       value: `\`${info.guildId}\``, inline: true },
                        { name: 'Dono',     value: info.ownerId ? `<@${info.ownerId}>` : 'Desconhecido', inline: true },
                        { name: 'Membros',  value: `${info.memberCount}`, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                }],
            });
        } catch (err) {
            console.error('[ServerLog] Falha ao processar GUILD_CREATE:', err);
        }
    }

    async handleGuildDelete(data) {
        try {
            await GuildEventLog.create({
                guildId:     data.id,
                guildName:   data.name ?? null,
                ownerId:     data.owner_id ?? null,
                memberCount: data.member_count ?? 0,
                event:       'leave',
            });

            LogChannelManager.send(LOG_CHANNEL_ID, {
                embeds: [{
                    title: '📤 Saí de um servidor',
                    color: COLOR_LEAVE,
                    fields: [
                        { name: 'ID', value: `\`${data.id}\``, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                }],
            });
        } catch (err) {
            console.error('[ServerLog] Falha ao processar GUILD_DELETE:', err);
        }
    }
}

module.exports = new ServerLogManager();
