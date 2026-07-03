'use strict';

/**
 * SeqQuestionsManager
 *
 * Conduz um formulário sequencial diretamente no chat do ticket.
 * Coexiste com o sistema de modal existente — não o substitui.
 *
 * Tipos de pergunta suportados atualmente: text, number, yesno
 * Preparado para: attachment, select (infra já presente no schema)
 */

const DiscordRequest = require('../../DiscordRequest.js');

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
      return this._askQuestion({ channelId, userId, question, index, total, timeout });
    }

    return validated;
  }

  /* ═══════════════════════════════════════════
     ENVIO DO RESUMO
     ═══════════════════════════════════════════ */

  async _sendAnswersSummary({ cfg, panel, channelId, userId, answers, resumoTitulo }) {

    const fields = panel.seqQuestionsConfig.questions.map(q => ({
      name:   q.label,
      value:  String(answers[q.id] ?? '-').slice(0, 1024),
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
      default:       return '';
    }
  }
}

module.exports = SeqQuestionsManager;
