'use strict';

const MarketListingDb = require("../../Mongodb/marketListing.js");
const AuctionDb       = require("../../Mongodb/auction.js");
const TradeDb         = require("../../Mongodb/trade.js");
const Economy         = require("./Economy.js");
const Missions        = require("./Missions.js");

const DURACAO_LEILAO_MIN_MINUTOS = 10;
const DURACAO_LEILAO_MAX_MINUTOS = 7 * 24 * 60;

class Market {

  constructor(userId, context = {}) {
    this.userId = userId;
    this.context = context;
  }

  async vender(itemId, quantidade, precoUnitario) {
    if (!Number.isInteger(quantidade) || quantidade <= 0)
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");

    if (!Number.isInteger(precoUnitario) || precoUnitario <= 0)
      throw new Error("Preço unitário deve ser um número inteiro maior que 0.");

    const economy = new Economy(this.userId, this.context);
    await economy.removeItem(itemId, quantidade);

    const listing = await MarketListingDb.create({
      sellerId: this.userId,
      itemId,
      quantidade,
      precoUnitario
    });

    await Missions.progress(this.userId, this.context, 'vender', quantidade);

    return listing;
  }

  async cancelarVenda(listingId) {
    const listing = await MarketListingDb.findOne({ _id: listingId, ativo: true });
    if (!listing)
      throw new Error("Esse anúncio não existe ou já foi encerrado.");

    if (listing.sellerId !== this.userId)
      throw new Error("Esse anúncio não é seu.");

    const economy = new Economy(this.userId, this.context);
    await economy.addItem(listing.itemId, listing.quantidade);

    listing.ativo = false;
    await listing.save();

    return listing;
  }

  async listarVendas({ itemId = null } = {}) {
    const filtro = { ativo: true, quantidade: { $gt: 0 } };
    if (itemId) filtro.itemId = itemId;

    return MarketListingDb.find(filtro).sort({ precoUnitario: 1 }).limit(25);
  }

  async comprar(listingId, quantidade) {
    if (!Number.isInteger(quantidade) || quantidade <= 0)
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");

    const listing = await MarketListingDb.findOne({ _id: listingId, ativo: true });
    if (!listing)
      throw new Error("Esse anúncio não existe ou já foi encerrado.");

    if (listing.sellerId === this.userId)
      throw new Error("Você não pode comprar seu próprio anúncio.");

    if (listing.quantidade < quantidade)
      throw new Error(`Esse anúncio só tem **${listing.quantidade}** unidade(s) disponível(is).`);

    const total = listing.precoUnitario * quantidade;
    const buyerEconomy = new Economy(this.userId, this.context);

    if (!(await buyerEconomy.hasBalance(total)))
      throw new Error(`Estrelas insuficientes. Você precisa de **${total}** Estrelas.`);

    await buyerEconomy.transferTo(listing.sellerId, total, `Compra no Mercado: ${listing.itemId}`);
    await buyerEconomy.addItem(listing.itemId, quantidade);

    listing.quantidade -= quantidade;
    if (listing.quantidade <= 0) listing.ativo = false;
    await listing.save();

    await Missions.progress(this.userId, this.context, 'comprar', quantidade);

    return { listing, quantidade, total };
  }

  autocompleteVendas(textoDigitado = '') {
    const busca = (textoDigitado ?? '').toLowerCase();
    return MarketListingDb.find({ ativo: true, quantidade: { $gt: 0 }, itemId: { $regex: busca, $options: 'i' } })
      .sort({ precoUnitario: 1 })
      .limit(25)
      .then(listagens => listagens.map(l => ({
        name: `${l.itemId} x${l.quantidade} — ${l.precoUnitario} Estrelas/un`,
        value: String(l._id)
      })));
  }

  async criarLeilao(itemId, quantidade, lanceMinimo, duracaoMinutos) {
    if (!Number.isInteger(quantidade) || quantidade <= 0)
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");

    if (!Number.isInteger(lanceMinimo) || lanceMinimo <= 0)
      throw new Error("Lance mínimo deve ser um número inteiro maior que 0.");

    const duracao = Math.min(Math.max(duracaoMinutos ?? 60, DURACAO_LEILAO_MIN_MINUTOS), DURACAO_LEILAO_MAX_MINUTOS);

    const economy = new Economy(this.userId, this.context);
    await economy.removeItem(itemId, quantidade);

    const leilao = await AuctionDb.create({
      sellerId: this.userId,
      itemId,
      quantidade,
      lanceMinimo,
      terminaEm: Date.now() + duracao * 60 * 1000
    });

    return leilao;
  }

