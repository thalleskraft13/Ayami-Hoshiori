'use strict';

const DiscordRequest = require('../../function/DiscordRequest.js');

const COLORS = {
  personal: 0xA9D6FF, // Azul Cabelo
  group:    0x7C8FFF, // Azul Secundário
  guild:    0x243B7A, // Azul Escuro
  event:    0xFFD966, // Dourado
  success:  0xFFB6C8, // Bochechas / Rosa
  danger:   0xFF6B8A, // Perigo suave
  default:  0xC6CDD8  // Prata
};

/* ═══════════════════════════════════════════════════════════
   COMANDO /missoes
   ═══════════════════════════════════════════════════════════ */

module.exports = {
  data: {
    name:        'missoes',
    description: 'Veja suas missões pessoais, de grupo e de guilda com a Ayami!',
    options: [
      {
        type:        1,
        name:        'ver',
        description: 'Veja suas missões diárias e semanais pessoais'
      },
      {
        type:        1,
        name:        'guilda',
        description: 'Missões semanais e eventos do servidor'
      },
      {
        type:        2,
        name:        'grupo',
        description: 'Gerencie seu Grupo de Aventureiros',
        options: [
          {
            type:        1,
            name:        'criar',
            description: 'Cria um novo grupo de aventureiros'
          },
          {
            type:        1,
            name:        'convidar',
            description: 'Convida um usuário para o seu grupo',
            options: [
              { type: 6, name: 'usuario', description: 'Usuário a convidar', required: true }
            ]
          },
          {
            type:        1,
            name:        'aceitar',
            description: 'Aceita um convite pendente de grupo'
          },
          {
            type:        1,
            name:        'sair',
            description: 'Sai do grupo atual (líderes dissolvem o grupo)'
          },
          {
            type:        1,
            name:        'ver',
            description: 'Vê as missões e membros do seu grupo'
          }
        ]
      }
    ]
  },

  async execute(interaction, client) {
    const userId  = interaction.member?.user?.id || interaction.user?.id;
    const guildId = interaction.guild_id;
    const sub     = interaction.data.options?.[0]?.name;
    const subSub  = interaction.data.options?.[0]?.options?.[0]?.name;
    const opts    = _opts(interaction);
    const e       = client.emoji;

    await _defer(interaction);

    try {
      switch (sub) {
        case 'ver':    return await _renderPersonal(interaction, client, userId, 'daily');
        case 'guilda': return await _renderGuildMissions(interaction, client, userId, guildId, 'weekly');
        case 'grupo': {
          switch (subSub) {
            case 'criar':    return await _grupoCriar(interaction, client, userId);
            case 'convidar': return await _grupoConvidar(interaction, client, userId, opts.usuario);
            case 'aceitar':  return await _grupoAceitar(interaction, client, userId);
            case 'sair':     return await _grupoSair(interaction, client, userId);
            case 'ver':      return await _grupoVer(interaction, client, userId);
          }
        }
        default: return await _renderPersonal(interaction, client, userId, 'daily');
      }
    } catch (err) {
      console.error('[missoes]', err);
      return _edit(interaction, client, {
        embeds: [{
          title:       `${e.brava} Eita, deu ruim...`,
          description: `Algo deu errado por aqui! ${e.chorando}\n\`${err.message || 'Erro inesperado.'}\``,
          color:       COLORS.danger,
          footer:      { text: 'Ayami Hoshiori • tenta de novo, tá? 🌸' }
        }]
      });
    }
  }
};

/* ═══════════════════════════════════════════════════════════
   MISSÕES PESSOAIS
   ═══════════════════════════════════════════════════════════ */

