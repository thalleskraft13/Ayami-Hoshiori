'use strict';

const ShopCategoryDb = require("../../Mongodb/shopCategory.js");
const ShopProductDb  = require("../../Mongodb/shopProduct.js");
const ShopUserItemDb = require("../../Mongodb/shopUserItem.js");
const BankService     = require("../Banco/BankService.js");
const DiscordRequest  = require("../DiscordRequest.js");

class ShopService {

  constructor(guildId, context = {}) {
    this.guildId = guildId;
    this.context = context;
    this.bank = new BankService(guildId, context);
  }

  async listarCategorias() {
    await this.bank.requireBanco();
    return ShopCategoryDb.find({ guildId: this.guildId }).sort({ ordem: 1, criadoEm: 1 });
  }

  async criarCategoria(actorId, nome) {
    await this.bank.requireBanco();
    if (!nome?.trim()) throw new Error("Informe um nome para a categoria.");

    const total = await ShopCategoryDb.countDocuments({ guildId: this.guildId });
    return ShopCategoryDb.create({ guildId: this.guildId, nome: nome.trim().slice(0, 100), ordem: total });
  }

  async removerCategoria(actorId, categoriaId) {
    await this.bank.requireBanco();
    await ShopProductDb.deleteMany({ guildId: this.guildId, categoriaId });
    return ShopCategoryDb.deleteOne({ guildId: this.guildId, _id: categoriaId });
  }

  async moverCategoria(actorId, categoriaId, direcao) {
    await this.bank.requireBanco();
    const categorias = await this.listarCategorias();
    const idx = categorias.findIndex(c => String(c._id) === String(categoriaId));
    if (idx === -1) throw new Error("Categoria não encontrada.");

    const alvo = direcao === 'up' ? idx - 1 : idx + 1;
    if (alvo < 0 || alvo >= categorias.length) return categorias;

    const a = categorias[idx];
    const b = categorias[alvo];
    const ordemA = a.ordem;
    a.ordem = b.ordem;
    b.ordem = ordemA;
    await a.save();
    await b.save();

    return this.listarCategorias();
  }

  async listarProdutos(categoriaId) {
    await this.bank.requireBanco();
    return ShopProductDb.find({ guildId: this.guildId, categoriaId }).sort({ ordem: 1, criadoEm: 1 });
  }

  async getProduto(produtoId) {
    await this.bank.requireBanco();
    return ShopProductDb.findOne({ guildId: this.guildId, _id: produtoId });
  }

  async criarProduto(actorId, categoriaId, dados = {}) {
    await this.bank.requireBanco();

    const categoria = await ShopCategoryDb.findOne({ guildId: this.guildId, _id: categoriaId });
    if (!categoria) throw new Error("Categoria não encontrada.");

    if (!dados.nome?.trim()) throw new Error("Informe um nome para o produto.");
    if (!Number.isFinite(dados.preco) || dados.preco < 0) throw new Error("Preço inválido.");

    const total = await ShopProductDb.countDocuments({ guildId: this.guildId, categoriaId });

    return ShopProductDb.create({
      guildId: this.guildId,
      categoriaId,
      nome: dados.nome.trim().slice(0, 100),
      descricao: (dados.descricao || '').trim().slice(0, 500),
      imagem: dados.imagem || null,
      preco: dados.preco,
      estoque: Number.isFinite(dados.estoque) ? dados.estoque : null,
      cargosEntregues: dados.cargosEntregues || [],
      itensEntregues: dados.itensEntregues || [],
      ordem: total
    });
  }

