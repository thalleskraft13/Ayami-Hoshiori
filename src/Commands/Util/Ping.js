'use strict';

const DiscordRequest = require('../../function/DiscordRequest.js');

module.exports = {
  data: {
    name: 'ping',
    description: 'Mostra a latência do bot neste servidor'
  },

  async execute(interaction, client) {

    const COR = 0x7C8FFF;
    const e = client.emoji;
    const guildId = interaction.guild_id;

    const shardId = client.getShardId(guildId);
    const info = await client.getClusterInfo();
    const shard = info.shards.find(s => s.shardId === shardId);
    const CLUSTERS_NAME = client.CLUSTERS_NAME;

    const embed = {
      title: `${e.feliz} Pong!`,
      color: COR,
      fields: [
        { name: "🏓 Ping",      value: `\`${shard?.ping ?? "?"}ms\``,          inline: true },
        { name: "📡 Shard",     value: `\`#${shardId}\``,                       inline: true },
        { name: "🖥️ Cluster",  value: `\`${CLUSTERS_NAME[info.clusterId]}\``,  inline: true },
        { name: "⏳ Uptime",    value: `\`${_formatUptime(info.uptime)}\``,     inline: true },
        { name: "💾 Memória",   value: `\`${_formatMemory(info.memory)}\``,     inline: true }
      ],
      timestamp: new Date().toISOString()
    };

    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: 'POST',
        body: {
          type: 4,
          data: { embeds: [embed]}
        }
      }
    );
  }
};

function _formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

function _formatMemory(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