  async listarLeiloes() {
    const ativos = await AuctionDb.find({ finalizado: false, cancelado: false }).sort({ terminaEm: 1 }).limit(25);
    for (const leilao of ativos) {
      await this._finalizarSeExpirado(leilao);
    }
    return AuctionDb.find({ finalizado: false, cancelado: false }).sort({ terminaEm: 1 }).limit(25);
  }

  async darLance(leilaoId, valor) {
    if (!Number.isInteger(valor) || valor <= 0)
      throw new Error("O lance deve ser um número inteiro maior que 0.");

    const leilao = await AuctionDb.findOne({ _id: leilaoId });
    if (!leilao)
      throw new Error("Esse leilão não existe.");

    await this._finalizarSeExpirado(leilao);

    if (leilao.finalizado || leilao.cancelado)
      throw new Error("Esse leilão já foi encerrado.");

    if (leilao.sellerId === this.userId)
      throw new Error("Você não pode dar lance no seu próprio leilão.");

    const pisoMinimo = leilao.lanceAtual > 0 ? leilao.lanceAtual + 1 : leilao.lanceMinimo;
    if (valor < pisoMinimo)
      throw new Error(`O lance precisa ser de pelo menos **${pisoMinimo}** Estrelas.`);

    const bidderEconomy = new Economy(this.userId, this.context);
    if (!(await bidderEconomy.hasBalance(valor)))
      throw new Error(`Estrelas insuficientes. Você precisa de **${valor}** Estrelas.`);

    await bidderEconomy.remove(valor, {
      action: 'remove',
      metadata: { motivo: `Lance em leilão: ${leilao.itemId}` }
    });

    if (leilao.licitanteAtualId) {
      const anteriorEconomy = new Economy(leilao.licitanteAtualId, this.context);
      await anteriorEconomy.add(leilao.lanceAtual, {
        action: 'add',
        metadata: { motivo: `Lance superado em leilão: ${leilao.itemId}` }
      });
    }

    leilao.lanceAtual = valor;
    leilao.licitanteAtualId = this.userId;
    await leilao.save();

    return leilao;
  }

  async _finalizarSeExpirado(leilao) {
    if (leilao.finalizado || leilao.cancelado) return leilao;
    if (Date.now() < leilao.terminaEm) return leilao;

    if (leilao.licitanteAtualId) {
      const winnerEconomy = new Economy(leilao.licitanteAtualId, this.context);
      await winnerEconomy.addItem(leilao.itemId, leilao.quantidade);

      const sellerEconomy = new Economy(leilao.sellerId, this.context);
      await sellerEconomy.add(leilao.lanceAtual, {
        action: 'add',
        metadata: { motivo: `Leilão vendido: ${leilao.itemId}` }
      });
    } else {
      const sellerEconomy = new Economy(leilao.sellerId, this.context);
      await sellerEconomy.addItem(leilao.itemId, leilao.quantidade);
    }

    leilao.finalizado = true;
    await leilao.save();
    return leilao;
  }

  autocompleteLeiloes(textoDigitado = '') {
    const busca = (textoDigitado ?? '').toLowerCase();
    return AuctionDb.find({ finalizado: false, cancelado: false, itemId: { $regex: busca, $options: 'i' } })
      .sort({ terminaEm: 1 })
      .limit(25)
      .then(leiloes => leiloes.map(l => ({
        name: `${l.itemId} x${l.quantidade} — lance atual ${l.lanceAtual || l.lanceMinimo} Estrelas`,
        value: String(l._id)
      })));
  }

  async propor(alvoId, itensProponente = [], itensAlvo = [], estrelasProponente = 0, estrelasAlvo = 0) {
    if (alvoId === this.userId)
      throw new Error("Você não pode propor uma troca para si mesmo.");

    const economy = new Economy(this.userId, this.context);

    if (estrelasProponente > 0 && !(await economy.hasBalance(estrelasProponente)))
      throw new Error(`Estrelas insuficientes para oferecer **${estrelasProponente}** Estrelas.`);

    for (const { itemId, quantidade } of itensProponente) {
      if (!(await economy.hasItems({ [itemId]: quantidade })))
        throw new Error(`Você não tem **${quantidade}x ${itemId}** para oferecer.`);
    }

    for (const { itemId, quantidade } of itensProponente) {
      await economy.removeItem(itemId, quantidade);
    }
    if (estrelasProponente > 0) {
      await economy.remove(estrelasProponente, { action: 'remove', metadata: { motivo: `Troca proposta para ${alvoId}` } });
    }

    return TradeDb.create({
      proponenteId: this.userId,
      alvoId,
      itensProponente,
      itensAlvo,
      estrelasProponente,
      estrelasAlvo
    });
  }

