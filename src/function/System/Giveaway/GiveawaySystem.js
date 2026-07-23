'use strict';

const DiscordRequest  = require('../../DiscordRequest.js');
const GiveawayDb      = require('../../../Mongodb/giveaway.js');
const AuthorizationDb = require('../../../Mongodb/giveawayAuthorization.js');
const GiveawayDraw    = require('./Utils/GiveawayDraw.js');
const GiveawayEmbed   = require('./Utils/GiveawayEmbed.js');
const GiveawayExport  = require('./Utils/GiveawayExport.js');
const PremiumManager  = require('../../Utils/PremiumManager.js');
const { isPlanAtLeast, PLAN_KEYS } = require('../../Utils/PremiumPlans.js');
const TaskDb          = require('../../../Mongodb/tarefas.js');
const { localeCtx }   = require('../../Utils/ctxLocale.js');

const E = Object.freeze({
  feliz:    '<:ayamifeliz:1513904597649981561>',
  animada:  '<:ayamianimada:1513895694824378408>',
  festa:    '<:ayamifesta:1513895771676737746>',
  pensando: '<:ayamipensando:1513891183036989533>',
});

const DEFAULT_COLOR = 0xFFB7C5;
const TIMEOUT_MS    = 120_000;

class GiveawaySystem {

  constructor(client) {
    this.client  = client;
    this._drafts = new Map();
  }

  t(interaction, key, extra = {}) {
    return this.client.t(`sorteio.${key}`, localeCtx(interaction, extra));
  }


