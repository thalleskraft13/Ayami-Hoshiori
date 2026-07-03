'use strict';

const LogChannelManager = require('./LogChannelManager.js');
const { GuildDb }        = require('../../Mongodb/guild.js');
const GuildEventLog       = require('../../Mongodb/guildEventLog.js');

const LOG_CHANNEL_ID = '1522177373792112860';
const COLOR_JOIN  = 0x57F287;
const COLOR_LEAVE = 0xED4245;

/**
 * ServerLogManager
 *
 * Plugado no `GuildManager#handleDispatch` (que já trata GUILD_CREATE/
 * GUILD_DELETE). Quem decide se um GUILD_CREATE é entrada real ou
 * resync/reconexão é o próprio `GuildManager` (comparando com a lista de
 * guilds recebida no READY da sessão atual — ver `markSessionGuilds`);
 * aqui só chega quando já é certeza de entrada nova de verdade.
 */
class ServerLogManager {

    /** Chamado pelo GuildManager quando confirma que é um GUILD_CREATE de entrada nova. */
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

    /** Chamado pelo GuildManager em GUILD_DELETE (só quando NÃO é `unavailable`, ou seja, saída real). */
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
