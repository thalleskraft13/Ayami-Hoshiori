'use strict';

const getPerm = require('../../Utils/GetPerm.js');

const LEVEL_ORDER = ['visualizador', 'recepcionista', 'aprovador', 'admin'];

class PermissionService {

  constructor(client) {
    this.client = client;
  }

  async _memberRoles(guildId, userId) {
    const member = await this.client.guilds.getGuildMember(guildId, userId);
    return member?.roles ?? [];
  }

  async hasManageGuild(guildId, userId) {
    const perms = await getPerm({ id: userId, guildId, client: this.client });
    return !!perms?.includes('MANAGE_GUILD');
  }

  async getLevel(guildId, userId, houseConfig) {
    if (await this.hasManageGuild(guildId, userId)) return 'admin';

    const roles = await this._memberRoles(guildId, userId);
    const permissions = houseConfig?.permissions ?? {};

    for (const level of [...LEVEL_ORDER].reverse()) {
      const roleIds = permissions[level] ?? [];
      if (roleIds.some(r => roles.includes(r))) return level;
    }

    return null;
  }

  async hasAtLeast(guildId, userId, requiredLevel, houseConfig) {
    const level = await this.getLevel(guildId, userId, houseConfig);
    if (!level) return false;
    return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(requiredLevel);
  }
}

module.exports = PermissionService;