  async aceitar(tradeId) {
    const trade = await TradeDb.findOne({ _id: tradeId, status: 'pendente' });
    if (!trade)
      throw new Error("Essa proposta de troca não existe ou já foi resolvida.");

    if (trade.alvoId !== this.userId)
      throw new Error("Essa proposta de troca não é para você.");

    const alvoEconomy = new Economy(this.userId, this.context);

    if (trade.estrelasAlvo > 0 && !(await alvoEconomy.hasBalance(trade.estrelasAlvo)))
      throw new Error(`Estrelas insuficientes. Você precisa de **${trade.estrelasAlvo}** Estrelas para aceitar.`);

    if (!(await alvoEconomy.hasItems(Object.fromEntries(trade.itensAlvo.map(i => [i.itemId, i.quantidade])))))
      throw new Error("Você não tem os itens necessários para aceitar essa troca.");

    for (const { itemId, quantidade } of trade.itensAlvo) {
      await alvoEconomy.removeItem(itemId, quantidade);
    }
    if (trade.estrelasAlvo > 0) {
      await alvoEconomy.remove(trade.estrelasAlvo, { action: 'remove', metadata: { motivo: `Troca aceita com ${trade.proponenteId}` } });
    }

    const proponenteEconomy = new Economy(trade.proponenteId, this.context);

    for (const { itemId, quantidade } of trade.itensAlvo) {
      await proponenteEconomy.addItem(itemId, quantidade);
    }
    if (trade.estrelasAlvo > 0) {
      await proponenteEconomy.add(trade.estrelasAlvo, { action: 'add', metadata: { motivo: `Troca aceita por ${this.userId}` } });
    }

    for (const { itemId, quantidade } of trade.itensProponente) {
      await alvoEconomy.addItem(itemId, quantidade);
    }
    if (trade.estrelasProponente > 0) {
      await alvoEconomy.add(trade.estrelasProponente, { action: 'add', metadata: { motivo: `Troca aceita, recebido de ${trade.proponenteId}` } });
    }

    trade.status = 'aceito';
    trade.resolvidoEm = Date.now();
    await trade.save();

    await Missions.progress(this.userId, this.context, 'trocar', 1);
    await Missions.progress(trade.proponenteId, this.context, 'trocar', 1);

    return trade;
  }

  async _devolverEscrow(trade) {
    const proponenteEconomy = new Economy(trade.proponenteId, this.context);
    for (const { itemId, quantidade } of trade.itensProponente) {
      await proponenteEconomy.addItem(itemId, quantidade);
    }
    if (trade.estrelasProponente > 0) {
      await proponenteEconomy.add(trade.estrelasProponente, { action: 'add', metadata: { motivo: 'Troca não concluída' } });
    }
  }

  async recusar(tradeId) {
    const trade = await TradeDb.findOne({ _id: tradeId, status: 'pendente' });
    if (!trade)
      throw new Error("Essa proposta de troca não existe ou já foi resolvida.");

    if (trade.alvoId !== this.userId)
      throw new Error("Essa proposta de troca não é para você.");

    await this._devolverEscrow(trade);

    trade.status = 'recusado';
    trade.resolvidoEm = Date.now();
    await trade.save();

    return trade;
  }

  async cancelar(tradeId) {
    const trade = await TradeDb.findOne({ _id: tradeId, status: 'pendente' });
    if (!trade)
      throw new Error("Essa proposta de troca não existe ou já foi resolvida.");

    if (trade.proponenteId !== this.userId)
      throw new Error("Essa proposta de troca não é sua.");

    await this._devolverEscrow(trade);

    trade.status = 'cancelado';
    trade.resolvidoEm = Date.now();
    await trade.save();

    return trade;
  }

  async listarPendentes() {
    return TradeDb.find({
      status: 'pendente',
      $or: [{ proponenteId: this.userId }, { alvoId: this.userId }]
    }).sort({ criadoEm: -1 }).limit(25);
  }

  _resumoOferta(trade) {
    const itens = trade.itensProponente.map(i => `${i.quantidade}x ${i.itemId}`);
    if (trade.estrelasProponente > 0) itens.push(`${trade.estrelasProponente} Estrelas`);
    return itens.join(', ') || "nada";
  }

  async autocompletePendentesRecebidas() {
    const trades = await TradeDb.find({ status: 'pendente', alvoId: this.userId }).sort({ criadoEm: -1 }).limit(25);
    return trades.map(t => ({
      name: `De ${t.proponenteId} — oferece: ${this._resumoOferta(t)}`.slice(0, 100),
      value: String(t._id)
    }));
  }

  async autocompletePendentesEnviadas() {
    const trades = await TradeDb.find({ status: 'pendente', proponenteId: this.userId }).sort({ criadoEm: -1 }).limit(25);
    return trades.map(t => ({
      name: `Para ${t.alvoId} — oferece: ${this._resumoOferta(t)}`.slice(0, 100),
      value: String(t._id)
    }));
  }
}

module.exports = Market;