async function _renderPersonal(interaction, client, userId, period) {
  const e           = client.emoji;
  const missions    = await client.missionManager.getPersonalMissions(userId);
  const data        = missions[period];
  const list        = data?.list || [];
  const doneCount   = list.filter(m => m.done).length;
  const totalReward = list.reduce((acc, m) => acc + m.reward, 0);
  const timeLeft    = _formatTimeLeft(data?.expiresAt || 0);

  const lines = list.map(m => {
    const bar    = _bar(m.progress, m.goal);
    const status = m.done ? e.curtida : e.animada;
    const pct    = Math.floor((m.progress / m.goal) * 100);
    return `${status} **${m.label}**\n${bar} \`${m.progress}/${m.goal}\` (${pct}%) — 🔮 ${m.reward} Primogemas`;
  }).join('\n\n');

  const btnDaily = client.interactions.createButton({
    user: userId,
    data: { label: '☀️ Diárias', style: period === 'daily' ? 1 : 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderPersonal(i, client, userId, 'daily'); }
  });

  const btnWeekly = client.interactions.createButton({
    user: userId,
    data: { label: '🗓️ Semanais', style: period === 'weekly' ? 1 : 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderPersonal(i, client, userId, 'weekly'); }
  });

  const btnGroup = client.interactions.createButton({
    user: userId,
    data: { label: '🫂 Grupo', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _grupoVer(i, client, userId); }
  });

  const btnGuild = client.interactions.createButton({
    user: userId,
    data: { label: '🏯 Guilda', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderGuildMissions(i, client, userId, i.guild_id, 'weekly'); }
  });

  const btnRefresh = client.interactions.createButton({
    user: userId,
    data: { label: '🔄', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderPersonal(i, client, userId, period); }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${period === 'daily' ? `${e.feliz} Missões do Dia!` : `${e.pensando} Missões da Semana!`}`,
      description: lines || `_Hmm, parece que não tem nenhuma missão por aqui... ${e.emduvida}_`,
      color:       COLORS.personal,
      fields: [
        { name: `${e.animada} Progresso`,        value: `${doneCount}/${list.length} concluídas`, inline: true },
        { name: '🔮 Recompensa total',            value: `${totalReward} Primogemas`,              inline: true },
        { name: '⏰ Reinicia em',                  value: timeLeft,                                 inline: true }
      ],
      footer:    { text: 'Ayami Hoshiori • o progresso atualiza conforme você age no servidor ⭐' },
      timestamp: new Date().toISOString()
    }],
    components: [{ type: 1, components: [btnDaily, btnWeekly, btnGroup, btnGuild, btnRefresh] }]
  });
}

/* ═══════════════════════════════════════════════════════════
   GRUPO DE AVENTUREIROS
   ═══════════════════════════════════════════════════════════ */

async function _grupoCriar(interaction, client, userId) {
  const e     = client.emoji;
  const group = await client.missionManager.createGroup(userId);
  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.festa} Grupo criado, vamos nessa!`,
      description: `Seu grupo de aventureiros foi criado! ${e.animada}\n\n⭐ **ID do Grupo:** \`${group.groupId}\`\n\nAgora é só usar \`/missoes grupo convidar\` e chamar até 3 amigos pra aventura!`,
      color:       COLORS.group,
      footer:      { text: 'Ayami Hoshiori • quanto mais, melhor! 🌸' }
    }]
  });
}

async function _grupoConvidar(interaction, client, userId, targetId) {
  const e = client.emoji;
  if (!targetId) {
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.emduvida} Ei, quem você quer convidar?`,
        description: 'Você esqueceu de informar o usuário! Tenta de novo~',
        color:       COLORS.danger
      }]
    });
  }

  const group = await client.missionManager.inviteToGroup(userId, targetId);
  _notifyInvite(client, targetId, userId, group.groupId).catch(() => {});

  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.corao} Convite enviado!`,
      description: `<@${targetId}> recebeu um convite para o grupo **${group.groupId}**! ${e.feliz}\nO convite expira em **10 minutos**.\n\nEle(a) pode aceitar com \`/missoes grupo aceitar\` ⭐`,
      color:       COLORS.group,
      footer:      { text: 'Ayami Hoshiori • torço pra eles toparem! 🌸' }
    }]
  });
}

