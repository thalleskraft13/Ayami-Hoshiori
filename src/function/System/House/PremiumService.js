'use strict';

const PremiumManager             = require('../../Utils/PremiumManager.js');
const { getPlan, isPlanAtLeast } = require('../../Utils/PremiumPlans.js');

const PLANO_MINIMO = 'NOVA_ESTRELA';

class HousePremiumService {

  async getPlano(guildId) {
    const premium = await PremiumManager.getGuildPremium(guildId).catch(() => ({ status: false }));
    return premium.status ? getPlan(premium.planId) : getPlan(null);
  }

  async hasSubscription(guildId) {
    const plan = await this.getPlano(guildId);
    return isPlanAtLeast(plan.key, PLANO_MINIMO);
  }
}

module.exports = HousePremiumService;
