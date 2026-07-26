'use strict';

const UserGlobalSchema = require("../../Mongodb/userglobal.js");
const EconomyLog = require("../../Mongodb/economyLog.js");
const DiscordRequest = require("../DiscordRequest.js");
const MessageEmbed = require("../Messages/EmbedBuild.js");

const MAX_TRANSACOES = 100;
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

function avatarURL(user) {
  if (!user?.id) return DEFAULT_AVATAR;
  if (!user.avatar) return DEFAULT_AVATAR;
  const ext = user.avatar.startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
}

/**
 * Serviço central da economia da Ayami (Estrelas).
 * Toda movimentação de saldo global deve passar por esta classe,
 * garantindo log consistente (Mongo + canal de auditoria) e evitando saldo negativo.
 *
 * context (opcional, passado no construtor):
 *   - client:  instância do DiscordGatewayClient (usada para resolver ícone/nome do servidor)
 *   - guildId: id do servidor onde a ação foi originada (null se em DM)
 *   - actor:   { id, username, avatar } — quem executou a ação (ex: interaction.member.user)
 */
class Economy {

  constructor(userId, context = {}) {
    this.userId = userId;
    this.logChannel = process.env.ECONOMY_LOG_CHANNEL_ID || "1522177412400676924";
    this.context = context;
  }

  setContext(context) {
    this.context = { ...this.context, ...context };
    return this;
  }

  async _getOrCreate() {
    let user = await UserGlobalSchema.findOne({ userId: this.userId });

    if (!user) {
      user = await UserGlobalSchema.create({
        userId: this.userId
      });
    }

    return user;
  }

  async _resolveGuild() {
    const guildId = this.context?.guildId;
    if (!guildId) return null;

    const client = this.context?.client;
    if (!client?.guilds) return { id: guildId, name: null, iconURL: null };

    try {
      const guild = client.guilds.get(guildId) || await client.guilds.fetch(guildId);
      if (!guild) return { id: guildId, name: null, iconURL: null };

      return {
        id: guild.id,
        name: guild.name ?? null,
        iconURL: typeof guild.iconURL === "function" ? guild.iconURL() : null
      };
    } catch {
      return { id: guildId, name: null, iconURL: null };
    }
  }

  async _sendLog(logData) {
    if (logData.action === "get") return;

    const actor = this.context?.actor ?? null;
    const guild = await this._resolveGuild();

    await EconomyLog.create({
      userId:          logData.userId,
      action:          logData.action,
      previousBalance: logData.previousBalance,
      amount:          logData.amount,
      currentBalance:  logData.currentBalance,
      difference:      logData.difference,
      origin:          logData.origin ?? null,
      destination:     logData.destination ?? null,
      actorId:         actor?.id ?? logData.userId,
      guildId:         guild?.id ?? null,
      guildName:       guild?.name ?? null,
      metadata:        logData.metadata ?? null,
    }).catch(err => console.error("[Economy] Falha ao persistir log:", err));

    if (!this.logChannel) return;

    const embed = new MessageEmbed()
      .setTitle("⭐ Registro de Estrelas")
      .setColor(this._getColor(logData.action))
      .setAuthor(
        actor?.username ? `${actor.username} • ${actor.id}` : `Usuário • ${logData.userId}`,
        avatarURL(actor ?? { id: logData.userId })
      )
      .addField("👤 Conta afetada", `\`${logData.userId}\``, true)
      .addField("📌 Ação", `\`${this._formatAction(logData.action)}\``, true)
      .addField("⭐ Quantidade", `\`${logData.amount}\``, true)
      .addField("📉 Saldo Anterior", `\`${logData.previousBalance}\``, true)
      .addField("📈 Saldo Atual", `\`${logData.currentBalance}\``, true)
      .addField("📊 Diferença", `\`${logData.difference}\``, true)
      .addField("📝 O que mudou", this._describeChange(logData), false)
      .setTimestamp();

    if (guild?.id) {
      embed.setFooter(
        `${guild.name ?? "Servidor desconhecido"} • ${guild.id}`,
        guild.iconURL ?? null
      );
    } else {
      embed.setFooter("Mensagem Direta / fora de um servidor");
    }

    await DiscordRequest(`/channels/${this.logChannel}/messages`, {
      method: "POST",
      body: {
        embeds: [embed.build()]
      }
    }).catch(err => console.error("[Economy] Falha ao enviar log ao canal:", err));
  }