async function _grupoAceitar(interaction, client, userId) {
  const e     = client.emoji;
  const group = await client.missionManager.acceptInvite(userId);
  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.festa} Bem-vindo(a) ao grupo!`,
      description: `Você entrou no grupo **${group.groupId}**! ${e.animada}\n👥 Membros: ${group.members.length}/4\n\nAs missões foram atualizadas para **${group.members.length}** membro(s). Bora conquistar tudo! ⭐`,
      color:       COLORS.group,
      footer:      { text: 'Ayami Hoshiori • aventura em equipe é muito mais divertido! 🌸' }
    }]
  });
}

async function _grupoSair(interaction, client, userId) {
  const e = client.emoji;

  const btnConfirm = client.interactions.createButton({
    user: userId,
    data: { label: '✅ Confirmar', style: 4 },
    funcao: async (i) => {
      await _deferUpdate(i);
      const result = await client.missionManager.leaveGroup(userId);
      const msg = result.dissolved
        ? `${e.chorando} Você era o líder... o grupo foi dissolvido.`
        : `${e.sonolenta} Você saiu do grupo **${result.group.groupId}**.`;
      return _edit(i, client, {
        embeds: [{
          title:       msg,
          description: result.dissolved
            ? 'Poxa, que pena... mas novas aventuras esperam por você! ⭐'
            : 'Até mais! Se quiser, é só criar ou entrar em outro grupo~ 🌸',
          color:       COLORS.danger
        }],
        components: []
      });
    }
  });

  const btnCancel = client.interactions.createButton({
    user: userId,
    data: { label: '❌ Cancelar', style: 2 },
    funcao: async (i) => {
      await _deferUpdate(i);
      return _edit(i, client, {
        embeds: [{
          title:       `${e.feliz} Ufa, cancelado!`,
          description: 'Que bom que você ficou! A aventura continua~ ⭐',
          color:       COLORS.default
        }],
        components: []
      });
    }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.assustada} Tem certeza que quer sair?`,
      description: `Se você for o **líder**, o grupo será **dissolvido** para todo mundo... ${e.chorando2}\nPensa bem antes de confirmar!`,
      color:       COLORS.danger,
      footer:      { text: 'Ayami Hoshiori • eu não quero que você vá embora... 🌸' }
    }],
    components: [{ type: 1, components: [btnConfirm, btnCancel] }]
  });
}

