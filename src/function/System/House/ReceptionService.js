'use strict';

const DiscordRequest    = require('../../DiscordRequest.js');
const CV2                = require('../../Messages/CV2.js');
const HouseReception      = require('../../../Mongodb/houseReception.js');
const { localeCtx }       = require('../../Utils/ctxLocale.js');

const HouseConfigService = require('./HouseConfigService.js');
const RoleService         = require('./RoleService.js');
const CharacterService    = require('./CharacterService.js');
const DecorationService   = require('./DecorationService.js');
const HistoryService       = require('./HistoryService.js');
const PremiumService        = require('./PremiumService.js');

const ACCENT = 0x7C8FFF;

class ReceptionService {

  constructor(client) {
    this.client      = client;
    this.config       = new HouseConfigService();
    this.roles        = new RoleService(client);
    this.characters   = new CharacterService();
    this.decoration    = new DecorationService(client);
    this.history        = new HistoryService();
    this.premium          = new PremiumService();
  }

  async _editOriginal(interaction, blocks, opts = {}) {
    return DiscordRequest(`/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`, {
      method: 'PATCH', body: CV2.payload(blocks, { ephemeral: true, ...opts }),
    });
  }

  async _replyFresh(interaction, blocks, opts = {}) {
    return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: 'POST',
      body: { type: 4, data: CV2.payload(blocks, { ephemeral: true, ...opts }) },
    });
  }

  async _sendLogChannel(guildId, cfg, { title, description, color = ACCENT } = {}) {
    const channelId = cfg?.reception?.logChannelId;
    if (!channelId) return;
    if (!(await this.premium.hasSubscription(guildId))) return;

    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: { embeds: [{ title, description, color }], allowed_mentions: { parse: [] } },
    }).catch(err => {
      console.warn('[House/Reception] Falha ao enviar log para o canal configurado:', err?.message);
    });
  }

  _retryButton(userId, guildId, ctx) {
    return this.client.interactions.createButton({
      user: userId,
      data: { label: this.client.t('house.retry_button', ctx ?? localeCtx({})), style: 2 },
      funcao: async (i, client) => {
        await client.interactions.defer(i);
        return this.renderStep(i, guildId, userId);
      },
    });
  }

  async handleMemberJoin(data) {
    const guildId = data.guild_id;
    const user    = data.user;
    if (!guildId || !user?.id) return;

    const cfg = await this.config.get(guildId);
    if (!cfg?.enabled) return;

    await this._applyUnregisteredRole(guildId, cfg, user.id);

    await this.history.log(guildId, {
      action: 'membro_entrou', userId: user.id, detail: this.client.t('house.detail_reception_auto_started', {}),
    });

    await this._sendLogChannel(guildId, cfg, {
      title: this.client.t('house.log_new_member_title', {}),
      description: this.client.t('house.log_new_member_desc', { userId: user.id }),
    });

    await this.sendWelcomeMessage(guildId, cfg, user.id);
  }

  async _applyUnregisteredRole(guildId, cfg, userId) {
    if (!cfg.reception.unregisteredRoleId) return;
    const check = await this.roles.validateRole(guildId, cfg.reception.unregisteredRoleId);
    if (check.ok) {
      await this.roles.addRole(guildId, userId, cfg.reception.unregisteredRoleId).catch(() => {});
    }
  }

  async sendWelcomeMessage(guildId, cfg, userId) {
    if (!cfg.reception.channelId) return;

    const msg = cfg.reception.welcomeMessage || {};
    const startBtn = this.client.interactions.createButton({
      user: userId,
      data: { label: this.client.t('house.start_reception_button', {}), style: 3 },
      funcao: async (i) => this.startFlow(i, guildId, userId),
    });

    const mention = (text) => (text || '').replaceAll('{user}', `<@${userId}>`);

    const body = {
      content: mention(msg.content) || this.client.t('house.welcome_default_content', { userId }),
      components: [{ type: 1, components: [startBtn] }],
    };

    if (msg.type === 'embed' && msg.embed) {
      const embed = JSON.parse(JSON.stringify(msg.embed));
      if (embed.description) embed.description = mention(embed.description);
      if (embed.title) embed.title = mention(embed.title);
      body.embeds = [embed];
    }

    return DiscordRequest(`/channels/${cfg.reception.channelId}/messages`, {
      method: 'POST', body,
    }).catch(err => {
      console.error('[House/Reception] erro ao enviar mensagem inicial:', err?.message);
      throw err;
    });
  }

  async sendFinalMessage(guildId, cfg, userId, vars = {}) {
    const channelId = cfg?.reception?.channelId;
    if (!channelId) return;

    const msg = cfg?.reception?.finalMessage || {};
    const hasContent = !!msg.content;
    const hasEmbed   = msg.type === 'embed' && !!msg.embed;
    if (!hasContent && !hasEmbed) return;

    const mention = (text) => (text || '')
      .replaceAll('{user}', `<@${userId}>`)
      .replaceAll('{character}', vars.character ?? '');

    const body = {};
    if (hasContent) body.content = mention(msg.content);

    if (hasEmbed) {
      const embed = JSON.parse(JSON.stringify(msg.embed));
      if (embed.description) embed.description = mention(embed.description);
      if (embed.title) embed.title = mention(embed.title);
      body.embeds = [embed];
    }

    return DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST', body,
    });
  }

  async runTest(interaction, guildId, userId) {
    const cfg = await this.config.get(guildId);

    if (!cfg?.enabled) {
      return { ok: false, reasonKey: 'house.test_module_disabled' };
    }

    if (!cfg.reception.channelId) {
      return { ok: false, reasonKey: 'house.test_channel_not_configured' };
    }

    await this._applyUnregisteredRole(guildId, cfg, userId);

    try {
      await this.sendWelcomeMessage(guildId, cfg, userId);
    } catch {
      return { ok: false, reasonKey: 'house.test_send_failed' };
    }

    await this.history.log(guildId, {
      action: 'recepcao_teste_executado', staffId: userId,
      detail: this.client.t('house.detail_test_triggered', { channelId: cfg.reception.channelId }),
    });

    return { ok: true, channelId: cfg.reception.channelId };
  }

  async _effectiveSteps(guildId, userId, cfg, state, ctx = {}) {
    const steps = [];
    const t = (key, extra) => this.client.t(key, { ...ctx, ...extra });

    const charSel = cfg.reception.characterSelection;
    if (charSel?.enabled) {
      const available = await this.characters.listAvailable(guildId);
      if (available.length > 0) {
        steps.push({
          id: '__character_select',
          name: charSel.stepName || t('house.default_character_step_name'),
          description: charSel.description || null,
          type: 'select',
          required: charSel.required ?? true,
          isCharacter: true,
          options: available.map(c => ({
            label: c.name.slice(0, 100),
            value: String(c._id),
            description: c.description ? c.description.slice(0, 90) : undefined,
          })),
        });
      } else {

        steps.push({
          id: '__character_select',
          name: charSel.stepName || t('house.default_character_step_name'),
          description: charSel.description || t('house.default_character_step_desc_no_chars'),
          type: 'texto',
          required: charSel.required ?? true,
          isCharacter: true,
          freeText: true,
          options: [],
        });
      }
    }

    if (cfg.decoration?.enabled && (await this.premium.hasSubscription(guildId))) {
      const formats = cfg.decoration.formats?.length
        ? cfg.decoration.formats
        : (cfg.decoration.format ? [cfg.decoration.format] : []);

      if (formats.length) {
        const character      = await this.characters.findByUser(guildId, userId);
        const freeName        = state?.answers?.__character_select;
        const characterName  = character?.name || (typeof freeName === 'string' ? freeName : '') || t('house.character_fallback_name');

        const emojiOn = !!cfg.decoration.emojiEnabled;

        steps.push({
          id: '__decoration_select',
          name: t('house.decoration_step_name'),
          description: t('house.decoration_step_description'),
          type: 'select',
          required: true,
          isDecoration: true,
          options: [
            ...formats.map((f, idx) => ({

              label: this.decoration.build(f, { name: characterName, character: characterName, emoji: emojiOn ? '🔸' : '' }).slice(0, 100),
              value: `fmt_${idx}`,
            })),
            { label: t('house.decoration_no_option_label', { characterName }).slice(0, 100), value: '__none' },
          ],
        });

        if (emojiOn) {
          const chosenFormat = state?.answers?.__decoration_select;
          if (chosenFormat && typeof chosenFormat === 'string' && chosenFormat.includes('{emoji}')) {
            steps.push({
              id: '__emoji_select',
              name: t('house.emoji_step_name'),
              description: t('house.emoji_step_description'),
              type: 'texto',
              required: true,
              isEmoji: true,
              options: [],
            });
          }
        }
      }
    }

    return steps;
  }

  async startFlow(interaction, guildId, userId) {
    const ctx = localeCtx(interaction);
    if (interaction.guild_id !== guildId || interaction.member?.user?.id !== userId) {
      return this._replyFresh(interaction, [CV2.container([
        CV2.text(this.client.t('house.not_your_reception', ctx)),
      ], { accentColor: 0xED4245 })]);
    }

    await HouseReception.findOneAndUpdate(
      { guildId, userId },
      { currentIndex: 0, answers: {}, status: 'em_andamento', startedAt: new Date(), finishedAt: null },
      { upsert: true },
    );

    return this.renderStep(interaction, guildId, userId, { fresh: true });
  }

  async renderStep(interaction, guildId, userId, opts = {}) {
    const ctx   = localeCtx(interaction);
    const t     = (key, extra) => this.client.t(key, { ...ctx, ...extra });
    const cfg   = await this.config.get(guildId);
    const state = await HouseReception.findOne({ guildId, userId });
    const steps = await this._effectiveSteps(guildId, userId, cfg, state, ctx);

    if (!state || state.currentIndex >= steps.length) {
      return this.finalize(interaction, guildId, userId);
    }

    const step  = steps[state.currentIndex];
    const total = steps.length;
    const index = state.currentIndex + 1;

    const blocks = [
      CV2.text(`**[${index}/${total}] ${step.name}**`),
    ];
    if (step.description) blocks.push(CV2.text(step.description));

    if (step.type === 'select') {
      const component = this.client.interactions.createSelect({
        user: userId,
        data: {
          placeholder: t('house.select_placeholder'),
          options: step.options.map(o => ({ label: o.label, value: o.value, description: o.description ?? undefined })),
        },
        funcao: async (i, client) => {
          await client.interactions.defer(i);
          return this._advance(i, guildId, userId, step, i.data.values?.[0]);
        },
      });
      blocks.push(CV2.row(component));

    } else if (step.type === 'button') {
      const buttons = step.options.map(o => this.client.interactions.createButton({
        user: userId,
        data: { label: o.label, style: 2 },
        funcao: async (i, client) => {
          await client.interactions.defer(i);
          return this._advance(i, guildId, userId, step, o.value);
        },
      }));
      blocks.push(CV2.row(...buttons.slice(0, 5)));

    } else if (step.type === 'modal') {
      const modalBtn = this.client.interactions.createButton({
        user: userId,
        data: { label: t('house.modal_answer_button'), style: 3 },
        funcao: async (i, client) => {
          const modal = client.interactions.createModal({
            user: userId,
            title: step.name.slice(0, 45),
            components: [{
              type: 1,
              components: [{
                type: 4, custom_id: 'resposta', style: 2,
                label: this.client.t('house.modal_your_answer_label', localeCtx(i)), required: step.required ?? true, max_length: 1000,
              }],
            }],
            funcao: async (modalInt, modalClient, fields) => {
              const resposta = fields?.resposta ?? '';
              await modalClient.interactions.defer(modalInt);
              return this._advance(modalInt, guildId, userId, step, resposta);
            },
          });
          return client.interactions.showModal(i, modal);
        },
      });
      blocks.push(CV2.row(modalBtn));

    } else {

      blocks.push(CV2.text(t('house.free_text_note')));
    }

    const container = CV2.container(blocks, { accentColor: ACCENT });

    if (opts.fresh) {

      await this._replyFresh(interaction, [container], { ephemeral: false });
    } else {
      await this._editOriginal(interaction, [container]);
    }

    if (step.type === 'texto') {
      const token     = interaction.token;
      const channelId = interaction.channel_id;
      this._awaitFreeText(token, channelId, guildId, userId, step, ctx).catch(err => {
        console.error('[House/Reception] erro no coletor de texto livre:', err);
      });
    }
  }

  async _awaitFreeText(token, channelId, guildId, userId, step, ctx = {}) {
    try {
      const msg = await this.client.NextMessageCollector.wait({
        channelId, userId, time: 300_000, keepMessage: true,
      });
      return this._advance({ token, channel_id: channelId }, guildId, userId, step, (msg.content || '').trim());
    } catch {
      return this._editOriginal({ token }, [CV2.container([
        CV2.text(this.client.t('house.timeout_title', ctx)),
        CV2.text(this.client.t('house.timeout_desc', ctx)),
        CV2.separator(),
        CV2.row(this._retryButton(userId, guildId, ctx)),
      ], { accentColor: 0xED4245 })]);
    }
  }

  async _advance(interaction, guildId, userId, step, value) {
    const ctx = localeCtx(interaction);
    const state = await HouseReception.findOne({ guildId, userId });
    if (!state) return;

    if (step.isCharacter && value && !step.freeText) {
      await this._editOriginal(interaction, [CV2.container([
        CV2.text(this.client.t('house.checking_availability', ctx)),
      ], { accentColor: ACCENT })]);

      const result = await this.characters.assign(guildId, value, userId);
      if (!result.ok) {
        return this._editOriginal(interaction, [CV2.container([
          CV2.text(this.client.t('house.generic_error_title', ctx)),
          CV2.text(this.client.t('house.character_unavailable', ctx)),
          CV2.separator(),
          CV2.row(this._retryButton(userId, guildId, ctx)),
        ], { accentColor: 0xED4245 })]);
      }
    }

    if (step.isEmoji) {
      const clean = typeof value === 'string' ? value.trim() : '';
      if (!this.decoration.isValidEmoji(clean)) {
        return this._editOriginal(interaction, [CV2.container([
          CV2.text(this.client.t('house.generic_error_title', ctx)),
          CV2.text(this.client.t('house.invalid_emoji', ctx)),
          CV2.separator(),
          CV2.row(this._retryButton(userId, guildId, ctx)),
        ], { accentColor: 0xED4245 })]);
      }
      value = clean;
    }

    if (step.isDecoration) {

      if (value && value !== '__none' && value.startsWith('fmt_')) {
        const cfg     = await this.config.get(guildId);
        const formats = cfg.decoration.formats?.length
          ? cfg.decoration.formats
          : (cfg.decoration.format ? [cfg.decoration.format] : []);
        const idx = parseInt(value.slice(4), 10);
        value = formats[idx] ?? null;
      } else {
        value = null;
      }
    }

    state.answers = { ...state.answers, [step.id]: value };
    state.currentIndex += 1;
    await state.save();

    return this.renderStep(interaction, guildId, userId);
  }

  async finalize(interaction, guildId, userId) {
    const ctx   = localeCtx(interaction);
    const cfg   = await this.config.get(guildId);
    const state = await HouseReception.findOne({ guildId, userId });

    const swap = await this.roles.swapRoles(guildId, userId, {
      removeRoleId: cfg?.reception?.unregisteredRoleId,
      addRoleId:    cfg?.reception?.registeredRoleId,
    });

    const character      = await this.characters.findByUser(guildId, userId);
    const freeName        = state?.answers?.__character_select;
    const characterName  = character?.name || (typeof freeName === 'string' ? freeName : '');

    if (characterName) {

      if (cfg?.decoration?.enabled && (await this.premium.hasSubscription(guildId))) {

        const chosenFormat = state?.answers?.__decoration_select;
        const emoji         = state?.answers?.__emoji_select || '';
        const nickname = chosenFormat
          ? this.decoration.build(chosenFormat, { name: characterName, user: userId, character: characterName, emoji })
          : characterName;

        await this.decoration.applyNickname(guildId, userId, nickname);
      } else {

        await this.decoration.applyNickname(guildId, userId, characterName);
      }
    }

    await this.sendFinalMessage(guildId, cfg, userId, { character: characterName }).catch(err => {
      console.warn('[House/Reception] Falha ao enviar mensagem final:', err?.message);
    });

    await HouseReception.findOneAndUpdate(
      { guildId, userId },
      { status: 'concluido', finishedAt: new Date() },
    );

    await this.history.log(guildId, {
      action: 'recepcao_concluida', userId,
      detail: swap.ok ? this.client.t('house.detail_roles_applied_ok', {}) : this.client.t('house.detail_roles_applied_fail', { reason: swap.reason }),
      result: swap.ok ? 'sucesso' : 'falha',
    });

    await this._sendLogChannel(guildId, cfg, {
      title: swap.ok ? this.client.t('house.log_reception_ok_title', {}) : this.client.t('house.log_reception_fail_title', {}),
      description: swap.ok
        ? this.client.t('house.log_reception_desc_ok', { userId })
        : this.client.t('house.log_reception_desc_fail', { userId, reason: swap.reason }),
      color: swap.ok ? 0x57F287 : 0xED4245,
    });

    return this._editOriginal(interaction, [CV2.container([
      CV2.text(this.client.t('house.final_title', ctx)),
      CV2.text(this.client.t('house.final_subtitle', ctx)),
    ], { accentColor: 0x57F287 })]);
  }
}

module.exports = ReceptionService;
