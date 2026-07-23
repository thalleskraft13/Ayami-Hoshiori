'use strict';


const mongoose       = require('mongoose');
const DiscordRequest = require('../../DiscordRequest.js');
const { PendingTempRoleModel, ActiveLinkedRoleModel } = require('../../../Mongodb/guild.js');

const SWEEP_INTERVAL_MS = 60_000; 

class AutoRoleManager {

  constructor(client) {
    this.client = client;
    this._botRolePosition = new Map(); 
    this._startTempRoleSweep();
  }


  async applyRoles({ guildId, userId, ticketId, panel }) {
    const cfg = panel.autoRoleConfig;
    if (!cfg?.enabled || !cfg.roles?.length) return;

    const botMaxPos = await this._getBotHighestRolePosition(guildId);

    for (const entry of cfg.roles) {
      try {
        const canAssign = await this._canAssignRole(guildId, entry.roleId, botMaxPos);
        if (!canAssign) {
          console.warn(`[AutoRole] Cargo ${entry.roleId} está acima do bot — ignorado`);
          continue;
        }

        await this._addRole(guildId, userId, entry.roleId);

        if (entry.tipo === 1 && entry.duration > 0) {
          await PendingTempRoleModel.create({
            guildId,
            userId,
            roleId:   entry.roleId,
            panelId:  panel.panelId,
            ticketId,
            removeAt: Date.now() + entry.duration,
            removed:  false
          });
        }

        if (entry.tipo === 2) {
          await ActiveLinkedRoleModel.create({
            guildId,
            userId,
            roleId:  entry.roleId,
            panelId: panel.panelId,
            ticketId
          });
        }

      } catch (err) {
        console.error(`[AutoRole] Erro ao aplicar cargo ${entry.roleId}:`, err);
      }
    }
  }


  async handleTicketClose({ guildId, userId, ticketId }) {
    try {
      const records = await ActiveLinkedRoleModel.find({ guildId, userId, ticketId });

      for (const record of records) {
        await ActiveLinkedRoleModel.deleteOne({ _id: record._id });

        const remaining = await ActiveLinkedRoleModel.countDocuments({
          guildId,
          userId,
          roleId: record.roleId
        });

        if (remaining === 0) {
          await this._removeRoleSafe(guildId, userId, record.roleId);
        }
      }
    } catch (err) {
      console.error('[AutoRole] Erro ao processar fechamento de ticket:', err);
    }
  }


  _startTempRoleSweep() {
    const startInterval = () => {
      setInterval(() => this._sweepTempRoles(), SWEEP_INTERVAL_MS).unref();
      this._sweepTempRoles().catch(console.error);
    };

    if (mongoose.connection.readyState === 1) {
      startInterval();
      return;
    }

    mongoose.connection.once('open', () => {
      console.log('[AutoRole] MongoDB conectado — iniciando sweep de temporários');
      startInterval();
    });
  }

  async _sweepTempRoles() {
    try {
      const now     = Date.now();
      const expired = await PendingTempRoleModel.find({
        removeAt: { $lte: now },
        removed:  false
      });

      for (const record of expired) {
        try {
          await this._removeRoleSafe(record.guildId, record.userId, record.roleId);
          record.removed = true;
          await record.save();
        } catch (err) {
          console.error(`[AutoRole] Sweep — erro ao remover cargo ${record.roleId}:`, err);
        }
      }

      await PendingTempRoleModel.deleteMany({
        removed:  true,
        removeAt: { $lte: now - 86_400_000 }
      });

    } catch (err) {
      console.error('[AutoRole] Erro no sweep de temporários:', err);
    }
  }


  async _addRole(guildId, userId, roleId) {
    await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'PUT'
    });
  }

  async _removeRoleSafe(guildId, userId, roleId) {
    try {
      await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn(`[AutoRole] Não foi possível remover cargo ${roleId} do usuário ${userId}:`, err?.message);
    }
  }


  async _getBotHighestRolePosition(guildId) {
    const cached = this._botRolePosition.get(guildId);
    if (cached && cached.expires > Date.now()) return cached.position;

    const botUser = await DiscordRequest('/users/@me');
    const member  = await DiscordRequest(`/guilds/${guildId}/members/${botUser.id}`);
    const roles   = await DiscordRequest(`/guilds/${guildId}/roles`);

    let maxPos = 0;
    for (const roleId of member.roles) {
      const role = roles.find(r => r.id === roleId);
      if (role && role.position > maxPos) maxPos = role.position;
    }

    this._botRolePosition.set(guildId, {
      position: maxPos,
      expires:  Date.now() + 300_000 
    });

    return maxPos;
  }

  async _canAssignRole(guildId, roleId, botMaxPos) {
    try {
      const roles = await DiscordRequest(`/guilds/${guildId}/roles`);
      const role  = roles.find(r => r.id === roleId);
      if (!role) return false;
      return role.position < botMaxPos;
    } catch {
      return false;
    }
  }


  async getActiveLinkedRoles(guildId, userId) {
    return ActiveLinkedRoleModel.find({ guildId, userId });
  }
}

module.exports = AutoRoleManager;