  _describeChange(logData) {
    const meta = logData.metadata ?? {};

    switch (logData.action) {
      case "add":
        return `Recebeu **+${logData.amount} Estrelas**${meta.motivo ? ` — ${meta.motivo}` : ""}.`;
      case "remove":
        return `Perdeu **-${logData.amount} Estrelas**${meta.motivo ? ` — ${meta.motivo}` : ""}.`;
      case "reset":
        return `Saldo resetado de **${logData.previousBalance}** para **0** Estrelas.`;
      case "daily":
        return `Resgatou a recompensa diária: **+${logData.amount} Estrelas**.`;
      case "transfer_send":
        return `Enviou **${logData.amount} Estrelas** para \`${meta.to ?? "?"}\`${meta.motivo ? ` — ${meta.motivo}` : ""}.`;
      case "transfer_receive":
        return `Recebeu **${logData.amount} Estrelas** de \`${meta.from ?? "?"}\`${meta.motivo ? ` — ${meta.motivo}` : ""}.`;
      case "mission_reward":
        return `Recompensa de missão: **+${logData.amount} Estrelas**${meta.label ? ` (${meta.label})` : ""}.`;
      case "level_reward":
        return `Recompensa de nível: **+${logData.amount} Estrelas**.`;
      default:
        return `Saldo alterado em **${logData.difference >= 0 ? "+" : ""}${logData.difference} Estrelas**.`;
    }
  }

  _getColor(action) {
    switch (action) {
      case "add":
        return MessageEmbed.colors.Green;
      case "remove":
        return MessageEmbed.colors.Red;
      case "reset":
        return MessageEmbed.colors.Orange;
      case "transfer_send":
      case "transfer_receive":
        return MessageEmbed.colors.DiscordBlurple;
      default:
        return MessageEmbed.colors.Gray;
    }
  }

  _formatAction(action) {
    switch (action) {
      case "add": return "Adição";
      case "remove": return "Remoção";
      case "reset": return "Reset";
      case "get": return "Consulta";
      case "daily": return "Recompensa Diária";
      case "transfer_send": return "Transferência Enviada";
      case "transfer_receive": return "Transferência Recebida";
      case "mission_reward": return "Recompensa de Missão";
      case "level_reward": return "Recompensa de Nível";
      default: return action;
    }
  }

  _buildLog({ action, previous, amount, current, origin, destination, metadata }) {
    return {
      userId: this.userId,
      action,
      previousBalance: previous,
      amount,
      currentBalance: current,
      difference: current - previous,
      origin,
      destination,
      metadata,
      timestamp: Date.now()
    };
  }

  async getTotal() {
    const user = await this._getOrCreate();

    return this._buildLog({
      action: "get",
      previous: user.estrelas.atm,
      amount: 0,
      current: user.estrelas.atm
    });
  }

  async _registrarProgressoMissao(acao, quantidade) {
    if (!this.context?.guildId) return;
    const Missions = require("./Missions.js");
    await Missions.progress(this.userId, this.context, acao, quantidade);
  }