  async reply(interaction, data) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 4, data } }
    );
  }

  async deferUpdate(interaction) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: 'POST', body: { type: 6 } }
    );
  }

  async editOriginal(interaction, data) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: 'PATCH', body: data }
    );
  }

  async followUpEphemeral(interaction, data) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}`,
      { method: 'POST', body: { ...data, flags: 64 } }
    );
  }

  async deleteFollowUp(interaction, messageId) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/${messageId}`,
      { method: 'DELETE' }
    ).catch(() => {});
  }

  async deleteMsg(channelId, messageId) {
    return DiscordRequest(
      `/channels/${channelId}/messages/${messageId}`,
      { method: 'DELETE' }
    ).catch(() => {});
  }

  btn(user, label, style, func) {
    return this.client.interactions.createButton({ user, data: { label, style }, funcao: func });
  }

  select(user, options, placeholder, func) {
    return this.client.interactions.createSelect({ user, data: { placeholder, options }, funcao: func });
  }

  row(...components) {
    return { type: 1, components };
  }


  async _ask(interaction, draft, questionEmbed) {

    await this.editOriginal(interaction, {
      embeds: [{
        ...this._embedDraft(draft, interaction),
        footer: { text: this.t(interaction, 'engine_wait_footer') },
      }],
      components: [],
    });

    const prompt = await this.followUpEphemeral(interaction, {
      embeds: [{
        description: questionEmbed,
        color: DEFAULT_COLOR,
        footer: { text: this.t(interaction, 'engine_ask_footer') }
      }]
    });

    try {
      const msg = await this.client.NextMessageCollector.wait({
        channelId: interaction.channel_id,
        userId:    interaction.member?.user?.id || interaction.user?.id,
        timeout:   TIMEOUT_MS,
      });

      if (prompt?.id) this.deleteFollowUp(interaction, prompt.id);
      this.deleteMsg(interaction.channel_id, msg.id);

      if (msg.content?.toLowerCase() === 'cancelar') return null;
      return msg.content;

    } catch {
      if (prompt?.id) this.deleteFollowUp(interaction, prompt.id);
      return null;
    }
  }


  _getDraft(userId) {
    if (!this._drafts.has(userId)) {
      this._drafts.set(userId, {
        prize: null, description: '',
        channelId: null, winners: 1,
        duration: null, endsAt: null,
        color: DEFAULT_COLOR,
        thumbnail: null, banner: null, customMessage: null,
        bonusEntries: [], requirements: [],
        isMultiServer: false, multiMode: 'global', multiServers: [],
      });
    }
    return this._drafts.get(userId);
  }

  _clearDraft(userId) { this._drafts.delete(userId); }

  async _syncEndTask(doc) {
    try {
      await TaskDb.findOneAndUpdate(
        { tipo: 'giveaway_end', 'dados.giveawayId': doc.giveawayId },
        {
          $setOnInsert: { taskId: `giveaway_end_${doc.giveawayId}` },
          $set: { executeAt: doc.endsAt, status: 'pending', dados: { giveawayId: doc.giveawayId } }
        },
        { upsert: true }
      );
    } catch (err) {
      console.error('[GiveawaySystem] _syncEndTask error:', err);
    }
  }

  async _cancelEndTask(giveawayId) {
    try {
      await TaskDb.updateOne(
        { tipo: 'giveaway_end', 'dados.giveawayId': giveawayId, status: 'pending' },
        { $set: { status: 'cancelled' } }
      );
    } catch (err) {
      console.error('[GiveawaySystem] _cancelEndTask error:', err);
    }
  }

  async isPremium(guildId) {
    const p = await PremiumManager.getGuildPremium(guildId);
    if (!p.status) return false;
    return isPlanAtLeast(p.planId, PLAN_KEYS.LUA_CRESCENTE);
  }

  async save(doc) { await doc.save(); }
  _genId() { return 'giveaway_' + Date.now(); }

  _embedDraft(draft, interaction) {
    const endsTs = draft.endsAt ? Math.floor(new Date(draft.endsAt).getTime() / 1000) : null;
    const L = (key) => this.t(interaction, key);
    return {
      title: `${E.animada} ${this.t(interaction, 'engine_draft_title')}`,
      description: [
        `**${L('engine_draft_prize_label')}:** ${draft.prize || '—'}`,
        `**${L('engine_draft_desc_label')}:** ${draft.description || '—'}`,
        `**${L('engine_draft_channel_label')}:** ${draft.channelId ? `<#${draft.channelId}>` : '—'}`,
        `**${L('engine_draft_winners_label')}:** ${draft.winners}`,
        `**${L('engine_draft_ends_label')}:** ${endsTs ? `<t:${endsTs}:R>` : '—'}`,
        `**${L('engine_draft_bonus_label')}:** ${draft.bonusEntries.length}`,
        `**${L('engine_draft_reqs_label')}:** ${draft.requirements.length}`,
        `**${L('engine_draft_multi_label')}:** ${draft.isMultiServer ? '✅' : '❌'}`,
      ].join('\n'),
      color: draft.color,
      thumbnail: draft.thumbnail ? { url: draft.thumbnail } : undefined,
      image:     draft.banner    ? { url: draft.banner }    : undefined,
    };
  }


  async startMenu(interaction) {

    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;

    const actives = await GiveawayDb.find({
      guildId, status: { $in: ['active', 'paused'] }
    }).lean();

    const selectOptions = actives.length
      ? actives.map(g => ({
          label:       g.prize.slice(0, 80),
          value:       g.giveawayId,
          description: this.t(interaction, 'engine_menu_option_participants', { count: g.participants.length }),
        }))
      : [{ label: this.t(interaction, 'engine_menu_none_option'), value: 'none' }];

    const selectSorteio = this.select(
      user, selectOptions, this.t(interaction, 'engine_menu_select_placeholder'),
      async (i) => {
        await this.deferUpdate(i);
        if (!actives.length) return;
        const doc = await GiveawayDb.findOne({ giveawayId: i.data.values[0] });
        return this.giveawayMenu(i, doc, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} ${this.t(interaction, 'engine_menu_title')}`,
        description: this.t(interaction, 'engine_menu_desc', { count: actives.length }),
        color: DEFAULT_COLOR,
      }],
      components: actives.length ? [this.row(selectSorteio)] : [],
    });
  }


  async criar(interaction) {

    const user = interaction.member.user.id;
    this._clearDraft(user);

    const modal = this.client.interactions.createModal({
      user,
      title: this.t(interaction, 'engine_modal_title'),
      components: [
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'prize',
            label: this.t(interaction, 'engine_modal_prize_label'),
            style: 1, required: true, max_length: 200,
            placeholder: this.t(interaction, 'engine_modal_prize_placeholder'),
          }]
        },
        {
          type: 1,
          components: [{
            type: 4, custom_id: 'description',
            label: this.t(interaction, 'engine_modal_desc_label'),
            style: 2, required: false, max_length: 1000,
            placeholder: this.t(interaction, 'engine_modal_desc_placeholder'),
          }]
        },
      ],
      funcao: async (mi, _client, fields) => {

        const draft       = this._getDraft(user);
        draft.prize       = fields.prize.trim();
        draft.description = fields.description?.trim() || '';

        await DiscordRequest(
          `/interactions/${mi.id}/${mi.token}/callback`,
          {
            method: 'POST',
            body: {
              type: 4,
              data: {
                embeds: [this._embedDraft(draft, mi)],
                components: [],
              //  flags: 64,
              }
            }
          }
        );

        return this._criarStep_Canal(mi, user);
      },
    });

    return this.client.interactions.showModal(interaction, modal);
  }


  async _criarStep_Canal(interaction, user) {

    const draft = this._getDraft(user);

    const resp = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_step_channel')}`
    );

    if (resp === null) {
      this._clearDraft(user);
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_creation_cancelled')}`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    const id = resp.match(/\d{17,19}/)?.[0];
    if (!id) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_channel_invalid')}`, color: DEFAULT_COLOR }]
      });
      return this._criarStep_Canal(interaction, user);
    }

    draft.channelId = id;
    return this._criarStep_Vencedores(interaction, user);
  }


  async _criarStep_Vencedores(interaction, user) {

    const draft = this._getDraft(user);

    const resp = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_step_winners')}`
    );

    if (resp === null) {
      this._clearDraft(user);
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_creation_cancelled')}`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    const n = parseInt(resp);
    if (!n || n < 1 || n > 100) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_winners_invalid')}`, color: DEFAULT_COLOR }]
      });
      return this._criarStep_Vencedores(interaction, user);
    }

    draft.winners = n;
    return this._criarStep_Duracao(interaction, user);
  }


  async _criarStep_Duracao(interaction, user) {

    const draft = this._getDraft(user);

    const resp = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_step_duration')}`
    );

    if (resp === null) {
      this._clearDraft(user);
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_creation_cancelled')}`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    const ms = this._parseDuration(resp);
    if (!ms) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_duration_invalid')}`, color: DEFAULT_COLOR }]
      });
      return this._criarStep_Duracao(interaction, user);
    }

    draft.duration = ms;
    draft.endsAt   = new Date(Date.now() + ms);

    return this._telaExtras(interaction, user);
  }


  async _telaExtras(interaction, user) {

    const draft   = this._getDraft(user);
    const premium = await this.isPremium(interaction.guild_id);

    const select = this.select(
      user,
      [
        { label: this.t(interaction, 'engine_extras_opt_bonus'),   value: 'bonus'   },
        { label: this.t(interaction, 'engine_extras_opt_reqs'),    value: 'reqs'    },
        { label: this.t(interaction, 'engine_extras_opt_visual'),  value: 'visual'  },
        { label: premium ? this.t(interaction, 'engine_extras_opt_multi') : this.t(interaction, 'engine_extras_opt_multi_locked'), value: 'multi' },
        { label: this.t(interaction, 'engine_extras_opt_msg'),     value: 'msg'     },
        { label: this.t(interaction, 'engine_extras_opt_publish'), value: 'publish' },
      ],
      this.t(interaction, 'engine_extras_placeholder'),
      async (i) => {
        await this.deferUpdate(i);
        const v = i.data.values[0];
        if (v === 'bonus')   return this._telaBonus(i, user);
        if (v === 'reqs')    return this._telaReqs(i, user, premium);
        if (v === 'visual')  return this._telaVisual(i, user);
        if (v === 'multi')   return this._telaMulti(i, user, premium);
        if (v === 'msg')     return this._telaMsg(i, user);
        if (v === 'publish') return this._publicar(i, user);
      }
    );

    return this.editOriginal(interaction, {
      embeds: [{
        ...this._embedDraft(draft, interaction),
        footer: { text: this.t(interaction, 'engine_extras_footer') }
      }],
      components: [this.row(select)],
    });
  }



  async _telaBonus(interaction, user) {

    const draft = this._getDraft(user);
    const atual = draft.bonusEntries.length
      ? draft.bonusEntries.map(b => this.t(interaction, 'engine_bonus_line', { mention: `<@&${b.roleId}>`, entries: b.entries })).join('\n')
      : this.t(interaction, 'engine_bonus_none');

    const btnAdd = this.btn(user, this.t(interaction, 'engine_btn_add'), 3, async (i) => {
      await this.deferUpdate(i);
      return this._bonusAdd(i, user);
    });
    const btnDel = this.btn(user, this.t(interaction, 'engine_btn_del_last'), 4, async (i) => {
      await this.deferUpdate(i);
      draft.bonusEntries.pop();
      return this._telaBonus(i, user);
    });
    const btnVoltar = this.btn(user, this.t(interaction, 'engine_btn_back'), 2, async (i) => {
      await this.deferUpdate(i);
      return this._telaExtras(i, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} ${this.t(interaction, 'engine_bonus_title')}`,
        description: this.t(interaction, 'engine_bonus_desc', { atual }),
        color: DEFAULT_COLOR,
      }],
      components: [this.row(btnAdd, btnDel, btnVoltar)],
    });
  }

  async _bonusAdd(interaction, user) {

    const draft = this._getDraft(user);

    const respRole = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_bonus_ask_role')}`
    );
    if (!respRole) return this._telaBonus(interaction, user);

    const roleId = respRole.match(/\d{17,19}/)?.[0];
    if (!roleId) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_role_invalid')}`, color: DEFAULT_COLOR }]
      });
      return this._telaBonus(interaction, user);
    }

    const respQtd = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_bonus_ask_qty', { mention: `<@&${roleId}>` })}`
    );
    if (!respQtd) return this._telaBonus(interaction, user);

    const entries = parseInt(respQtd);
    if (!entries || entries < 1) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_number_invalid')}`, color: DEFAULT_COLOR }]
      });
      return this._telaBonus(interaction, user);
    }

    draft.bonusEntries.push({ roleId, entries, label: '' });
    return this._telaBonus(interaction, user);
  }


  async _telaReqs(interaction, user, premium) {

    const draft = this._getDraft(user);
    const atual = draft.requirements.length
      ? draft.requirements.map((r, i) => `\`${i + 1}.\` ${this._reqLabel(r, interaction)}`).join('\n')
      : this.t(interaction, 'engine_reqs_none');

    const options = [
      { label: this.t(interaction, 'engine_reqs_opt_required_role'),      value: 'REQUIRED_ROLE' },
      { label: this.t(interaction, 'engine_reqs_opt_forbidden_role'),     value: 'FORBIDDEN_ROLE' },
      { label: this.t(interaction, 'engine_reqs_opt_min_messages'),       value: 'MIN_MESSAGES' },
      { label: this.t(interaction, 'engine_reqs_opt_min_days_server'),    value: 'MIN_DAYS_IN_SERVER' },
      { label: this.t(interaction, 'engine_reqs_opt_min_account_age'),    value: 'MIN_ACCOUNT_AGE' },
      { label: this.t(interaction, 'engine_reqs_opt_in_server'),          value: 'IN_SERVER' },
      ...(premium ? [
        { label: this.t(interaction, 'engine_reqs_opt_required_role_ext'),  value: 'REQUIRED_ROLE_IN_SERVER' },
        { label: this.t(interaction, 'engine_reqs_opt_forbidden_role_ext'), value: 'FORBIDDEN_ROLE_IN_SERVER' },
        { label: this.t(interaction, 'engine_reqs_opt_min_days_ext'),       value: 'MIN_DAYS_IN_EXT_SERVER' },
        { label: this.t(interaction, 'engine_reqs_opt_min_msgs_ext'),       value: 'MIN_MESSAGES_IN_EXT_SERVER' },
        { label: this.t(interaction, 'engine_reqs_opt_min_hours_call'),     value: 'MIN_HOURS_IN_CALL' },
        { label: this.t(interaction, 'engine_reqs_opt_min_level'),          value: 'MIN_LEVEL' },
        { label: this.t(interaction, 'engine_reqs_opt_min_xp'),             value: 'MIN_XP' },
        { label: this.t(interaction, 'engine_reqs_opt_booster'),            value: 'HAS_BOOSTER_ROLE' },
        { label: this.t(interaction, 'engine_reqs_opt_supporter'),          value: 'HAS_SUPPORTER_ROLE' },
      ] : []),
    ];

    const selectReq = this.select(user, options, this.t(interaction, 'engine_reqs_select_placeholder'), async (i) => {
      await this.deferUpdate(i);
      return this._reqAdd(i, user, i.data.values[0], premium);
    });

    const btnDel = this.btn(user, this.t(interaction, 'engine_btn_del_last'), 4, async (i) => {
      await this.deferUpdate(i);
      draft.requirements.pop();
      return this._telaReqs(i, user, premium);
    });
    const btnVoltar = this.btn(user, this.t(interaction, 'engine_btn_back'), 2, async (i) => {
      await this.deferUpdate(i);
      return this._telaExtras(i, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} ${this.t(interaction, 'engine_reqs_title')}`,
        description: this.t(interaction, 'engine_reqs_desc', { atual }),
        color: DEFAULT_COLOR,
      }],
      components: [this.row(selectReq), this.row(btnDel, btnVoltar)],
    });
  }

  async _reqAdd(interaction, user, type, premium) {

    const draft = this._getDraft(user);

    const premiumTypes = [
      'REQUIRED_ROLE_IN_SERVER', 'FORBIDDEN_ROLE_IN_SERVER',
      'MIN_DAYS_IN_EXT_SERVER', 'MIN_MESSAGES_IN_EXT_SERVER',
      'MIN_HOURS_IN_CALL', 'MIN_LEVEL', 'MIN_XP',
      'HAS_BOOSTER_ROLE', 'HAS_SUPPORTER_ROLE',
    ];

    if (premiumTypes.includes(type) && !premium) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: this.t(interaction, 'engine_reqs_premium_only'), color: DEFAULT_COLOR }]
      });
      return this._telaReqs(interaction, user, premium);
    }

    const externalTypes = [
      'IN_SERVER', 'REQUIRED_ROLE_IN_SERVER', 'FORBIDDEN_ROLE_IN_SERVER',
      'MIN_DAYS_IN_EXT_SERVER', 'MIN_MESSAGES_IN_EXT_SERVER',
      'HAS_BOOSTER_ROLE', 'HAS_SUPPORTER_ROLE',
    ];

    let guildId = null;

    if (externalTypes.includes(type)) {

      const resp = await this._ask(interaction, draft,
        `${E.animada} ${this.t(interaction, 'engine_ask_ext_guild')}`
      );
      if (!resp) return this._telaReqs(interaction, user, premium);

      guildId = resp.match(/\d{17,19}/)?.[0];
      if (!guildId) {
        await this.followUpEphemeral(interaction, {
          embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_id_invalid')}`, color: DEFAULT_COLOR }]
        });
        return this._telaReqs(interaction, user, premium);
      }

      const inServer = await this._checkBotInGuild(guildId);
      if (!inServer) {
        await this.followUpEphemeral(interaction, {
          embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_not_in_server', { guildId })}`, color: DEFAULT_COLOR }]
        });
        return this._telaReqs(interaction, user, premium);
      }

      const level      = type === 'IN_SERVER' ? 'basic' : 'advanced';
      const authorized = await this._checkAuthorization(guildId, interaction.guild_id, level);

      if (!authorized) {
        await this._requestAuthorization(interaction, guildId, interaction.guild_id, level);
        return this._telaReqs(interaction, user, premium);
      }
    }

    const needsValue = {
      REQUIRED_ROLE:              this.t(interaction, 'engine_req_val_required_role'),
      FORBIDDEN_ROLE:             this.t(interaction, 'engine_req_val_forbidden_role'),
      MIN_MESSAGES:               this.t(interaction, 'engine_req_val_min_messages'),
      MIN_DAYS_IN_SERVER:         this.t(interaction, 'engine_req_val_min_days_server'),
      MIN_ACCOUNT_AGE:            this.t(interaction, 'engine_req_val_min_account_age'),
      REQUIRED_ROLE_IN_SERVER:    this.t(interaction, 'engine_req_val_required_role_ext'),
      FORBIDDEN_ROLE_IN_SERVER:   this.t(interaction, 'engine_req_val_forbidden_role_ext'),
      MIN_DAYS_IN_EXT_SERVER:     this.t(interaction, 'engine_req_val_min_days_ext'),
      MIN_MESSAGES_IN_EXT_SERVER: this.t(interaction, 'engine_req_val_min_msgs_ext'),
      MIN_HOURS_IN_CALL:          this.t(interaction, 'engine_req_val_min_hours_call'),
      MIN_LEVEL:                  this.t(interaction, 'engine_req_val_min_level'),
      MIN_XP:                     this.t(interaction, 'engine_req_val_min_xp'),
    };

    let value = null;

    if (needsValue[type]) {
      const resp = await this._ask(interaction, draft,
        `${E.animada} ${needsValue[type]}`
      );
      if (!resp) return this._telaReqs(interaction, user, premium);

      const isRole = type.includes('ROLE');
      value = isRole ? (resp.match(/\d{17,19}/)?.[0] || null) : resp.trim();

      if (!value) {
        await this.followUpEphemeral(interaction, {
          embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_value_invalid')}`, color: DEFAULT_COLOR }]
        });
        return this._telaReqs(interaction, user, premium);
      }
    }

    draft.requirements.push({ type, value, guildId });
    return this._telaReqs(interaction, user, premium);
  }


  async _telaVisual(interaction, user) {

    const draft = this._getDraft(user);

    const respCor = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_visual_title_color')}`
    );
    if (respCor && respCor.toLowerCase() !== 'pular') {
      const parsed = parseInt(respCor.trim().replace('#', ''), 16);
      if (!isNaN(parsed)) draft.color = parsed;
    }

    const respThumb = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_visual_title_thumb')}`
    );
    if (respThumb && respThumb.toLowerCase() !== 'pular' && respThumb.startsWith('http')) {
      draft.thumbnail = respThumb.trim();
    }

    const respBanner = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_visual_title_banner')}`
    );
    if (respBanner && respBanner.toLowerCase() !== 'pular' && respBanner.startsWith('http')) {
      draft.banner = respBanner.trim();
    }

    return this._telaExtras(interaction, user);
  }


  async _telaMsg(interaction, user) {

    const draft = this._getDraft(user);

    const resp = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_custom_msg_ask')}`
    );
    if (resp && resp.toLowerCase() !== 'pular') {
      draft.customMessage = resp.slice(0, 500);
    }

    return this._telaExtras(interaction, user);
  }


  async _telaMulti(interaction, user, premium) {

    if (!premium) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: this.t(interaction, 'engine_multi_premium_only'), color: DEFAULT_COLOR }]
      });
      return this._telaExtras(interaction, user);
    }

    const draft = this._getDraft(user);
    const atual = draft.multiServers.length
      ? draft.multiServers.map(s =>
          this.t(interaction, 'engine_multi_server_line', {
            guildId: s.guildId, channelId: s.channelId,
            winners: s.winners || this.t(interaction, 'engine_multi_global_word'),
          })
        ).join('\n')
      : this.t(interaction, 'engine_multi_none');

    const selectModo = this.select(user, [
      { label: this.t(interaction, 'engine_multi_opt_global'),   value: 'global'   },
      { label: this.t(interaction, 'engine_multi_opt_separate'), value: 'separate' },
    ], this.t(interaction, 'engine_multi_mode_placeholder'), async (i) => {
      await this.deferUpdate(i);
      draft.isMultiServer = true;
      draft.multiMode     = i.data.values[0];
      return this._telaMulti(i, user, premium);
    });

    const btnAdd = this.btn(user, this.t(interaction, 'engine_btn_add_server'), 3, async (i) => {
      await this.deferUpdate(i);
      return this._multiAddServer(i, user, premium);
    });
    const btnDel = this.btn(user, this.t(interaction, 'engine_btn_del_last'), 4, async (i) => {
      await this.deferUpdate(i);
      draft.multiServers.pop();
      if (!draft.multiServers.length) draft.isMultiServer = false;
      return this._telaMulti(i, user, premium);
    });
    const btnVoltar = this.btn(user, this.t(interaction, 'engine_btn_back'), 2, async (i) => {
      await this.deferUpdate(i);
      return this._telaExtras(i, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} ${this.t(interaction, 'engine_multi_title')}`,
        description: this.t(interaction, 'engine_multi_desc', {
          modo: draft.multiMode === 'global'
            ? this.t(interaction, 'engine_multi_mode_global_label')
            : this.t(interaction, 'engine_multi_mode_separate_label'),
          atual,
        }),
        color: DEFAULT_COLOR,
      }],
      components: [this.row(selectModo), this.row(btnAdd, btnDel, btnVoltar)],
    });
  }

  async _multiAddServer(interaction, user, premium) {

    const draft = this._getDraft(user);

    const respGuild = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_ask_add_guild')}`
    );
    if (!respGuild) return this._telaMulti(interaction, user, premium);

    const guildId = respGuild.match(/\d{17,19}/)?.[0];
    if (!guildId) return this._telaMulti(interaction, user, premium);

    const inServer = await this._checkBotInGuild(guildId);
    if (!inServer) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_not_in_server', { guildId })}`, color: DEFAULT_COLOR }]
      });
      return this._telaMulti(interaction, user, premium);
    }

    const authorized = await this._checkAuthorization(guildId, interaction.guild_id, 'multi_giveaway');
    if (!authorized) {
      await this._requestAuthorization(interaction, guildId, interaction.guild_id, 'multi_giveaway');
      return this._telaMulti(interaction, user, premium);
    }

    const respCh = await this._ask(interaction, draft,
      `${E.animada} ${this.t(interaction, 'engine_ask_ext_channel')}`
    );
    if (!respCh) return this._telaMulti(interaction, user, premium);
    const channelExtId = respCh.match(/\d{17,19}/)?.[0];

    let winners = 0;
    if (draft.multiMode === 'separate') {
      const respW = await this._ask(interaction, draft,
        `${E.animada} ${this.t(interaction, 'engine_ask_ext_winners')}`
      );
      if (respW) winners = parseInt(respW) || 1;
    }

    draft.multiServers.push({ guildId, channelId: channelExtId, winners, label: '', messageId: null });
    return this._telaMulti(interaction, user, premium);
  }


  async _publicar(interaction, user) {

    const draft = this._getDraft(user);

    if (!draft.prize || !draft.channelId || !draft.endsAt) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_publish_missing_fields')}`, color: DEFAULT_COLOR }]
      });
      return this._telaExtras(interaction, user);
    }

    await this.editOriginal(interaction, {
      embeds: [{ description: `⏳ ${this.t(interaction, 'engine_publishing')}`, color: DEFAULT_COLOR }],
      components: [],
    });

    const doc = await GiveawayDb.create({
      giveawayId: this._genId(),
      guildId:    interaction.guild_id,
      channelId:  draft.channelId,
      createdBy:  user,
      ...draft,
    });

    const embed      = GiveawayEmbed.buildActive(doc, this.client);
    const components = this._buildJoinComponents(doc);

    const msg = await DiscordRequest(`/channels/${draft.channelId}/messages`, {
      method: 'POST', body: { embeds: [embed], components }
    });

    doc.messageId = msg.id;
    await this.save(doc);

    if (doc.isMultiServer) {
      for (const server of doc.multiServers) {
        if (!server.channelId) continue;
        const m = await DiscordRequest(`/channels/${server.channelId}/messages`, {
          method: 'POST', body: { embeds: [embed], components }
        }).catch(() => null);
        if (m) server.messageId = m.id;
      }
      await this.save(doc);
    }

    this.client.gScheduler?.schedule(doc);
    await this._syncEndTask(doc);
    this._clearDraft(user);

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.festa} ${this.t(interaction, 'engine_published_title')}`,
        description: this.t(interaction, 'engine_published_desc', { channelId: draft.channelId, id: doc.giveawayId }),
        color: DEFAULT_COLOR,
      }],
      components: [],
    });
  }

  _buildJoinComponents(doc) {
    return [{
      type: 1,
      components: [{
        type: 2, label: this.client.t('sorteio.engine_join_button', {}), style: 3,
        custom_id: JSON.stringify({ t: 'giveaway_join', id: doc.giveawayId }),
      }]
    }];
  }


  async join(interaction) {
    try {
      const data = JSON.parse(interaction.data.custom_id);
      const doc  = await GiveawayDb.findOne({ giveawayId: data.id });

      if (!doc || doc.status !== 'active') {
        return this.reply(interaction, {
          content: `${E.pensando} ${this.t(interaction, 'engine_join_not_active')}`, flags: 64,
        });
      }

      const user = interaction.member?.user || interaction.user;
      const existing = doc.participants.find(
        p => p.userId === user.id && p.guildId === interaction.guild_id
      );

      if (existing) {
        return this.reply(interaction, {
          content: `${E.feliz} ${this.t(interaction, 'engine_join_already', { entries: existing.totalEntries })}`,
          flags: 64,
        });
      }

      const memberRoles  = interaction.member?.roles || [];
      const bonusEntries = doc.bonusEntries.reduce((acc, b) =>
        memberRoles.includes(b.roleId) ? acc + b.entries : acc, 0);
      const totalEntries = 1 + bonusEntries;

      doc.participants.push({
        userId: user.id, guildId: interaction.guild_id,
        baseEntries: 1, bonusEntries, totalEntries,
        joinedAt: new Date(), status: 'participating',
      });

      await this.save(doc);
      await this._refreshEmbed(doc).catch(() => {});

      const bonusSuffix = bonusEntries ? this.t(interaction, 'engine_join_bonus_suffix', { bonus: bonusEntries }) : '';

      return this.reply(interaction, {
        content: `${E.feliz} ${this.t(interaction, 'engine_join_success', { total: totalEntries, bonus: bonusSuffix })}`,
        flags: 64,
      });

    } catch (err) {
      console.error('[GiveawaySystem] join error:', err);
      return this.reply(interaction, {
        content: `${E.pensando} ${this.t(interaction, 'engine_generic_error')}`, flags: 64,
      });
    }
  }

  async _refreshEmbed(doc) {
    if (!doc.messageId) return;
    await DiscordRequest(`/channels/${doc.channelId}/messages/${doc.messageId}`, {
      method: 'PATCH',
      body: { embeds: [GiveawayEmbed.buildActive(doc, this.client)], components: this._buildJoinComponents(doc) }
    });
  }


  async giveawayMenu(interaction, doc, user) {

    const statusMap = {
      active: this.t(interaction, 'engine_status_active'), paused: this.t(interaction, 'engine_status_paused'),
      ended: this.t(interaction, 'engine_status_ended'), cancelled: this.t(interaction, 'engine_status_cancelled'),
    };

    const select = this.select(user, [
      { label: this.t(interaction, 'engine_manage_opt_end'),       value: 'end'    },
      { label: doc.status === 'paused' ? this.t(interaction, 'engine_manage_opt_reopen') : this.t(interaction, 'engine_manage_opt_pause'), value: 'toggle' },
      { label: this.t(interaction, 'engine_manage_opt_edit'),      value: 'edit'   },
      { label: this.t(interaction, 'engine_manage_opt_add_time'),  value: 'add_t'  },
      { label: this.t(interaction, 'engine_manage_opt_rem_time'),  value: 'rem_t'  },
      { label: this.t(interaction, 'engine_manage_opt_reroll'),    value: 'reroll' },
      { label: this.t(interaction, 'engine_manage_opt_export'),    value: 'export' },
      { label: this.t(interaction, 'engine_manage_opt_stats'),     value: 'stats'  },
    ], this.t(interaction, 'engine_manage_placeholder'), async (i) => {
      await this.deferUpdate(i);
      const v = i.data.values[0];
      if (v === 'end')    return this.endGiveaway(i, doc);
      if (v === 'toggle') return this.togglePause(i, doc, user);
      if (v === 'edit')   return this.editGiveaway(i, doc, user);
      if (v === 'add_t')  return this.modifyTime(i, doc, user, 'add');
      if (v === 'rem_t')  return this.modifyTime(i, doc, user, 'remove');
      if (v === 'reroll') return this.reroll(i, doc, user);
      if (v === 'export') return this.exportMenu(i, doc, user);
      if (v === 'stats')  return this.showStats(i, doc, user);
    });

    const btnBack = this.btn(user, this.t(interaction, 'engine_btn_back'), 2, async (i) => {
      await this.deferUpdate(i);
      return this.startMenu(i);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} ${this.t(interaction, 'engine_manage_title', { prize: doc.prize.slice(0, 50) })}`,
        description: [
          `**${this.t(interaction, 'engine_manage_field_status')}:** ${statusMap[doc.status]}`,
          `**${this.t(interaction, 'engine_manage_field_channel')}:** <#${doc.channelId}>`,
          `**${this.t(interaction, 'engine_manage_field_winners')}:** ${doc.winners}`,
          `**${this.t(interaction, 'engine_manage_field_participants')}:** ${doc.participants.length}`,
          `**${this.t(interaction, 'engine_manage_field_ends')}:** <t:${Math.floor(doc.endsAt.getTime() / 1000)}:R>`,
        ].join('\n'),
        color: DEFAULT_COLOR,
      }],
      components: [this.row(select), this.row(btnBack)],
    });
  }


  async endGiveaway(interaction, doc) {
    if (doc.status === 'ended') {
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_already_ended')}`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    await this.editOriginal(interaction, {
      embeds: [{ description: `⏳ ${this.t(interaction, 'engine_drawing')}`, color: DEFAULT_COLOR }],
      components: [],
    });

    doc.status = 'ended'; doc.endedAt = new Date();
    await this.save(doc);
    this.client.gScheduler?.cancel(doc.giveawayId);
    await this._cancelEndTask(doc.giveawayId);

    const result = await GiveawayDraw.draw(doc, this.client);
    await this.save(doc);
    await this._sendEndReport(doc, result);

    return this.editOriginal(interaction, {
      embeds: [{ description: `${E.festa} ${this.t(interaction, 'engine_ended_ok')}`, color: DEFAULT_COLOR }],
      components: [],
    });
  }

  async togglePause(interaction, doc, user) {
    if (doc.status === 'paused') {
      const pausedMs = doc.pausedAt ? Date.now() - doc.pausedAt.getTime() : 0;
      doc.pausedDuration += pausedMs;
      doc.endsAt   = new Date(doc.endsAt.getTime() + pausedMs);
      doc.status   = 'active'; doc.pausedAt = null;
      this.client.gScheduler?.schedule(doc);
      await this._syncEndTask(doc);
    } else {
      doc.pausedAt = new Date(); doc.status = 'paused';
      this.client.gScheduler?.cancel(doc.giveawayId);
      await this._cancelEndTask(doc.giveawayId);
    }
    await this.save(doc);
    await this._refreshEmbed(doc).catch(() => {});
    return this.giveawayMenu(interaction, doc, user);
  }

  async modifyTime(interaction, doc, user, mode) {

    const acao = mode === 'add' ? this.t(interaction, 'engine_time_add_word') : this.t(interaction, 'engine_time_remove_word');
    const resp = await this._ask(interaction, { ...doc.toObject(), prize: doc.prize },
      `${E.animada} ${this.t(interaction, 'engine_modify_time_ask', { acao })}`
    );
    if (!resp) return this.giveawayMenu(interaction, doc, user);

    const ms = this._parseDuration(resp);
    if (!ms) {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_time_invalid')}`, color: DEFAULT_COLOR }]
      });
      return this.giveawayMenu(interaction, doc, user);
    }

    if (mode === 'add') {
      doc.endsAt = new Date(doc.endsAt.getTime() + ms);
    } else {
      const newEnd = new Date(doc.endsAt.getTime() - ms);
      if (newEnd <= new Date()) {
        await this.followUpEphemeral(interaction, {
          embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_time_would_pass')}`, color: DEFAULT_COLOR }]
        });
        return this.giveawayMenu(interaction, doc, user);
      }
      doc.endsAt = newEnd;
    }

    await this.save(doc);
    this.client.gScheduler?.reschedule(doc.giveawayId);
    await this._syncEndTask(doc);
    await this._refreshEmbed(doc).catch(() => {});
    return this.giveawayMenu(interaction, doc, user);
  }

  async reroll(interaction, doc, user) {
    if (doc.status !== 'ended') {
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_reroll_only_ended')}`, color: DEFAULT_COLOR }],
        components: [],
      });
    }

    await this.editOriginal(interaction, {
      embeds: [{ description: `⏳ ${this.t(interaction, 'engine_rerolling')}`, color: DEFAULT_COLOR }],
      components: [],
    });

    const result = await GiveawayDraw.draw(doc, this.client, { reroll: true });
    await this.save(doc);
    await this._sendEndReport(doc, result);

    return this.editOriginal(interaction, {
      embeds: [{ description: `${E.festa} ${this.t(interaction, 'engine_reroll_ok')}`, color: DEFAULT_COLOR }],
      components: [],
    });
  }

  async editGiveaway(interaction, doc, user) {

    const fakeDraft = { prize: doc.prize, description: doc.description, channelId: doc.channelId, winners: doc.winners, endsAt: doc.endsAt, color: doc.color, thumbnail: doc.thumbnail, banner: doc.banner, bonusEntries: doc.bonusEntries, requirements: doc.requirements, isMultiServer: doc.isMultiServer, customMessage: doc.customMessage, multiServers: doc.multiServers };

    const respPrize = await this._ask(interaction, fakeDraft,
      `${E.animada} ${this.t(interaction, 'engine_edit_ask_prize', { atual: doc.prize })}`
    );
    if (respPrize === null) return this.giveawayMenu(interaction, doc, user);
    if (respPrize.toLowerCase() !== 'pular') doc.prize = respPrize.trim().slice(0, 200);

    fakeDraft.prize = doc.prize;

    const respDesc = await this._ask(interaction, fakeDraft,
      `${E.animada} ${this.t(interaction, 'engine_edit_ask_desc')}`
    );
    if (respDesc === null) return this.giveawayMenu(interaction, doc, user);
    if (respDesc.toLowerCase() !== 'pular') doc.description = respDesc.trim().slice(0, 1000);

    const respW = await this._ask(interaction, fakeDraft,
      `${E.animada} ${this.t(interaction, 'engine_edit_ask_winners', { atual: doc.winners })}`
    );
    if (respW === null) return this.giveawayMenu(interaction, doc, user);
    if (respW.toLowerCase() !== 'pular') {
      const n = parseInt(respW);
      if (n && n >= 1) doc.winners = n;
    }

    await this.save(doc);
    await this._refreshEmbed(doc).catch(() => {});
    return this.giveawayMenu(interaction, doc, user);
  }


  async exportMenu(interaction, doc, user) {

    const select = this.select(user, [
      { label: this.t(interaction, 'engine_export_opt_html'), value: 'html' },
      { label: this.t(interaction, 'engine_export_opt_csv'),  value: 'csv'  },
      { label: this.t(interaction, 'engine_export_opt_xlsx'), value: 'xlsx' },
      { label: this.t(interaction, 'engine_export_opt_json'), value: 'json' },
    ], this.t(interaction, 'engine_export_placeholder'), async (i) => {
      await this.deferUpdate(i);
      return this.exportGiveaway(i, doc, i.data.values[0]);
    });

    const btnBack = this.btn(user, this.t(interaction, 'engine_btn_back'), 2, async (i) => {
      await this.deferUpdate(i);
      return this.giveawayMenu(i, doc, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} ${this.t(interaction, 'engine_export_title')}`,
        description: this.t(interaction, 'engine_export_desc'),
        color: DEFAULT_COLOR,
      }],
      components: [this.row(select), this.row(btnBack)],
    });
  }

  async exportGiveaway(interaction, doc, format) {
    try {
      await this.editOriginal(interaction, {
        embeds: [{ description: `⏳ ${this.t(interaction, 'engine_exporting', { format: format.toUpperCase() })}`, color: DEFAULT_COLOR }],
        components: [],
      });

      const file = await GiveawayExport.export(doc, format);

      await DiscordRequest(`/channels/${interaction.channel_id}/messages`, {
        method: 'POST',
        body:   { content: `${E.feliz} ${this.t(interaction, 'engine_export_sent_channel')}` },
        files:  [file],
      });

      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.feliz} ${this.t(interaction, 'engine_export_sent_ok')}`, color: DEFAULT_COLOR }],
        components: [],
      });
    } catch (err) {
      console.error('[GiveawaySystem] export error:', err);
      return this.editOriginal(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_export_error')}`, color: DEFAULT_COLOR }],
        components: [],
      });
    }
  }


  async showStats(interaction, doc, user) {

    const total      = doc.participants.length;
    const winners    = doc.participants.filter(p => p.status === 'winner').length;
    const disq       = doc.participants.filter(p => p.status === 'disqualified').length;
    const totalBonus = doc.participants.reduce((a, p) => a + p.bonusEntries, 0);
    const totalEnt   = doc.participants.reduce((a, p) => a + p.totalEntries, 0);

    const byGuild = doc.participants.reduce((acc, p) => {
      acc[p.guildId] = (acc[p.guildId] || 0) + 1; return acc;
    }, {});

    const byGuildLines = Object.entries(byGuild)
      .map(([gId, c]) => this.t(interaction, 'engine_stats_guild_line', { guildId: gId, count: c }))
      .join('\n') || '—';

    const btnBack = this.btn(user, this.t(interaction, 'engine_btn_back'), 2, async (i) => {
      await this.deferUpdate(i);
      return this.giveawayMenu(i, doc, user);
    });

    return this.editOriginal(interaction, {
      embeds: [{
        title: `${E.animada} ${this.t(interaction, 'engine_stats_title')}`,
        fields: [
          { name: this.t(interaction, 'engine_stats_participants'),  value: String(total),      inline: true },
          { name: this.t(interaction, 'engine_stats_winners'),       value: String(winners),    inline: true },
          { name: this.t(interaction, 'engine_stats_disq'),          value: String(disq),       inline: true },
          { name: this.t(interaction, 'engine_stats_total_entries'), value: String(totalEnt),   inline: true },
          { name: this.t(interaction, 'engine_stats_bonus_entries'), value: String(totalBonus), inline: true },
          { name: this.t(interaction, 'engine_stats_by_server'),     value: byGuildLines },
        ],
        color: DEFAULT_COLOR,
      }],
      components: [this.row(btnBack)],
    });
  }


  async _sendEndReport(doc, result) {
    const embed = GiveawayEmbed.buildEndReport(doc, result, this.client);

    await DiscordRequest(`/channels/${doc.channelId}/messages`, {
      method: 'POST',
      body: {
        content: result.winners.map(w => `<@${w.userId}>`).join(' '),
        embeds:  [embed],
      },
    }).catch(() => {});

    if (doc.messageId) {
      await DiscordRequest(`/channels/${doc.channelId}/messages/${doc.messageId}`, {
        method: 'PATCH',
        body: { embeds: [GiveawayEmbed.buildEnded(doc, result, this.client)], components: [] },
      }).catch(() => {});
    }
  }


  async _checkBotInGuild(guildId) {
    try { await DiscordRequest(`/guilds/${guildId}`, { method: 'GET' }); return true; }
    catch { return false; }
  }

  async _checkAuthorization(ownerGuildId, requesterGuildId, level) {
    const auth = await AuthorizationDb.findOne({
      ownerGuildId, requesterGuildId, status: 'approved'
    });
    if (!auth) return false;
    if (auth.expiresAt && auth.expiresAt < new Date()) return false;
    const levels = ['basic', 'advanced', 'multi_giveaway'];
    return levels.indexOf(auth.permissionLevel) >= levels.indexOf(level);
  }

  async _requestAuthorization(interaction, ownerGuildId, requesterGuildId, level) {

    const levelLabels = {
      basic:          this.t(interaction, 'engine_auth_level_basic'),
      advanced:       this.t(interaction, 'engine_auth_level_advanced'),
      multi_giveaway: this.t(interaction, 'engine_auth_level_multi'),
    };

    let ownerGuild;
    try {
      ownerGuild = await DiscordRequest(`/guilds/${ownerGuildId}?with_counts=false`, { method: 'GET' });
    } catch {
      await this.followUpEphemeral(interaction, {
        embeds: [{ description: `${E.pensando} ${this.t(interaction, 'engine_auth_cant_access_guild', { guildId: ownerGuildId })}`, color: DEFAULT_COLOR }]
      });
      return;
    }

    const ownerId = ownerGuild.owner_id;

    let requesterGuild = { name: requesterGuildId, icon: null };
    try {
      requesterGuild = await DiscordRequest(`/guilds/${requesterGuildId}?with_counts=false`, { method: 'GET' });
    } catch {}

    const configurerId = interaction.member?.user?.id || interaction.user?.id;
    let configurerTag  = `<@${configurerId}>`;
    try {
      const u    = await DiscordRequest(`/users/${configurerId}`, { method: 'GET' });
      configurerTag = u.global_name
        ? `${u.global_name} (@${u.username})`
        : `@${u.username}`;
    } catch {}

    const auth = await AuthorizationDb.findOneAndUpdate(
      { ownerGuildId, requesterGuildId },
      {
        ownerGuildId, requesterGuildId,
        permissionLevel: level,
        status: 'pending',
        ownerId,
        requestedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const requesterIcon = requesterGuild.icon
      ? `https://cdn.discordapp.com/icons/${requesterGuildId}/${requesterGuild.icon}.png?size=64`
      : null;

    const authEmbed = {
      title: `${E.animada} ${this.t(interaction, 'engine_auth_request_title')}`,
      description: this.t(interaction, 'engine_auth_request_desc', {
        ownerName: ownerGuild.name,
        reqName: requesterGuild.name,
        reqId: requesterGuildId,
        configurer: configurerTag,
        level: levelLabels[level],
      }),
      color: DEFAULT_COLOR,
      thumbnail: requesterIcon ? { url: requesterIcon } : undefined,
    };

    const authComponents = [{
      type: 1,
      components: [
        {
          type: 2, label: this.t(interaction, 'engine_auth_btn_approve'), style: 3,
          custom_id: JSON.stringify({ t: 'auth_approve', authId: auth._id.toString() })
        },
        {
          type: 2, label: this.t(interaction, 'engine_auth_btn_deny'), style: 4,
          custom_id: JSON.stringify({ t: 'auth_deny', authId: auth._id.toString() })
        },
      ]
    }];

    let sentViaDM = false;

    try {
      const dmChannel = await DiscordRequest('/users/@me/channels', {
        method: 'POST',
        body: { recipient_id: ownerId }
      });

      const msg = await DiscordRequest(`/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        body: { embeds: [authEmbed], components: authComponents }
      });

      auth.authMessageId  = msg.id;
      auth.authChannelId  = dmChannel.id;
      auth.sentVia        = 'dm';
      await auth.save();
      sentViaDM = true;

    } catch {
      sentViaDM = false;
    }

    if (!sentViaDM) {

      const fallbackChannelId = ownerGuild.system_channel_id || await this._findTextChannel(ownerGuildId);

      if (fallbackChannelId) {
        try {
          const msg = await DiscordRequest(`/channels/${fallbackChannelId}/messages`, {
            method: 'POST',
            body: {
              content: `<@${ownerId}>`,
              embeds:  [authEmbed],
              components: authComponents,
            }
          });

          auth.authMessageId = msg.id;
          auth.authChannelId = fallbackChannelId;
          auth.sentVia       = 'channel';
          await auth.save();

        } catch {
          await this.followUpEphemeral(interaction, {
            embeds: [{
              description: `${E.pensando} ${this.t(interaction, 'engine_auth_cant_send_guild', { guildId: ownerGuildId })}`,
              color: DEFAULT_COLOR,
            }]
          });
          return;
        }
      }
    }

    await this.followUpEphemeral(interaction, {
      embeds: [{
        description: `${E.feliz} ${this.t(interaction, 'engine_auth_sent_ok', { ownerName: ownerGuild.name })}`,
        color: DEFAULT_COLOR,
      }]
    });
  }

  async _findTextChannel(guildId) {
    try {
      const channels = await DiscordRequest(`/guilds/${guildId}/channels`, { method: 'GET' });
      const text = channels.find(c => c.type === 0); 
      return text?.id || null;
    } catch {
      return null;
    }
  }

  async handleAuthResponse(interaction, approve) {

    const data = JSON.parse(interaction.data.custom_id);
    const auth = await AuthorizationDb.findById(data.authId);

    if (!auth || auth.status !== 'pending') {
      return this.reply(interaction, {
        content: `${E.pensando} ${this.t(interaction, 'engine_auth_already_answered')}`, flags: 64,
      });
    }

    const responderId = interaction.member?.user?.id || interaction.user?.id;
    if (responderId !== auth.ownerId) {
      return this.reply(interaction, {
        content: `${E.pensando} ${this.t(interaction, 'engine_auth_only_owner')}`,
        flags: 64,
      });
    }

    auth.status     = approve ? 'approved' : 'denied';
    auth.approvedBy = responderId;
    auth.resolvedAt = new Date();
    await auth.save();

    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: 'POST',
        body: {
          type: 7,
          data: {
            embeds: [{
              title: approve ? `${E.festa} ${this.t(interaction, 'engine_auth_granted_title')}` : `${E.pensando} ${this.t(interaction, 'engine_auth_denied_title')}`,
              description: approve
                ? this.t(interaction, 'engine_auth_granted_desc', { guildId: auth.requesterGuildId })
                : this.t(interaction, 'engine_auth_denied_desc', { guildId: auth.requesterGuildId }),
              color: approve ? 0x57F287 : 0xED4245,
            }],
            components: [],
          }
        }
      }
    );
  }


  _parseDuration(str) {
    const match = str?.trim().match(/^(\d+)(d|h|m|s)$/i);
    if (!match) return null;
    const ms = { d: 864e5, h: 36e5, m: 6e4, s: 1e3 };
    return parseInt(match[1]) * (ms[match[2].toLowerCase()] || 0) || null;
  }

  _reqLabel(req, interaction) {
    const map = {
      REQUIRED_ROLE:              this.t(interaction, 'engine_req_label_required_role', { value: req.value }),
      FORBIDDEN_ROLE:             this.t(interaction, 'engine_req_label_forbidden_role', { value: req.value }),
      MIN_MESSAGES:               this.t(interaction, 'engine_req_label_min_messages', { value: req.value }),
      MIN_DAYS_IN_SERVER:         this.t(interaction, 'engine_req_label_min_days_server', { value: req.value }),
      MIN_ACCOUNT_AGE:            this.t(interaction, 'engine_req_label_min_account_age', { value: req.value }),
      IN_SERVER:                  this.t(interaction, 'engine_req_label_in_server', { guildId: req.guildId }),
      REQUIRED_ROLE_IN_SERVER:    this.t(interaction, 'engine_req_label_required_role_ext'),
      FORBIDDEN_ROLE_IN_SERVER:   this.t(interaction, 'engine_req_label_forbidden_role_ext'),
      MIN_DAYS_IN_EXT_SERVER:     this.t(interaction, 'engine_req_label_min_days_ext', { value: req.value }),
      MIN_MESSAGES_IN_EXT_SERVER: this.t(interaction, 'engine_req_label_min_msgs_ext', { value: req.value }),
      MIN_HOURS_IN_CALL:          this.t(interaction, 'engine_req_label_min_hours_call', { value: req.value }),
      MIN_LEVEL:                  this.t(interaction, 'engine_req_label_min_level', { value: req.value }),
      MIN_XP:                     this.t(interaction, 'engine_req_label_min_xp', { value: req.value }),
      HAS_BOOSTER_ROLE:           this.t(interaction, 'engine_req_label_booster'),
      HAS_SUPPORTER_ROLE:         this.t(interaction, 'engine_req_label_supporter'),
    };
    return map[req.type] || req.type;
  }
}

module.exports = GiveawaySystem;
