'use strict';

const DiscordRequest = require("../../DiscordRequest.js");
const CV2             = require("../../Messages/CV2.js");
const BankService      = require("../../Banco/BankService.js");
const ShopService       = require("../../Loja/ShopService.js");
const { GuildDb }         = require("../../../Mongodb/guild.js");
const { isPlanAtLeast } = require("../../Utils/PremiumPlans.js");

const bancoCmd = require("../../../Commands/Economia/banco.js");
const lojaCmd  = require("../../../Commands/Economia/loja.js");
const mercadoLocalCmd = require("../../../Commands/Economia/mercadolocal.js");
const LocalMarketService = require("../../Mercado/LocalMarketService.js");

const ACCENT = 0x5C6BC0;
const ACCENT_ERROR = 0xE74C3C;

class PrefixEconomyManager {

  constructor(client) {
    this.client = client;
  }

  async send(channelId, containers) {
    return DiscordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: CV2.payload(containers, { ephemeral: false })
    });
  }

  async handleMessage(data) {
    if (!data.guild_id || data.author?.bot || !data.content) return;

    const guildConfig = await GuildDb.findOne({ guildId: data.guild_id });
    const prefixo = guildConfig?.prefixo || '!';

    if (!data.content.startsWith(prefixo)) return;

    const args    = data.content.slice(prefixo.length).trim().split(/\s+/).filter(Boolean);
    const comando = args.shift()?.toLowerCase();

    if (!['banco', 'loja', 'mercadolocal'].includes(comando)) return;

    const userId = data.author.id;
    const bank   = new BankService(data.guild_id, { client: this.client, guildId: data.guild_id });

    try {
      const plan = await bank.getPlano();
      if (!isPlanAtLeast(plan.key, 'LUA_CRESCENTE')) {
        return this.send(data.channel_id, [CV2.container([
          CV2.text(`🏦 **Economia do Servidor**`),
          CV2.text(`Esse recurso é exclusivo da assinatura 🌙 Lua Crescente ou superior. Plano atual do servidor: ${plan.emoji} ${plan.name}.`)
        ], { accentColor: 0x757575 })]);
      }

      if (comando === 'banco') return await this._banco(data, args, bank, userId, prefixo);
      if (comando === 'loja')  return await this._loja(data, args, bank, userId, prefixo);
      if (comando === 'mercadolocal') return await this._mercadoLocal(data, args, bank, userId, prefixo);
    } catch (err) {
      console.error('[PrefixEconomyManager]', err);
      return this.send(data.channel_id, [CV2.container([
        CV2.text('⚠️ **Não deu certo**'),
        CV2.text(err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.")
      ], { accentColor: ACCENT_ERROR })]);
    }
  }

  async _banco(data, args, bank, userId, prefixo) {
    const sub = (args[0] || 'saldo').toLowerCase();
    const pseudoInteraction = { guild_id: data.guild_id };

    switch (sub) {
      case 'saldo':
      case 'ver': {
        const banco = await bank.getBanco();
        if (!banco) return this.send(data.channel_id, [bancoCmd.buildPainelSemBanco(this.client, userId, bank)]);
        return this.send(data.channel_id, [await bancoCmd.buildPainelBanco(this.client, pseudoInteraction, bank, userId, banco)]);
      }

      case 'depositar': {
        const quantidade = Number.parseInt(args[1], 10);
        if (!Number.isInteger(quantidade)) throw new Error(`Use: \`${prefixo}banco depositar <quantidade>\``);
        const banco = await bank.depositar(userId, quantidade);
        return this.send(data.channel_id, [CV2.container([
          CV2.text('⭐ **Depósito realizado**'),
          CV2.text(`Lastro atual do Banco: ${banco.saldoEstrelas.toLocaleString()} Estrelas`)
        ], { accentColor: ACCENT })]);
      }

      case 'transferir': {
        const alvoId     = (args[1] || '').replace(/[<@!>]/g, '');
        const quantidade = Number(args[2]);
        if (!alvoId || !Number.isFinite(quantidade)) throw new Error(`Use: \`${prefixo}banco transferir @usuario <quantidade>\``);

        const banco = await bank.requireBanco();
        const { contaOrigem } = await bank.transferirLocal(userId, alvoId, quantidade);
        return this.send(data.channel_id, [CV2.container([
          CV2.text('🪙 **Transferência concluída**'),
          CV2.text(`Saldo restante: ${bancoCmd.formatarMoeda(contaOrigem.saldoLocal, banco.moeda)}`)
        ], { accentColor: ACCENT })]);
      }

      case 'emitir': {
        const admin = await bancoCmd.isAdminAqui(pseudoInteraction, this.client, bank, userId);
        if (!admin) throw new Error("Você não tem permissão para emitir moeda local.");

        const alvoId = (args[1] || '').replace(/[<@!>]/g, '');
        const quantidadeEstrelas = Number(args[2]);
        if (!alvoId || !Number.isFinite(quantidadeEstrelas)) throw new Error(`Use: \`${prefixo}banco emitir @usuario <quantidadeEstrelas>\``);

        const banco = await bank.emitir(userId, alvoId, quantidadeEstrelas);
        return this.send(data.channel_id, [CV2.container([
          CV2.text('🏦 **Moeda emitida**'),
          CV2.text(`Lastro restante: ${banco.saldoEstrelas.toLocaleString()} Estrelas`)
        ], { accentColor: ACCENT })]);
      }

      default:
        return this.send(data.channel_id, [CV2.container([
          CV2.text('🏦 **Banco do Servidor**'),
          CV2.text(
            `Subcomandos disponíveis:\n` +
            `\`${prefixo}banco saldo\`\n` +
            `\`${prefixo}banco depositar <quantidade>\`\n` +
            `\`${prefixo}banco transferir @usuario <quantidade>\`\n` +
            `\`${prefixo}banco emitir @usuario <quantidadeEstrelas>\` (administradores)`
          )
        ], { accentColor: ACCENT })]);
    }
  }

  async _loja(data, args, bank, userId) {
    const shop  = new ShopService(data.guild_id, { client: this.client, guildId: data.guild_id });
    const banco = await bank.getBanco();

    if (!banco) {
      return this.send(data.channel_id, [CV2.container([
        CV2.text('🛒 **Loja do Servidor**'),
        CV2.text('Esse servidor ainda não tem um Banco do Servidor, então a loja não está disponível.')
      ], { accentColor: ACCENT })]);
    }

    const categorias = await shop.listarCategorias();
    return this.send(data.channel_id, [await lojaCmd.buildPainelCategorias(this.client, userId, bank, shop, banco, categorias)]);
  }

  async _mercadoLocal(data, args, bank, userId, prefixo) {
    const market = new LocalMarketService(data.guild_id, { client: this.client, guildId: data.guild_id });
    const banco  = await bank.getBanco();

    if (!banco) {
      return this.send(data.channel_id, [CV2.container([
        CV2.text('🏪 **Mercado Local**'),
        CV2.text('Esse servidor ainda não tem um Banco do Servidor.')
      ], { accentColor: ACCENT })]);
    }

    const sub = (args[0] || 'listar').toLowerCase();

    switch (sub) {
      case 'vender': {
        const item = args[1];
        const quantidade = Number.parseInt(args[2], 10);
        const preco = Number.parseInt(args[3], 10);
        if (!item || !Number.isInteger(quantidade) || !Number.isInteger(preco))
          throw new Error(`Use: \`${prefixo}mercadolocal vender <item> <quantidade> <preco>\``);

        await market.vender(userId, item, quantidade, preco);
        return this.send(data.channel_id, [CV2.container([
          CV2.text('🏪 **Anúncio criado**'),
          CV2.text(`**${item}** x${quantidade} por ${mercadoLocalCmd.formatarMoeda(preco, banco.moeda)}/un.`)
        ], { accentColor: ACCENT })]);
      }

      case 'listar':
      default: {
        const anuncios = await market.listarVendas();
        return this.send(data.channel_id, [await mercadoLocalCmd.buildPainelListagem(this.client, userId, market, banco, anuncios)]);
      }
    }
  }
}

module.exports = PrefixEconomyManager;