  async add(amount, { action = "add", metadata = null } = {}) {
    if (amount <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    const userBefore = await this._getOrCreate();
    const previous = userBefore.estrelas.atm;

    const updated = await UserGlobalSchema.findOneAndUpdate(
      { userId: this.userId },
      {
        $inc: {
          "estrelas.atm": amount,
          "estatisticas.estrelasGanhasTotal": amount
        },
        $push: {
          "estrelas.transacoes": {
            $each: [{
              type: action,
              value: amount,
              date: Date.now()
            }],
            $slice: -MAX_TRANSACOES
          }
        }
      },
      { new: true, upsert: false }
    );

    const log = this._buildLog({
      action,
      previous,
      amount,
      current: updated.estrelas.atm,
      metadata
    });

    await this._sendLog(log);

    if (action !== 'missao_recompensa') {
      await this._registrarProgressoMissao('ganhar_estrelas', amount);
    }

    return log;
  }

  async remove(amount, { action = "remove", metadata = null } = {}) {
    if (amount <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    const userBefore = await this._getOrCreate();
    const previous = userBefore.estrelas.atm;

    const updated = await UserGlobalSchema.findOneAndUpdate(
      {
        userId: this.userId,
        "estrelas.atm": { $gte: amount }
      },
      {
        $inc: {
          "estrelas.atm": -amount,
          "estatisticas.estrelasGastasTotal": amount
        },
        $push: {
          "estrelas.transacoes": {
            $each: [{
              type: action,
              value: -amount,
              date: Date.now()
            }],
            $slice: -MAX_TRANSACOES
          }
        }
      },
      { new: true }
    );

    if (!updated)
      throw new Error("Saldo insuficiente.");

    const log = this._buildLog({
      action,
      previous,
      amount,
      current: updated.estrelas.atm,
      metadata
    });

    await this._sendLog(log);

    if (action !== 'transfer_send') {
      await this._registrarProgressoMissao('gastar_estrelas', amount);
    }

    return log;
  }

  async reset() {
    const userBefore = await this._getOrCreate();
    const previous = userBefore.estrelas.atm;

    const updated = await UserGlobalSchema.findOneAndUpdate(
      { userId: this.userId },
      {
        $set: {
          "estrelas.atm": 0,
          "estrelas.transacoes": []
        }
      },
      { new: true }
    );

    const log = this._buildLog({
      action: "reset",
      previous,
      amount: previous,
      current: 0
    });

    await this._sendLog(log);
    return log;
  }

  /**
   * Transfere Estrelas deste usuário para outro usuário.
   * Nunca cria saldo do nada — falha se o remetente não tiver saldo suficiente.
   * O contexto (actor/guild/client) do remetente é propagado ao log do destinatário,
   * para que fique registrado quem iniciou a transferência.
   */
  async transferTo(destinationUserId, amount, motivo = null) {
    if (amount <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    if (destinationUserId === this.userId)
      throw new Error("Não é possível transferir Estrelas para si mesmo.");

    await this.remove(amount, {
      action: "transfer_send",
      metadata: { motivo, to: destinationUserId }
    });

    const destination = new Economy(destinationUserId, this.context);

    try {
      await destination.add(amount, {
        action: "transfer_receive",
        metadata: { motivo, from: this.userId }
      });
    } catch (err) {
      // Rollback: se o crédito ao destinatário falhar, devolve ao remetente.
      await this.add(amount, {
        action: "add",
        metadata: { motivo: "rollback_transfer", to: destinationUserId }
      });
      throw err;
    }

    await this._registrarProgressoMissao('transferir_estrelas', amount);

    return { origin: this.userId, destination: destinationUserId, amount, motivo };
  }

  // ================================
  // Recursos (madeira, pedra, ferro, cristais, flores, livros, relíquias, cogumelos, poeira estelar)
  // ================================

  async addResource(nome, quantidade) {
    if (quantidade <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    await this._getOrCreate();

    const updated = await UserGlobalSchema.findOneAndUpdate(
      { userId: this.userId },
      { $inc: { [`recursos.${nome}`]: quantidade } },
      { new: true, upsert: false }
    );

    const Collections = require("./Collections.js");
    Collections.registrar(this.userId, 'recursos', nome);

    return updated.recursos.get(nome) ?? quantidade;
  }

  async removeResource(nome, quantidade) {
    if (quantidade <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    const user = await this._getOrCreate();
    const atual = user.recursos.get(nome) ?? 0;

    if (atual < quantidade)
      throw new Error(`Recurso insuficiente: ${nome}.`);

    const updated = await UserGlobalSchema.findOneAndUpdate(
      { userId: this.userId, [`recursos.${nome}`]: { $gte: quantidade } },
      { $inc: { [`recursos.${nome}`]: -quantidade } },
      { new: true }
    );

    if (!updated)
      throw new Error(`Recurso insuficiente: ${nome}.`);

    return updated.recursos.get(nome) ?? 0;
  }

  async getResources() {
    const user = await this._getOrCreate();
    return Object.fromEntries(user.recursos ?? []);
  }

  async hasBalance(amount) {
    if (!amount) return true;
    const user = await this._getOrCreate();
    return user.estrelas.atm >= amount;
  }

  async hasResources(custos = {}) {
    const atuais = await this.getResources();
    return Object.entries(custos).every(([nome, quantidade]) => (atuais[nome] ?? 0) >= quantidade);
  }

  async removeResources(custos = {}) {
    const entradas = Object.entries(custos).filter(([, quantidade]) => quantidade > 0);
    if (!entradas.length) return {};

    const atuais = await this.getResources();
    const faltando = entradas.filter(([nome, quantidade]) => (atuais[nome] ?? 0) < quantidade);

    if (faltando.length) {
      const detalhe = faltando
        .map(([nome, quantidade]) => `${nome} (precisa de ${quantidade}, tem ${atuais[nome] ?? 0})`)
        .join(', ');
      throw new Error(`Recursos insuficientes: ${detalhe}.`);
    }

    const resultado = {};
    for (const [nome, quantidade] of entradas) {
      resultado[nome] = await this.removeResource(nome, quantidade);
    }
    return resultado;
  }

  // ================================
  // Itens de inventário (produzidos na Oficina, obtidos na Exploração, etc.)
  // ================================

  async addItem(itemId, quantidade = 1) {
    if (quantidade <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    await this._getOrCreate();

    const jaExiste = await UserGlobalSchema.findOneAndUpdate(
      { userId: this.userId, "inventario.itens.itemId": itemId },
      { $inc: { "inventario.itens.$.quantidade": quantidade } },
      { new: true }
    );

    if (jaExiste) return jaExiste;

    return UserGlobalSchema.findOneAndUpdate(
      { userId: this.userId },
      {
        $push: {
          "inventario.itens": { itemId, quantidade, obtidoEm: Date.now() }
        }
      },
      { new: true, upsert: false }
    );
  }

  async removeItem(itemId, quantidade = 1) {
    if (quantidade <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    const user = await this._getOrCreate();
    const item = (user.inventario?.itens ?? []).find(i => i.itemId === itemId);

    if (!item || item.quantidade < quantidade)
      throw new Error(`Item insuficiente no inventário: ${itemId}.`);

    if (item.quantidade === quantidade) {
      await UserGlobalSchema.updateOne(
        { userId: this.userId },
        { $pull: { "inventario.itens": { itemId } } }
      );
      return 0;
    }

    await UserGlobalSchema.updateOne(
      { userId: this.userId, "inventario.itens.itemId": itemId },
      { $inc: { "inventario.itens.$.quantidade": -quantidade } }
    );

    return item.quantidade - quantidade;
  }

  async getItems() {
    const user = await this._getOrCreate();
    return user.inventario?.itens ?? [];
  }

  async getItemQuantidade(itemId) {
    const itens = await this.getItems();
    return itens.find(i => i.itemId === itemId)?.quantidade ?? 0;
  }

  async hasItems(custos = {}) {
    const entradas = Object.entries(custos).filter(([, quantidade]) => quantidade > 0);
    if (!entradas.length) return true;

    const itens = await this.getItems();
    const mapa = new Map(itens.map(i => [i.itemId, i.quantidade]));

    return entradas.every(([itemId, quantidade]) => (mapa.get(itemId) ?? 0) >= quantidade);
  }

  async removeItems(custos = {}) {
    const entradas = Object.entries(custos).filter(([, quantidade]) => quantidade > 0);
    if (!entradas.length) return {};

    if (!(await this.hasItems(custos))) {
      const itens = await this.getItems();
      const mapa = new Map(itens.map(i => [i.itemId, i.quantidade]));
      const faltando = entradas
        .filter(([itemId, quantidade]) => (mapa.get(itemId) ?? 0) < quantidade)
        .map(([itemId, quantidade]) => `${itemId} (precisa de ${quantidade}, tem ${mapa.get(itemId) ?? 0})`)
        .join(', ');
      throw new Error(`Itens insuficientes: ${faltando}.`);
    }

    const resultado = {};
    for (const [itemId, quantidade] of entradas) {
      resultado[itemId] = await this.removeItem(itemId, quantidade);
    }
    return resultado;
  }

  /**
   * Migra o saldo legado de "primogemas" (removido do schema, mas que pode
   * ainda existir em documentos antigos no MongoDB) para Estrelas.
   * Idempotente: uma vez migrado, marca `estrelas.migrado = true` e nunca repete.
   * Conversão 1:1 — nenhum valor é criado ou perdido.
   */
  async migrateLegacyPrimogemas() {
    const user = await this._getOrCreate();

    if (user.estrelas?.migrado) {
      return { migrated: false, reason: 'already_migrated', amount: 0 };
    }

    // Acesso via driver puro: o valor pode existir no banco mesmo sem estar no schema atual.
    const raw = await UserGlobalSchema.collection.findOne(
      { userId: this.userId },
      { projection: { primogemas: 1 } }
    );

    const legacyAmount = raw?.primogemas?.atm ?? 0;

    if (!legacyAmount || legacyAmount <= 0) {
      await UserGlobalSchema.updateOne(
        { userId: this.userId },
        { $set: { 'estrelas.migrado': true }, $unset: { primogemas: '' } }
      );
      return { migrated: false, reason: 'nothing_to_migrate', amount: 0 };
    }

    await this.add(legacyAmount, {
      action: 'add',
      metadata: { motivo: 'migracao_primogemas' }
    });

    await UserGlobalSchema.updateOne(
      { userId: this.userId },
      { $set: { 'estrelas.migrado': true }, $unset: { primogemas: '' } }
    );

    return { migrated: true, reason: 'ok', amount: legacyAmount };
  }

  static async log({ userId, action, previous, amount, current, origin, destination, metadata }, context = {}) {
    const instance = new Economy(userId, context);
    const logData = instance._buildLog({ action, previous, amount, current, origin, destination, metadata });
    await instance._sendLog(logData);
    return logData;
  }
}

module.exports = Economy;
