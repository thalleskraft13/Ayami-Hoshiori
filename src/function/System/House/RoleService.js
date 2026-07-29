'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const roleHigher      = require('../../Utils/RoleHigher.js');

class RoleService {

  constructor(client) {
    this.client = client;
  }

  async validateRole(guildId, roleId) {
    if (!roleId) return { ok: false, reason: 'cargo_nao_informado' };

    const roles = await this.client.guilds.fetchRoles(guildId).catch(() => null);
    const list  = roles ? Array.from(roles.values()) : await DiscordRequest(`/guilds/${guildId}/roles`);
    const role  = list.find(r => r.id === roleId);

    if (!role) return { ok: false, reason: 'cargo_inexistente' };

    const botCanAssign = await roleHigher({ guildId, roleId, bot: true });
    if (!botCanAssign) return { ok: false, reason: 'hierarquia_bot' };

    return { ok: true, role };
  }

  async addRole(guildId, userId, roleId) {
    await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'PUT' });
  }

  async removeRole(guildId, userId, roleId) {
    try {
      await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' });
    } catch (err) {
      console.warn(`[House/RoleService] Não foi possível remover cargo ${roleId} de ${userId}:`, err?.message);
    }
  }

  async swapRoles(guildId, userId, { removeRoleId, addRoleId }) {
    if (removeRoleId) await this.removeRole(guildId, userId, removeRoleId);
    if (addRoleId) {
      const check = await this.validateRole(guildId, addRoleId);
      if (!check.ok) return check;
      await this.addRole(guildId, userId, addRoleId);
    }
    return { ok: true };
  }
}

module.exports = RoleService;
