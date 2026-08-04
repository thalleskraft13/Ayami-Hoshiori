'use strict';

const { randomUUID } = require('crypto');

class TicketFAQ {

  constructor(ticketSystem) {
    this.ticketSystem = ticketSystem;
    this.client = ticketSystem.client;
  }

  t(key, ctx) {
    return this.client.t(`ticket.${key}`, ctx);
  }

  maxFaqsForPlan(plan) {
    return plan?.tickets?.maxFaqs ?? 5;
  }

  async start(interaction, doc, panel, option) {
    const faqs = panel.faqConfig?.faqs || [];
    return this._showList(interaction, doc, panel, option, faqs);
  }

  async _showList(interaction, doc, panel, option, faqs) {
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;

    const select = this.client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: this.t('faq_select_placeholder', ctx),
        options: faqs.slice(0, 25).map(f => ({ label: f.question.slice(0, 100), value: f.id })),
      },
      funcao: async (mi) => {
        const faq = faqs.find(f => f.id === mi.data.values[0]);
        if (!faq) return;
        return this._showAnswer(mi, doc, panel, option, faq);
      }
    });

    const btnOpen = this.ticketSystem.btn(userId, this.t('faq_open_ticket_button', ctx), 3, async (mi) => {
      return this.ticketSystem._proceedTicketFlow(mi, panel, option);
    });

    const btnClose = this.ticketSystem.btn(userId, this.t('faq_close_button', ctx), 2, async (mi) => {
      await this.ticketSystem.deferUpdate(mi);
      return this.ticketSystem.editOriginal(mi, { content: this.t('faq_closed_message', ctx), embeds: [], components: [] });
    });

    return this.ticketSystem.reply(interaction, {
      flags: 64,
      embeds: [{ title: this.t('faq_list_title', ctx), description: this.t('faq_list_desc', ctx), color: 0x7C8FFF }],
      components: [
        { type: 1, components: [select] },
        { type: 1, components: [btnOpen, btnClose] },
      ]
    });
  }

  async _showAnswer(interaction, doc, panel, option, faq) {
    const ctx = this.ticketSystem._tctx(interaction);
    const userId = interaction.member?.user?.id || interaction.user?.id;

    await this.ticketSystem.deferUpdate(interaction);

    const btnOpen = this.ticketSystem.btn(userId, this.t('faq_open_ticket_button', ctx), 3, async (mi) => {
      return this.ticketSystem._proceedTicketFlow(mi, panel, option);
    });

    const btnClose = this.ticketSystem.btn(userId, this.t('faq_close_button', ctx), 2, async (mi) => {
      await this.ticketSystem.deferUpdate(mi);
      return this.ticketSystem.editOriginal(mi, { content: this.t('faq_closed_message', ctx), embeds: [], components: [] });
    });

    return this.ticketSystem.editOriginal(interaction, {
      embeds: [{ title: faq.question, description: faq.answer, color: 0x7C8FFF }],
      components: [{ type: 1, components: [btnOpen, btnClose] }]
    });
  }

  createFaq(question, answer) {
    return { id: randomUUID(), question, answer };
  }
}

module.exports = TicketFAQ;