async function _grupoVer(interaction, client, userId) {
  const e      = client.emoji;
  const result = await client.missionManager.getGroupMissions(userId);

  if (!result) {
    const btnCriar = client.interactions.createButton({
      user: userId,
      data: { label: '⭐ Criar grupo', style: 1 },
      funcao: async (i) => { await _deferUpdate(i); return _grupoCriar(i, client, userId); }
    });
    const btnPersonal = client.interactions.createButton({
      user: userId,
      data: { label: '🌸 Pessoais', style: 2 },
      funcao: async (i) => { await _deferUpdate(i); return _renderPersonal(i, client, userId, 'daily'); }
    });
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.emduvida} Você não está em nenhum grupo!`,
        description: `Que tal criar um e chamar até **3 amigos** pra aventura? ${e.animada}\n\n✨ **Bônus de grupo:** recompensa base × número de membros!\nQuanto mais amigos, mais Primogemas pra todo mundo~ 🔮`,
        color:       COLORS.group,
        footer:      { text: 'Ayami Hoshiori • aventura em equipe é a melhor! 🌸' }
      }],
      components: [{ type: 1, components: [btnCriar, btnPersonal] }]
    });
  }

  const { group, missions } = result;
  return _renderGroupMissions(interaction, client, userId, group, missions, 'daily');
}

async function _renderGroupMissions(interaction, client, userId, group, missions, period) {
  const e        = client.emoji;
  const data     = missions[period];
  const list     = data?.list || [];
  const members  = group.members.length;
  const timeLeft = _formatTimeLeft(data?.expiresAt || 0);

  const memberMentions = group.members
    .map((id, i) => `${i === 0 ? `${e.sria}` : `${e.animada}`} <@${id}>`)
    .join('\n');

  const lines = list.map(m => {
    const bar    = _bar(m.progress, m.goal);
    const status = m.done ? e.curtida : e.feliz;
    const pct    = Math.floor((m.progress / m.goal) * 100);
    const reward = m.baseReward * members;
    return `${status} **${m.label}**\n${bar} \`${m.progress}/${m.goal}\` (${pct}%) — 🔮 ${reward} cada`;
  }).join('\n\n');

  const doneCount   = list.filter(m => m.done).length;
  const totalReward = list.reduce((acc, m) => acc + (m.baseReward * members), 0);

  const btnDaily = client.interactions.createButton({
    user: userId,
    data: { label: '☀️ Diárias', style: period === 'daily' ? 1 : 2 },
    funcao: async (i) => {
      await _deferUpdate(i);
      const r = await client.missionManager.getGroupMissions(userId);
      if (!r) return;
      return _renderGroupMissions(i, client, userId, r.group, r.missions, 'daily');
    }
  });

  const btnWeekly = client.interactions.createButton({
    user: userId,
    data: { label: '🗓️ Semanais', style: period === 'weekly' ? 1 : 2 },
    funcao: async (i) => {
      await _deferUpdate(i);
      const r = await client.missionManager.getGroupMissions(userId);
      if (!r) return;
      return _renderGroupMissions(i, client, userId, r.group, r.missions, 'weekly');
    }
  });

  const btnPersonal = client.interactions.createButton({
    user: userId,
    data: { label: '🌸 Pessoais', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderPersonal(i, client, userId, 'daily'); }
  });

  const btnRefresh = client.interactions.createButton({
    user: userId,
    data: { label: '🔄', style: 2 },
    funcao: async (i) => {
      await _deferUpdate(i);
      const r = await client.missionManager.getGroupMissions(userId);
      if (!r) return;
      return _renderGroupMissions(i, client, userId, r.group, r.missions, period);
    }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${period === 'daily' ? `${e.feliz} Diárias` : `${e.pensando} Semanais`} — Grupo ${group.groupId}`,
      description: lines || `_Nenhuma missão de grupo disponível por enquanto... ${e.emduvida}_`,
      color:       COLORS.group,
      fields: [
        { name: `👥 Membros (${members}/4)`, value: memberMentions,                                 inline: true },
        { name: `${e.animada} Progresso`,    value: `${doneCount}/${list.length} concluídas`,       inline: true },
        { name: '🔮 Recompensa (cada)',       value: `${totalReward} Primogemas`,                    inline: true },
        { name: '⭐ Bônus de grupo',          value: `**${members}×** recompensa base`,              inline: true },
        { name: '⏰ Reinicia em',              value: timeLeft,                                       inline: true }
      ],
      footer:    { text: `Ayami Hoshiori • ID do grupo: ${group.groupId} 🌸` },
      timestamp: new Date().toISOString()
    }],
    components: [{ type: 1, components: [btnDaily, btnWeekly, btnPersonal, btnRefresh] }]
  });
}

/* ═══════════════════════════════════════════════════════════
   MISSÕES DE GUILDA
   ═══════════════════════════════════════════════════════════ */

async function _renderGuildMissions(interaction, client, userId, guildId, tab) {
  const doc = await client.missionManager.getGuildMissions(guildId);
  if (tab === 'event') return _renderEventMission(interaction, client, userId, guildId, doc);
  return _renderWeeklyMissions(interaction, client, userId, guildId, doc);
}

async function _renderWeeklyMissions(interaction, client, userId, guildId, doc) {
  const e            = client.emoji;
  const list         = doc.missions.weekly?.list || [];
  const timeLeft     = _formatTimeLeft(doc.missions.weekly?.expiresAt || 0);
  const doneCount    = list.filter(m => m.done).length;
  const pendingTotal = doc.pendingRewards
    .filter(r => r.userId === userId)
    .reduce((acc, r) => acc + r.amount, 0);

  const lines = list.map(m => {
    const bar      = _bar(m.progress, m.goal);
    const status   = m.done ? e.curtida : e.animada;
    const pct      = Math.floor((m.progress / m.goal) * 100);
    const contribs = Object.keys(m.contributors || {}).length;
    return (
      `${status} **${m.label}**\n` +
      `${bar} \`${m.progress}/${m.goal}\` (${pct}%) — 🔮 ${m.reward} • 👤 ${contribs} contribuidor(es)`
    );
  }).join('\n\n');

  const btnWeekly = client.interactions.createButton({
    user: userId,
    data: { label: '🗓️ Semanais', style: 1 }
  });

  const btnEvent = client.interactions.createButton({
    user: userId,
    data: { label: '⚡ Evento', style: doc.missions.event?.active ? 3 : 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderGuildMissions(i, client, userId, guildId, 'event'); }
  });

  const btnPersonal = client.interactions.createButton({
    user: userId,
    data: { label: '🌸 Pessoais', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderPersonal(i, client, userId, 'daily'); }
  });

  const btnCollect = client.interactions.createButton({
    user: userId,
    data: { label: `🎁 Coletar (${pendingTotal} 🔮)`, style: pendingTotal > 0 ? 3 : 2, disabled: pendingTotal === 0 },
    funcao: async (i) => {
      await _deferUpdate(i);
      const collected = await client.missionManager.collectGuildRewards(guildId, userId);
      return _edit(i, client, {
        embeds: [{
          title:       `${e.festa} Recompensas coletadas!`,
          description: `Você recebeu **${collected} 🔮 Primogemas** das missões de guilda! ${e.feliz}\nBem merecido~ ⭐`,
          color:       COLORS.success,
          footer:      { text: 'Ayami Hoshiori • continue contribuindo! 🌸' }
        }],
        components: []
      });
    }
  });

  const btnRefresh = client.interactions.createButton({
    user: userId,
    data: { label: '🔄', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderGuildMissions(i, client, userId, guildId, 'weekly'); }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.sria} Missões de Guilda — Semanais`,
      description: lines || `_Sem missões de guilda por agora... ${e.emduvida}_`,
      color:       COLORS.guild,
      fields: [
        { name: `${e.animada} Progresso`, value: `${doneCount}/${list.length} concluídas`, inline: true },
        { name: '⏰ Reinicia em',          value: timeLeft,                                 inline: true },
        { name: '🎁 Suas recompensas',     value: `${pendingTotal} 🔮 pendentes`,           inline: true }
      ],
      footer:    { text: 'Ayami Hoshiori • todo mundo do servidor contribui junto! ⭐' },
      timestamp: new Date().toISOString()
    }],
    components: [
      { type: 1, components: [btnWeekly, btnEvent, btnPersonal] },
      { type: 1, components: [btnCollect, btnRefresh] }
    ]
  });
}

async function _renderEventMission(interaction, client, userId, guildId, doc) {
  const e = client.emoji;
  const ev = doc.missions.event;

  const btnBack = client.interactions.createButton({
    user: userId,
    data: { label: '⬅️ Semanais', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderGuildMissions(i, client, userId, guildId, 'weekly'); }
  });

  if (!ev?.active || !ev.mission) {
    return _edit(interaction, client, {
      embeds: [{
        title:       `${e.emburrada} Nenhum evento ativo...`,
        description: `Poxa, não tem nenhum evento rolando agora. ${e.chorando}\nMas não se preocupa — eventos especiais aparecem toda semana com recompensas incríveis! ⭐`,
        color:       COLORS.event,
        footer:      { text: 'Ayami Hoshiori • fica de olho! 🌸' }
      }],
      components: [{ type: 1, components: [btnBack] }]
    });
  }

  const m            = ev.mission;
  const bar          = _bar(m.progress || 0, m.goal);
  const pct          = Math.floor(((m.progress || 0) / m.goal) * 100);
  const timeLeft     = _formatTimeLeft(ev.expiresAt || 0);
  const contribs     = Object.keys(m.contributors || {}).length;
  const status       = m.done ? `${e.festa} **CONCLUÍDO!**` : `${e.animada} **Em andamento**`;
  const pendingTotal = doc.pendingRewards
    .filter(r => r.userId === userId)
    .reduce((acc, r) => acc + r.amount, 0);

  const btnCollect = client.interactions.createButton({
    user: userId,
    data: { label: `🎁 Coletar (${pendingTotal} 🔮)`, style: pendingTotal > 0 ? 3 : 2, disabled: pendingTotal === 0 },
    funcao: async (i) => {
      await _deferUpdate(i);
      const collected = await client.missionManager.collectGuildRewards(guildId, userId);
      return _edit(i, client, {
        embeds: [{
          title:       `${e.festa} Recompensas do evento coletadas!`,
          description: `Você recebeu **${collected} 🔮 Primogemas** do evento! ${e.feliz}\nIncrível, parabéns! ⭐`,
          color:       COLORS.success,
          footer:      { text: 'Ayami Hoshiori • você arrasou! 🌸' }
        }],
        components: []
      });
    }
  });

  const btnRefresh = client.interactions.createButton({
    user: userId,
    data: { label: '🔄', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderGuildMissions(i, client, userId, guildId, 'event'); }
  });

  return _edit(interaction, client, {
    embeds: [{
      title:       `${e.festa} Evento — ${m.label}`,
      description: `${status}\n\n${bar} \`${m.progress || 0}/${m.goal}\` (${pct}%)`,
      color:       m.done ? COLORS.success : COLORS.event,
      fields: [
        { name: '🔮 Recompensa',       value: `${m.reward} Primogemas por contribuidor`, inline: true },
        { name: '👥 Contribuidores',   value: String(contribs),                           inline: true },
        { name: '⏰ Expira em',         value: timeLeft,                                  inline: true },
        { name: '🎁 Suas recompensas', value: `${pendingTotal} 🔮 pendentes`,             inline: true }
      ],
      footer:    { text: 'Ayami Hoshiori • eventos duram 48h, não perca! ⭐' },
      timestamp: new Date().toISOString()
    }],
    components: [{ type: 1, components: [btnBack, btnCollect, btnRefresh] }]
  });
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICAÇÃO DE CONVITE VIA DM
   ═══════════════════════════════════════════════════════════ */