  async editarProduto(actorId, produtoId, patch = {}) {
    await this.bank.requireBanco();
    const produto = await ShopProductDb.findOne({ guildId: this.guildId, _id: produtoId });
    if (!produto) throw new Error("Produto não encontrado.");

    if (patch.nome !== undefined) produto.nome = String(patch.nome).slice(0, 100);
    if (patch.descricao !== undefined) produto.descricao = String(patch.descricao).slice(0, 500);
    if (patch.imagem !== undefined) produto.imagem = patch.imagem || null;
    if (patch.preco !== undefined && Number.isFinite(patch.preco) && patch.preco >= 0) produto.preco = patch.preco;
    if (patch.estoque !== undefined) produto.estoque = Number.isFinite(patch.estoque) ? patch.estoque : null;
    if (patch.cargosEntregues !== undefined) produto.cargosEntregues = patch.cargosEntregues;
    if (patch.itensEntregues !== undefined) produto.itensEntregues = patch.itensEntregues;
    if (patch.ativo !== undefined) produto.ativo = !!patch.ativo;

    await produto.save();
    return produto;
  }

  async removerProduto(actorId, produtoId) {
    await this.bank.requireBanco();
    return ShopProductDb.deleteOne({ guildId: this.guildId, _id: produtoId });
  }

  async moverProduto(actorId, produtoId, direcao) {
    await this.bank.requireBanco();
    const produto = await ShopProductDb.findOne({ guildId: this.guildId, _id: produtoId });
    if (!produto) throw new Error("Produto não encontrado.");

    const produtos = await this.listarProdutos(produto.categoriaId);
    const idx = produtos.findIndex(p => String(p._id) === String(produtoId));
    const alvo = direcao === 'up' ? idx - 1 : idx + 1;
    if (alvo < 0 || alvo >= produtos.length) return produtos;

    const a = produtos[idx];
    const b = produtos[alvo];
    const ordemA = a.ordem;
    a.ordem = b.ordem;
    b.ordem = ordemA;
    await a.save();
    await b.save();

    return this.listarProdutos(produto.categoriaId);
  }

  async comprar(userId, produtoId, quantidade = 1) {
    await this.bank.requireBanco();

    if (!Number.isInteger(quantidade) || quantidade <= 0)
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");

    const produto = await ShopProductDb.findOne({ guildId: this.guildId, _id: produtoId });
    if (!produto || !produto.ativo) throw new Error("Esse produto não está disponível.");

    if (produto.estoque !== null && produto.estoque < quantidade)
      throw new Error(`Estoque insuficiente. Disponível: ${produto.estoque}.`);

    const total = produto.preco * quantidade;

    await this.bank.gastarLocal(userId, total, `compra_loja:${produto.nome}`, {
      produtoId: String(produto._id),
      quantidade
    });

    if (produto.estoque !== null) {
      produto.estoque -= quantidade;
      await produto.save();
    }

    for (const cargoId of produto.cargosEntregues) {
      await DiscordRequest(`/guilds/${this.guildId}/members/${userId}/roles/${cargoId}`, { method: 'PUT' })
        .catch(err => console.error('[ShopService] Falha ao entregar cargo:', err));
    }

    for (const item of produto.itensEntregues) {
      await ShopUserItemDb.updateOne(
        { guildId: this.guildId, userId, itemNome: item.nome },
        { $inc: { quantidade: item.quantidade * quantidade } },
        { upsert: true }
      );
    }

    const runner = this.context?.client?.logicScriptRunner;
    if (runner) {
      runner.emitCustomEvent(this.guildId, 'shopPurchase', {
        customData: { guildId: this.guildId, userId, produtoId: String(produto._id), nome: produto.nome, quantidade, total }
      }).catch(err => console.error('[ShopService] Falha ao emitir \'shopPurchase\':', err.message));
    }

    return { produto, total };
  }

  async inventario(userId) {
    return ShopUserItemDb.find({ guildId: this.guildId, userId, quantidade: { $gt: 0 } });
  }

  async quantidadeItem(userId, itemNome) {
    const entrada = await ShopUserItemDb.findOne({ guildId: this.guildId, userId, itemNome });
    return entrada?.quantidade ?? 0;
  }
}

module.exports = ShopService;
