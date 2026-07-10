'use strict';

/**
 * SeqQuestionsManager
 *
 * Conduz um formulário sequencial diretamente no chat do ticket.
 * Coexiste com o sistema de modal existente — não o substitui.
 *
 * Tipos de pergunta suportados: text, short, long, number, yesno,
 * select, multiple, checkbox, member, role, channel, attachment.
 */

const DiscordRequest = require('../../DiscordRequest.js');

const COMPONENT_TYPES = new Set(['select', 'multiple', 'checkbox', 'member', 'role', 'channel']);

class SeqQuestionsManager {

  constructor(client) {
    this.client = client;
  }

  /* ═══════════════════════════════════════════
     ENTRY POINT
     ═══════════════════════════════════════════ */

  /**
   * Inicia o formulário sequencial no canal do ticket.
   * Deve ser chamado depois que o canal/thread já foi criado.
   *
   * @param {object} opts
   * @param {object} opts.panel      Painel (ou opção do select) com seqQuestionsConfig
   * @param {string} opts.channelId
   * @param {string} opts.userId
   * @param {object} [opts.messages] Mensagens personalizadas (vindas de
   *        ticketMensagensConfig, já resolvidas com fallback no chamador):
   *          { inicioTitulo, inicioDescricao, canceladoMensagem, resumoTitulo }
   * @returns {Promise<object|null>} Mapa de respostas ou null se cancelado/timeout
   */
  async run({ panel, channelId, userId, messages = {} }) {
    const cfg = panel.seqQuestionsConfig;
    if (!cfg?.enabled || !cfg.questions?.length) return null;

    const answers     = {};
    const timeoutMs   = cfg.timeout || 120_000;
    const timeoutSec  = Math.floor(timeoutMs / 1000);

    // Mensagem de início — personalizável
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body:   {
        embeds: [{
          title:       messages.inicioTitulo || '📋 Formulário de Atendimento',
          description: messages.inicioDescricao ||
                       `Olá <@${userId}>! Por favor, responda as perguntas abaixo.\n\n` +
                       `Você tem **${timeoutSec} segundos** para cada resposta.\n` +
                       `Digite \`cancelar\` a qualquer momento para encerrar.`,
          color: 0x7C8FFF
        }]
      }
    });

    for (let i = 0; i < cfg.questions.length; i++) {
      const question = cfg.questions[i];
      const result   = await this._askQuestion({
        channelId,
        userId,
        question,
        index:   i + 1,
        total:   cfg.questions.length,
        timeout: timeoutMs
      });

      if (result === null) {
        // timeout ou cancelamento — mensagem personalizável
        await DiscordRequest(`/channels/${channelId}/messages`, {
          method: 'POST',
          body:   {
            content: `<@${userId}> ${messages.canceladoMensagem || '⚠️ Formulário encerrado.'}`,
            flags:   0
          }
        });
        return null;
      }

      answers[question.id] = result;
    }

    // Envia resumo das respostas
    await this._sendAnswersSummary({ cfg, panel, channelId, userId, answers, resumoTitulo: messages.resumoTitulo });

    return answers;
  }

  /* ═══════════════════════════════════════════
     PERGUNTAR UMA QUESTÃO
     ═══════════════════════════════════════════ */

  async _askQuestion({ channelId, userId, question, index, total, timeout }) {

    if (COMPONENT_TYPES.has(question.tipo)) {
      return this._askComponentQuestion({ channelId, userId, question, index, total, timeout });
    }
    if (question.tipo === 'attachment') {
      return this._askAttachmentQuestion({ channelId, userId, question, index, total, timeout });
    }
    return this._askTextQuestion({ channelId, userId, question, index, total, timeout });
  }

  /* ── Perguntas de texto/número/sim-não (via mensagem) ── */
  async _askTextQuestion({ channelId, userId, question, index, total, timeout }) {

    const hint = this._getHint(question);

    // Envia a pergunta no canal
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body:   {
        embeds: [{
          description: `**[${index}/${total}] ${question.label}**${hint ? `\n${hint}` : ''}` +
                       `${question.placeholder ? `\n\n*${question.placeholder}*` : ''}`,
          color:       0x5865F2,
          footer:      { text: `Pergunta ${index} de ${total}` }
        }]
      }
    });

    // Aguarda resposta do usuário (coleta limitada ao userId)
    let msg;
    try {
      msg = await this.client.NextMessageCollector.wait({
        channelId,
        userId,
        time: timeout
      });
    } catch {
      return null; // timeout
    }

    // Verifica cancelamento
    if (msg.content?.toLowerCase() === 'cancelar') return null;

    // Valida a resposta conforme o tipo
    const validated = this._validate(question, msg.content);
    if (validated === false) {
      // resposta inválida — notifica e tenta de novo recursivamente
      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body:   { content: `⚠️ <@${userId}> Resposta inválida. Tente novamente.` }
      });
      return this._askTextQuestion({ channelId, userId, question, index, total, timeout });
    }

    return validated;
  }

  /* ── Perguntas de anexo (aguarda mensagem com arquivo) ── */
  async _askAttachmentQuestion({ channelId, userId, question, index, total, timeout }) {

    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          description: `**[${index}/${total}] ${question.label}**\n_Envie um arquivo ou imagem como resposta._`,
          color:       0x5865F2,
          footer:      { text: `Pergunta ${index} de ${total}` }
        }]
      }
    });

    let msg;
    try {
      msg = await this.client.NextMessageCollector.wait({ channelId, userId, time: timeout });
    } catch {
      return null; // timeout
    }

    if (msg.content?.toLowerCase() === 'cancelar') return null;

    if (!msg.attachments?.length) {
      if (question.required === false) return null;
      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body:   { content: `⚠️ <@${userId}> Envie um arquivo/imagem como resposta (ou digite \`cancelar\`).` }
      });
      return this._askAttachmentQuestion({ channelId, userId, question, index, total, timeout });
    }

    return msg.attachments.map(a => a.url);
  }

  /* ── Perguntas via componente (seleção/múltipla/checkbox/membro/cargo/canal) ── */
  async _askComponentQuestion({ channelId, userId, question, index, total, timeout }) {
    const kind = question.tipo;
    const isMulti = kind === 'multiple' || kind === 'checkbox';

    const commonData = {
      placeholder: question.placeholder || 'Escolha uma opção...',
      min_values:  kind === 'checkbox' ? 0 : 1,
      max_values:  isMulti ? Math.max(1, Math.min(25, question.options?.length || 25)) : 1,
    };

    return new Promise(async (resolve) => {
      let settled = false;
      const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
      const timer  = setTimeout(() => finish(null), timeout);

      const funcao = async (si) => {
        clearTimeout(timer);
        await DiscordRequest(`/interactions/${si.id}/${si.token}/callback`, { method: 'POST', body: { type: 6 } }).catch(() => {});
        const values = si.data?.values || [];
        finish(isMulti ? values : (values[0] ?? null));
      };

      let component;
      if (kind === 'select' || kind === 'multiple' || kind === 'checkbox') {
        component = this.client.interactions.createSelect({
          user: userId, tempo: timeout, funcao,
          data: {
            ...commonData,
            options: (question.options || []).slice(0, 25).map(o => ({ label: String(o).slice(0, 100), value: String(o).slice(0, 100) })),
          },
        });
      } else if (kind === 'member') {
        component = this.client.interactions.createUserSelect({ user: userId, tempo: timeout, funcao, data: commonData });
      } else if (kind === 'role') {
        component = this.client.interactions.createRoleSelect({ user: userId, tempo: timeout, funcao, data: commonData });
      } else if (kind === 'channel') {
        component = this.client.interactions.createChannelSelect({ user: userId, tempo: timeout, funcao, data: commonData });
      }

      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: {
          embeds: [{
            description: `**[${index}/${total}] ${question.label}**`,
            color:       0x5865F2,
            footer:      { text: `Pergunta ${index} de ${total} · responda pelo menu abaixo` }
          }],
          components: [{ type: 1, components: [component] }],
        },
      });
    });
  }

  /* ═══════════════════════════════════════════
     ENVIO DO RESUMO
     ═══════════════════════════════════════════ */

  async _sendAnswersSummary({ cfg, panel, channelId, userId, answers, resumoTitulo }) {

    const formatAnswer = (q, value) => {
      if (value == null) return '-';
      if (Array.isArray(value)) {
        if (q.tipo === 'member') return value.map(v => `<@${v}>`).join(', ');
        if (q.tipo === 'role')   return value.map(v => `<@&${v}>`).join(', ');
        if (q.tipo === 'channel') return value.map(v => `<#${v}>`).join(', ');
        if (q.tipo === 'attachment') return value.map(v => `[anexo](${v})`).join(', ');
        return value.join(', ') || '-';
      }
      if (q.tipo === 'member')  return `<@${value}>`;
      if (q.tipo === 'role')    return `<@&${value}>`;
      if (q.tipo === 'channel') return `<#${value}>`;
      return String(value);
    };

    const fields = panel.seqQuestionsConfig.questions.map(q => ({
      name:   q.label,
      value:  formatAnswer(q, answers[q.id]).slice(0, 1024),
      inline: false
    }));

    const embed = {
      title:  resumoTitulo || '✅ Respostas Recebidas',
      color:  0x57F287,
      fields,
      footer: { text: `Respondido por ${userId}` },
      timestamp: new Date().toISOString()
    };

    // Aviso curto SEMPRE no ticket — mesmo quando o resumo completo
    // vai pro canal de log, quem abriu o ticket precisa saber que
    // terminou e a equipe já foi notificada.
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body:   {
        content: `<@${userId}>`,
        embeds:  [{
          title:       '✅ Perguntas Respondidas!',
          description: 'Já anotei tudo! Agora é só esperar a equipe te chamar~ 🌸',
          color:       0x57F287
        }]
      }
    }).catch(err => console.error('[SeqQuestions] Erro ao enviar aviso de conclusão:', err));

    // Resumo completo das respostas — no ticket OU no canal de log
    if (cfg.sendMode === 0) {
      await DiscordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body:   { embeds: [embed] }
      }).catch(err => console.error('[SeqQuestions] Erro ao enviar resumo no ticket:', err));
    }

    if (cfg.sendMode === 1 && cfg.logChannelId) {
      await DiscordRequest(`/channels/${cfg.logChannelId}/messages`, {
        method: 'POST',
        body:   {
          content: `📥 Novo formulário de <@${userId}> — ticket: <#${channelId}>`,
          embeds:  [embed]
        }
      }).catch(err => console.error('[SeqQuestions] Erro ao enviar no log:', err));
    }
  }

  /* ═══════════════════════════════════════════
     VALIDAÇÃO POR TIPO
     ═══════════════════════════════════════════ */

  _validate(question, value) {
    if (!value && question.required) return false;

    switch (question.tipo) {
      case 'number': {
        const n = Number(value);
        if (isNaN(n)) return false;
        return n;
      }
      case 'yesno': {
        const v = value?.toLowerCase();
        if (['sim', 's', 'yes', 'y'].includes(v)) return 'Sim';
        if (['não', 'nao', 'n', 'no'].includes(v)) return 'Não';
        return false;
      }
      case 'short': {
        const text = String(value || '').slice(0, 100);
        if (question.required && !text.trim()) return false;
        return text;
      }
      case 'long':
      case 'text':
      default: {
        const text = String(value || '').slice(0, question.maxLength || 2000);
        if (question.required && !text.trim()) return false;
        return text;
      }
    }
  }

  _getHint(question) {
    switch (question.tipo) {
      case 'number': return '_Responda com um número_';
      case 'yesno':  return '_Responda com **Sim** ou **Não**_';
      case 'short':  return '_Resposta curta (até 100 caracteres)_';
      default:       return '';
    }
  }
}

module.exports = SeqQuestionsManager;