async function _notifyInvite(client, targetId, leaderId, groupId) {
  const e = client.emoji;
  try {
    const dm = await DiscordRequest('/users/@me/channels', {
      method: 'POST',
      body:   { recipient_id: targetId }
    });
    if (!dm?.id) return;

    await DiscordRequest(`/channels/${dm.id}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          title:       `${e.corao} Convite para Grupo de Aventureiros!`,
          description: `<@${leaderId}> te convidou para o grupo **${groupId}**! ${e.animada}\n\nUse \`/missoes grupo aceitar\` para entrar na aventura~\n> O convite expira em **10 minutos**. ⭐`,
          color:       COLORS.group,
          footer:      { text: 'Ayami Hoshiori • espero que você aceite! 🌸' },
          timestamp:   new Date().toISOString()
        }]
      }
    });
  } catch {}
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function _bar(current, goal) {
  const filled = Math.min(Math.round((current / goal) * 10), 10);
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

function _formatTimeLeft(expiresAt) {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Reiniciando...';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h ${m}m`;
  return `${h}h ${m}m`;
}

function _opts(interaction) {
  const sub    = interaction.data.options?.[0];
  const subSub = sub?.options?.[0];
  const opts   = {};
  for (const o of subSub?.options || sub?.options || []) {
    if (o.type !== 1 && o.type !== 2) opts[o.name] = o.value;
  }
  return opts;
}

async function _defer(interaction) {
  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    { method: 'POST', body: { type: 5, data: {} } }
  );
}

async function _deferUpdate(interaction) {
  return DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    { method: 'POST', body: { type: 6 } }
  );
}

async function _edit(interaction, client, data) {
  return DiscordRequest(
    `/webhooks/${client.clientId}/${interaction.token}/messages/@original`,
    { method: 'PATCH', body: data }
  );
}