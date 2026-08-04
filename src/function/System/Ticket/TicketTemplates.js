'use strict';

const { randomUUID } = require('crypto');
const { GuildDb: GuildModel } = require('../../../Mongodb/guild.js');
const {
  TicketTemplateModel,
  TicketTemplateRatingModel,
  TicketTemplateInstallModel
} = require('../../../Mongodb/ticketTemplate.js');

const SANITIZE_FIELDS = ['canalId', 'categoriaId', 'messageId', 'contadorTicket', 'panelId'];

class TicketTemplates {

  constructor(ticketSystem) {
    this.ticketSystem = ticketSystem;
    this.client = ticketSystem.client;
  }

  t(key, ctx) {
    return this.client.t(`ticket.${key}`, ctx);
  }

  _sanitizeConfig(panel) {
    const clone = JSON.parse(JSON.stringify(panel));

    for (const field of SANITIZE_FIELDS) delete clone[field];

    clone.cargosStaff = [];

    if (clone.claimConfig) {
      clone.claimConfig.cargosPermitidos = [];
      clone.claimConfig.logChannelId = null;
    }
    if (clone.participantsConfig) {
      clone.participantsConfig.addRoles = [];
      clone.participantsConfig.removeRoles = [];
    }
    if (clone.actionMenuConfig?.keywords) {
      clone.actionMenuConfig.keywords = clone.actionMenuConfig.keywords.map(k => ({ ...k, cargosPermitidos: [] }));
    }
    if (clone.autoRoleConfig) {
      clone.autoRoleConfig.roles = [];
    }
    if (clone.transcriptConfig) {
      clone.transcriptConfig.channelId = null;
    }
    if (clone.selectMenuConfig?.options) {
      clone.selectMenuConfig.options = clone.selectMenuConfig.options.map(o => ({ ...o, cargosStaff: [] }));
    }

    return clone;
  }

  async publish({ authorId, authorName, guildId, panelId, name, shortDesc, fullDesc, tags = [] }) {
    const doc = await this.ticketSystem._getGuildDoc(guildId);
    const panel = doc ? this.ticketSystem._findPanel(doc, panelId) : null;
    if (!panel) throw new Error('Painel de ticket não encontrado.');

    const config = this._sanitizeConfig(panel.toObject ? panel.toObject() : panel);

    const entry = await TicketTemplateModel.create({
      libId:         randomUUID(),
      authorId,
      authorName:    authorName || authorId,
      originGuildId: guildId,
      name:          name.trim().slice(0, 100),
      shortDesc:     (shortDesc || '').trim().slice(0, 150),
      fullDesc:      (fullDesc || '').trim().slice(0, 2000),
      tags:          tags.map(t => t.toLowerCase().trim()).filter(Boolean),
      version:       '1.0.0',
      config,
      status:        'approved',
    });

    return entry;
  }

  async list({ tag, limit = 20 } = {}) {
    const filter = { status: 'approved' };
    if (tag) filter.tags = tag.toLowerCase().trim();

    return TicketTemplateModel
      .find(filter)
      .sort({ 'stats.installs': -1 })
      .limit(limit)
      .lean();
  }

  async get(libId) {
    return TicketTemplateModel.findOne({ libId, status: 'approved' }).lean();
  }

  async getById(libId) {
    return this.get(libId);
  }

  async search({ query, tag, authorId, sort = 'installs', page = 0, limit = 10 } = {}) {
    const filter = { status: 'approved' };

    if (query) {
      filter.$or = [
        { name:      { $regex: query, $options: 'i' } },
        { shortDesc: { $regex: query, $options: 'i' } },
        { tags:      { $regex: query, $options: 'i' } }
      ];
    }

    if (tag)      filter.tags     = tag.toLowerCase();
    if (authorId) filter.authorId = authorId;

    const sortMap = {
      installs:  { 'stats.installs':    -1 },
      rating:    { 'stats.avgRating':   -1, 'stats.ratingCount': -1 },
      recent:    { publishedAt:          -1 },
      trending:  { 'stats.weeklyScore': -1 }
    };
    const sortObj = sortMap[sort] || sortMap.installs;
    const total   = await TicketTemplateModel.countDocuments(filter);
    const results = await TicketTemplateModel
      .find(filter)
      .sort(sortObj)
      .skip(page * limit)
      .limit(limit)
      .lean();

    return { results, total, pages: Math.ceil(total / limit), page };
  }

  async unpublish(libId, authorId) {
    const entry = await TicketTemplateModel.findOne({ libId });
    if (!entry) throw new Error('Template não encontrado.');
    if (entry.authorId !== authorId) throw new Error('Você não é o autor deste template.');

    await TicketTemplateModel.deleteOne({ libId });
    return true;
  }

  _generatePanelId(doc) {
    let panelId;
    do {
      panelId = `template-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    } while (this.ticketSystem._findPanel(doc, panelId));
    return panelId;
  }

  async install({ libId, guildId, userId }) {
    const entry = await TicketTemplateModel.findOne({ libId, status: 'approved' });
    if (!entry) throw new Error('Template não encontrado na biblioteca.');

    const doc = await this.ticketSystem._getGuildDoc(guildId) || new GuildModel({ guildId });
    doc.ticket = doc.ticket || [];

    const panelId = this._generatePanelId(doc);
    const newPanel = { ...JSON.parse(JSON.stringify(entry.config)), panelId, contadorTicket: 0 };

    doc.ticket.push(newPanel);
    await doc.save();

    await TicketTemplateInstallModel.findOneAndUpdate(
      { libId, guildId },
      { libId, guildId, panelId, installedBy: userId, version: entry.version, installedAt: new Date() },
      { upsert: true }
    );

    await TicketTemplateModel.updateOne({ libId }, {
      $inc: { 'stats.installs': 1, 'stats.weeklyScore': 5 }
    });

    return panelId;
  }

  async vote(libId, userId, vote) {
    const existing = await TicketTemplateRatingModel.findOne({ libId, userId });

    if (existing?.vote === vote) {
      await TicketTemplateRatingModel.deleteOne({ libId, userId });
      const field = vote === 'like' ? 'stats.likes' : 'stats.dislikes';
      await TicketTemplateModel.updateOne({ libId }, { $inc: { [field]: -1 } });
      return { action: 'removed', vote };
    }

    if (existing) {
      const oldField = existing.vote === 'like' ? 'stats.likes' : 'stats.dislikes';
      const newField = vote === 'like' ? 'stats.likes' : 'stats.dislikes';
      await TicketTemplateRatingModel.updateOne({ libId, userId }, { vote });
      await TicketTemplateModel.updateOne({ libId }, { $inc: { [oldField]: -1, [newField]: 1 } });
      return { action: 'changed', vote };
    }

    await TicketTemplateRatingModel.create({ libId, userId, vote });
    const field = vote === 'like' ? 'stats.likes' : 'stats.dislikes';
    await TicketTemplateModel.updateOne({ libId }, { $inc: { [field]: 1 } });
    return { action: 'added', vote };
  }
}

module.exports = TicketTemplates;
