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
   HELPERS COMPONENTS V2
   (mesmo padrão usado no Logic Builder / Biblioteca)
   ═══════════════════════════════════════════════════════════ */

function cv2Text(content) {
  return { type: 10, content };
}

function cv2Divider(spacing = 1) {
  return { type: 14, divider: true, spacing };
}

function cv2Container(blocks, opts = {}) {
  return {
    type:         17,
    accent_color: opts.accentColor ?? COLORS.default,
    spoiler:      opts.spoiler ?? false,
    components:   blocks
  };
}

function cv2Flags(ephemeral = false) {
  return ephemeral ? 32768 | 64 : 32768;
}

function cv2Payload(blocks, opts = {}) {
  return {
    flags:      cv2Flags(opts.ephemeral ?? false),
    components: [cv2Container(blocks, opts)]
  };
}

function row(...components) {
  return { type: 1, components };
}

/* ═══════════════════════════════════════════════════════════
   COMANDO /missoes
   ═══════════════════════════════════════════════════════════ */

module.exports = {
  data: {
    name:        'missoes',
    description: 'Veja suas missões pessoais, de grupo e de guilda com a Ayami!',
    name_localizations: { 'en-US': 'missions', 'en-GB': 'missions', 'es-ES': 'misiones' },
    description_localizations: {
      'en-US': 'See your personal, group, and guild missions with Ayami!',
      'en-GB': 'See your personal, group, and guild missions with Ayami!',
      'es-ES': '¡Consulta tus misiones personales, de grupo y de gremio con Ayami!',
    },
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
      return _edit(interaction, client, cv2Payload([
        cv2Text(
          `# ${e.brava} Eita, deu ruim...\n` +
          `Algo deu errado por aqui! ${e.chorando}\n\`${err.message || 'Erro inesperado.'}\``
        ),
      ], { accentColor: COLORS.danger }));
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

  const title = period === 'daily' ? `${e.feliz} Missões do Dia!` : `${e.pensando} Missões da Semana!`;

  const blocks = [
    cv2Text(`# ${title}\n${lines || `_Hmm, parece que não tem nenhuma missão por aqui... ${e.emduvida}_`}`),
    cv2Divider(),
    cv2Text(
      `> ${e.animada} **Progresso:** ${doneCount}/${list.length} concluídas\n` +
      `> 🔮 **Recompensa total:** ${totalReward} Primogemas\n` +
      `> ⏰ **Reinicia em:** ${timeLeft}`
    ),
    cv2Divider(),
    row(btnDaily, btnWeekly, btnGroup, btnGuild, btnRefresh),
    cv2Divider(),
    cv2Text('-# Ayami Hoshiori • o progresso atualiza conforme você age no servidor ⭐'),
  ];

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: COLORS.personal }));
}

/* ═══════════════════════════════════════════════════════════
   GRUPO DE AVENTUREIROS
   ═══════════════════════════════════════════════════════════ */

async function _grupoCriar(interaction, client, userId) {
  const e     = client.emoji;
  const group = await client.missionManager.createGroup(userId);

  return _edit(interaction, client, cv2Payload([
    cv2Text(
      `# ${e.festa} Grupo criado, vamos nessa!\n` +
      `Seu grupo de aventureiros foi criado! ${e.animada}\n\n` +
      `⭐ **ID do Grupo:** \`${group.groupId}\`\n\n` +
      `Agora é só usar \`/missoes grupo convidar\` e chamar até 3 amigos pra aventura!`
    ),
    cv2Divider(),
    cv2Text('-# Ayami Hoshiori • quanto mais, melhor! 🌸'),
  ], { accentColor: COLORS.group }));
}

async function _grupoConvidar(interaction, client, userId, targetId) {
  const e = client.emoji;
  if (!targetId) {
    return _edit(interaction, client, cv2Payload([
      cv2Text(
        `# ${e.emduvida} Ei, quem você quer convidar?\n` +
        `Você esqueceu de informar o usuário! Tenta de novo~`
      ),
    ], { accentColor: COLORS.danger }));
  }

  const group = await client.missionManager.inviteToGroup(userId, targetId);
  _notifyInvite(client, targetId, userId, group.groupId).catch(() => {});

  return _edit(interaction, client, cv2Payload([
    cv2Text(
      `# ${e.corao} Convite enviado!\n` +
      `<@${targetId}> recebeu um convite para o grupo **${group.groupId}**! ${e.feliz}\n` +
      `O convite expira em **10 minutos**.\n\n` +
      `Ele(a) pode aceitar com \`/missoes grupo aceitar\` ⭐`
    ),
    cv2Divider(),
    cv2Text('-# Ayami Hoshiori • torço pra eles toparem! 🌸'),
  ], { accentColor: COLORS.group }));
}

