const UserGlobalSchema = require("../../Mongodb/userglobal.js");
const EconomyLog = require("../../Mongodb/economyLog.js");
const DiscordRequest = require("../DiscordRequest.js");
const MessageEmbed = require("../Messages/EmbedBuild.js");

const MAX_TRANSACOES = 100;

class Economy {

  constructor(userId) {
    this.userId = userId;
    this.logChannel = process.env.ECONOMY_LOG_CHANNEL_ID || "1522177412400676924";
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

  async _sendLog(logData) {
    if (logData.action === "get") return;

    await EconomyLog.create({
      userId:          logData.userId,
      action:           logData.action,
      previousBalance: logData.previousBalance,
      amount:           logData.amount,
      currentBalance:  logData.currentBalance,
      difference:       logData.difference,
      characters:       logData.characters,
      bannerId:         logData.bannerId ?? null,
    }).catch(err => console.error("[Economy] Falha ao persistir log:", err));

    if (!this.logChannel) return;

    const embed = new MessageEmbed()
      .setTitle("💰 Registro de Economia")
      .setColor(this._getColor(logData.action))
      .addField("👤 Usuário", `\`${logData.userId}\``, true)
      .addField("📌 Ação", `\`${this._formatAction(logData.action)}\``, true)
      .addField("💎 Quantidade", `\`${logData.amount}\``, true)
      .addField("📉 Saldo Anterior", `\`${logData.previousBalance}\``, true)
      .addField("📈 Saldo Atual", `\`${logData.currentBalance}\``, true)
      .addField("📊 Diferença", `\`${logData.difference}\``, true)
      .setTimestamp()
      .build();

    if (logData.characters?.length) {
      embed.fields = embed.fields || [];
      embed.fields.push({
        name: "🎴 Personagens",
        value: logData.characters.map(c => `${c.novo ? "🆕" : `C${c.constelacao}`} ${c.item} (${c.tipo}⭐)`).join("\n").slice(0, 1000),
        inline: false,
      });
    }

    await DiscordRequest(`/channels/${this.logChannel}/messages`, {
      method: "POST",
      body: {
        embeds: [embed]
      }
    }).catch(err => console.error("[Economy] Falha ao enviar log ao canal:", err));
  }

  _getColor(action) {
    switch (action) {
      case "add":
        return MessageEmbed.colors.Green;
      case "remove":
        return MessageEmbed.colors.Red;
      case "reset":
        return MessageEmbed.colors.Orange;
      case "banner_pull":
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
      case "banner_pull": return "Giro de Banner (Gacha)";
      case "daily": return "Recompensa Diária";
      case "transfer_send": return "Transferência Enviada";
      case "transfer_receive": return "Transferência Recebida";
      default: return action;
    }
  }

  _buildLog({ action, previous, amount, current, characters, bannerId }) {
    return {
      userId: this.userId,
      action,
      previousBalance: previous,
      amount,
      currentBalance: current,
      difference: current - previous,
      characters,
      bannerId,
      timestamp: Date.now()
    };
  }

  async getTotal() {
    const user = await this._getOrCreate();

    return this._buildLog({
      action: "get",
      previous: user.primogemas.atm,
      amount: 0,
      current: user.primogemas.atm
    });
  }

  async add(amount) {
    if (amount <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    const userBefore = await this._getOrCreate();
    const previous = userBefore.primogemas.atm;

    const updated = await UserGlobalSchema.findOneAndUpdate(
      { userId: this.userId },
      {
        $inc: { "primogemas.atm": amount },
        $push: {
          "primogemas.transacoes": {
            $each: [{
              type: "add",
              value: amount,
              date: Date.now()
            }],
            $slice: -MAX_TRANSACOES
          }
        }
      },
      { new: true }
    );

    const log = this._buildLog({
      action: "add",
      previous,
      amount,
      current: updated.primogemas.atm
    });

    await this._sendLog(log);
    return log;
  }

  async remove(amount) {
    if (amount <= 0)
      throw new Error("Quantidade deve ser maior que 0.");

    const userBefore = await this._getOrCreate();
    const previous = userBefore.primogemas.atm;

    const updated = await UserGlobalSchema.findOneAndUpdate(
      {
        userId: this.userId,
        "primogemas.atm": { $gte: amount }
      },
      {
        $inc: { "primogemas.atm": -amount },
        $push: {
          "primogemas.transacoes": {
            $each: [{
              type: "remove",
              value: amount,
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
      action: "remove",
      previous,
      amount,
      current: updated.primogemas.atm
    });

    await this._sendLog(log);
    return log;
  }

  async reset() {
    const userBefore = await this._getOrCreate();
    const previous = userBefore.primogemas.atm;

    const updated = await UserGlobalSchema.findOneAndUpdate(
      { userId: this.userId },
      {
        $set: {
          "primogemas.atm": 0,
          "primogemas.transacoes": []
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

  async save() {
    await this._getOrCreate();
    return true;
  }

  static async log({ userId, action, previous, amount, current, characters, bannerId }) {
    const instance = new Economy(userId);
    const logData = instance._buildLog({ action, previous, amount, current, characters, bannerId });
    await instance._sendLog(logData);
    return logData;
  }
}

module.exports = Economy;
