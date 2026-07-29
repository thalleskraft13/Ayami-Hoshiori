'use strict';

const LocalMarketListingDb = require("../../Mongodb/localMarketListing.js");
const ShopUserItemDb        = require("../../Mongodb/shopUserItem.js");
const BankService             = require("../Banco/BankService.js");

class LocalMarketService {

  constructor(guildId, context = {}) {
    this.guildId = guildId;
    this.context = context;
    this.bank = new BankService(guildId, context);
  }

  async _itemDisponivel(userId, itemNome) {
    const entrada = await ShopUserItemDb.findOne({ guildId: this.guildId, userId, itemNome });
    return entrada?.quantidade ?? 0;
  }

  async vender(sellerId, itemNome, quantidade, precoUnitario) {
    await this.bank.requireBanco();

    if (!Number.isInteger(quantidade) || quantidade <= 0)
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");
    if (!Number.isInteger(precoUnitario) || precoUnitario <= 0)
      throw new Error("Preço unitário deve ser um número inteiro maior que 0.");

    const disponivel = await this._itemDisponivel(sellerId, itemNome);
    if (disponivel < quantidade)
      throw new Error(`Você só tem **${disponivel}** unidade(s) de "${itemNome}".`);

    await ShopUserItemDb.updateOne(
      { guildId: this.guildId, userId: sellerId, itemNome },
      { $inc: { quantidade: -quantidade } }
    );

    return LocalMarketListingDb.create({
      guildId: this.guildId, sellerId, itemNome, quantidade, precoUnitario
    });
  }

  async cancelarVenda(sellerId, listingId) {
    const listing = await LocalMarketListingDb.findOne({ guildId: this.guildId, _id: listingId, ativo: true });
    if (!listing) throw new Error("Esse anúncio não existe ou já foi encerrado.");
    if (listing.sellerId !== sellerId) throw new Error("Esse anúncio não é seu.");

    await ShopUserItemDb.updateOne(
      { guildId: this.guildId, userId: sellerId, itemNome: listing.itemNome },
      { $inc: { quantidade: listing.quantidade } },
      { upsert: true }
    );

    listing.ativo = false;
    await listing.save();
    return listing;
  }

  async listarVendas({ itemNome = null } = {}) {
    await this.bank.requireBanco();
    const filtro = { guildId: this.guildId, ativo: true, quantidade: { $gt: 0 } };
    if (itemNome) filtro.itemNome = itemNome;
    return LocalMarketListingDb.find(filtro).sort({ precoUnitario: 1 }).limit(25);
  }

  async comprar(buyerId, listingId, quantidade) {
    const banco = await this.bank.requireBanco();

    if (!Number.isInteger(quantidade) || quantidade <= 0)
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");

    const listing = await LocalMarketListingDb.findOne({ guildId: this.guildId, _id: listingId, ativo: true });
    if (!listing) throw new Error("Esse anúncio não existe ou já foi encerrado.");
    if (listing.sellerId === buyerId) throw new Error("Você não pode comprar seu próprio anúncio.");
    if (listing.quantidade < quantidade)
      throw new Error(`Esse anúncio só tem **${listing.quantidade}** unidade(s) disponível(is).`);

    const total       = listing.precoUnitario * quantidade;
    const taxaPct      = banco.impostos?.mercado ?? 0;
    const imposto      = Math.floor(total * (taxaPct / 100));
    const liquido       = total - imposto;

    await this.bank.gastarLocal(buyerId, total, `compra_mercado_local:${listing.itemNome}`, { listingId: String(listing._id), quantidade });
    await this.bank.creditarLocal(listing.sellerId, liquido, `venda_mercado_local:${listing.itemNome}`, { listingId: String(listing._id), quantidade });
    if (imposto > 0) await this.bank.arrecadarImposto(imposto, 'imposto_mercado_local', { listingId: String(listing._id) });

    await ShopUserItemDb.updateOne(
      { guildId: this.guildId, userId: buyerId, itemNome: listing.itemNome },
      { $inc: { quantidade } },
      { upsert: true }
    );

    listing.quantidade -= quantidade;
    if (listing.quantidade <= 0) listing.ativo = false;
    await listing.save();

    return { listing, quantidade, total, imposto, liquido };
  }
}

module.exports = LocalMarketService;