async function _grupoAceitar(interaction, client, userId) {
  const e     = client.emoji;
  const group = await client.missionManager.acceptInvite(userId);

  return _edit(interaction, client, cv2Payload([
    cv2Text(
      `# ${e.festa} Bem-vindo(a) ao grupo!\n` +
      `Você entrou no grupo **${group.groupId}**! ${e.animada}\n` +
      `👥 Membros: ${group.members.length}/4\n\n` +
      `As missões foram atualizadas para **${group.members.length}** membro(s). Bora conquistar tudo! ⭐`
    ),
    cv2Divider(),
    cv2Text('-# Ayami Hoshiori • aventura em equipe é muito mais divertido! 🌸'),
  ], { accentColor: COLORS.group }));
}

async function _grupoSair(interaction, client, userId) {
  const e = client.emoji;

  const btnConfirm = client.interactions.createButton({
    user: userId,
    data: { label: '✅ Confirmar', style: 4 },
    funcao: async (i) => {
      await _deferUpdate(i);
      const result = await client.missionManager.leaveGroup(userId);
      const title = result.dissolved
        ? `${e.chorando} Você era o líder... o grupo foi dissolvido.`
        : `${e.sonolenta} Você saiu do grupo **${result.group.groupId}**.`;
      const desc = result.dissolved
        ? 'Poxa, que pena... mas novas aventuras esperam por você! ⭐'
        : 'Até mais! Se quiser, é só criar ou entrar em outro grupo~ 🌸';

      return _edit(i, client, cv2Payload([
        cv2Text(`# ${title}\n${desc}`),
      ], { accentColor: COLORS.danger }));
    }
  });

  const btnCancel = client.interactions.createButton({
    user: userId,
    data: { label: '❌ Cancelar', style: 2 },
    funcao: async (i) => {
      await _deferUpdate(i);
      return _edit(i, client, cv2Payload([
        cv2Text(`# ${e.feliz} Ufa, cancelado!\nQue bom que você ficou! A aventura continua~ ⭐`),
      ], { accentColor: COLORS.default }));
    }
  });

  return _edit(interaction, client, cv2Payload([
    cv2Text(
      `# ${e.assustada} Tem certeza que quer sair?\n` +
      `Se você for o **líder**, o grupo será **dissolvido** para todo mundo... ${e.chorando2}\n` +
      `Pensa bem antes de confirmar!`
    ),
    cv2Divider(),
    row(btnConfirm, btnCancel),
    cv2Divider(),
    cv2Text('-# Ayami Hoshiori • eu não quero que você vá embora... 🌸'),
  ], { accentColor: COLORS.danger }));
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

    return _edit(interaction, client, cv2Payload([
      cv2Text(
        `# ${e.emduvida} Você não está em nenhum grupo!\n` +
        `Que tal criar um e chamar até **3 amigos** pra aventura? ${e.animada}\n\n` +
        `✨ **Bônus de grupo:** recompensa base × número de membros!\n` +
        `Quanto mais amigos, mais Primogemas pra todo mundo~ 🔮`
      ),
      cv2Divider(),
      row(btnCriar, btnPersonal),
      cv2Divider(),
      cv2Text('-# Ayami Hoshiori • aventura em equipe é a melhor! 🌸'),
    ], { accentColor: COLORS.group }));
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

  const title = period === 'daily' ? `${e.feliz} Diárias` : `${e.pensando} Semanais`;

  const blocks = [
    cv2Text(`# ${title} — Grupo ${group.groupId}\n${lines || `_Nenhuma missão de grupo disponível por enquanto... ${e.emduvida}_`}`),
    cv2Divider(),
    cv2Text(
      `> 👥 **Membros (${members}/4):**\n${memberMentions}`
    ),
    cv2Divider(),
    cv2Text(
      `> ${e.animada} **Progresso:** ${doneCount}/${list.length} concluídas\n` +
      `> 🔮 **Recompensa (cada):** ${totalReward} Primogemas\n` +
      `> ⭐ **Bônus de grupo:** **${members}×** recompensa base\n` +
      `> ⏰ **Reinicia em:** ${timeLeft}`
    ),
    cv2Divider(),
    row(btnDaily, btnWeekly, btnPersonal, btnRefresh),
    cv2Divider(),
    cv2Text(`-# Ayami Hoshiori • ID do grupo: ${group.groupId} 🌸`),
  ];

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: COLORS.group }));
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
    data: { label: '🗓️ Semanais', style: 1 },
    funcao: async (i) => { await _deferUpdate(i); return _renderGuildMissions(i, client, userId, guildId, 'weekly'); }
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
      return _edit(i, client, cv2Payload([
        cv2Text(
          `# ${e.festa} Recompensas coletadas!\n` +
          `Você recebeu **${collected} 🔮 Primogemas** das missões de guilda! ${e.feliz}\nBem merecido~ ⭐`
        ),
        cv2Divider(),
        cv2Text('-# Ayami Hoshiori • continue contribuindo! 🌸'),
      ], { accentColor: COLORS.success }));
    }
  });

  const btnRefresh = client.interactions.createButton({
    user: userId,
    data: { label: '🔄', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderGuildMissions(i, client, userId, guildId, 'weekly'); }
  });

  const blocks = [
    cv2Text(`# ${e.sria} Missões de Guilda — Semanais\n${lines || `_Sem missões de guilda por agora... ${e.emduvida}_`}`),
    cv2Divider(),
    cv2Text(
      `> ${e.animada} **Progresso:** ${doneCount}/${list.length} concluídas\n` +
      `> ⏰ **Reinicia em:** ${timeLeft}\n` +
      `> 🎁 **Suas recompensas:** ${pendingTotal} 🔮 pendentes`
    ),
    cv2Divider(),
    row(btnWeekly, btnEvent, btnPersonal),
    row(btnCollect, btnRefresh),
    cv2Divider(),
    cv2Text('-# Ayami Hoshiori • todo mundo do servidor contribui junto! ⭐'),
  ];

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: COLORS.guild }));
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
    return _edit(interaction, client, cv2Payload([
      cv2Text(
        `# ${e.emburrada} Nenhum evento ativo...\n` +
        `Poxa, não tem nenhum evento rolando agora. ${e.chorando}\n` +
        `Mas não se preocupa — eventos especiais aparecem toda semana com recompensas incríveis! ⭐`
      ),
      cv2Divider(),
      row(btnBack),
      cv2Divider(),
      cv2Text('-# Ayami Hoshiori • fica de olho! 🌸'),
    ], { accentColor: COLORS.event }));
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
      return _edit(i, client, cv2Payload([
        cv2Text(
          `# ${e.festa} Recompensas do evento coletadas!\n` +
          `Você recebeu **${collected} 🔮 Primogemas** do evento! ${e.feliz}\nIncrível, parabéns! ⭐`
        ),
        cv2Divider(),
        cv2Text('-# Ayami Hoshiori • você arrasou! 🌸'),
      ], { accentColor: COLORS.success }));
    }
  });

  const btnRefresh = client.interactions.createButton({
    user: userId,
    data: { label: '🔄', style: 2 },
    funcao: async (i) => { await _deferUpdate(i); return _renderGuildMissions(i, client, userId, guildId, 'event'); }
  });

  const blocks = [
    cv2Text(
      `# ${e.festa} Evento — ${m.label}\n` +
      `${status}\n\n${bar} \`${m.progress || 0}/${m.goal}\` (${pct}%)`
    ),
    cv2Divider(),
    cv2Text(
      `> 🔮 **Recompensa:** ${m.reward} Primogemas por contribuidor\n` +
      `> 👥 **Contribuidores:** ${contribs}\n` +
      `> ⏰ **Expira em:** ${timeLeft}\n` +
      `> 🎁 **Suas recompensas:** ${pendingTotal} 🔮 pendentes`
    ),
    cv2Divider(),
    row(btnBack, btnCollect, btnRefresh),
    cv2Divider(),
    cv2Text('-# Ayami Hoshiori • eventos duram 48h, não perca! ⭐'),
  ];

  return _edit(interaction, client, cv2Payload(blocks, { accentColor: m.done ? COLORS.success : COLORS.event }));
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICAÇÃO DE CONVITE VIA DM
   (mensagem normal — não é o painel principal, mantém embed)
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
      body: cv2Payload([
        cv2Text(
          `# ${e.corao} Convite para Grupo de Aventureiros!\n` +
          `<@${leaderId}> te convidou para o grupo **${groupId}**! ${e.animada}\n\n` +
          `Use \`/missoes grupo aceitar\` para entrar na aventura~\n` +
          `> O convite expira em **10 minutos**. ⭐`
        ),
        cv2Divider(),
        cv2Text('-# Ayami Hoshiori • espero que você aceite! 🌸'),
      ], { accentColor: COLORS.group })
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
