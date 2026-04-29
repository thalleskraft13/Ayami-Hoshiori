const personagens = require("./personagens.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");
const PremiumManager = require("../Utils/PremiumManager.js");

class GachaSystem {
    constructor(config) {
        this.config = config;
    }

    _chance(p) {
        return Math.random() < p;
    }

    _pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    _get5StarChance(pity) {
        if (pity < 74) return 0.006;
        const extra = (pity - 73) * 0.06;
        return Math.min(0.006 + extra, 1);
    }

    _is4Star(pity4) {
        if (pity4 >= 9) return true;
        return this._chance(0.051);
    }

    _addCharacter(userData, personagem, raridade) {
        if (!userData.personagens)
            userData.personagens = [];

        let char = userData.personagens.find(p => p.nome === personagem);

        if (!char) {
            userData.personagens.push({
                nome: personagem,
                raridade,
                constelacao: 0
            });

            return {
                novo: true,
                constelacao: 0
            };
        }

        if (char.constelacao < 6) {
            char.constelacao++;

            return {
                novo: false,
                constelacao: char.constelacao
            };
        }

        return {
            novo: false,
            constelacao: 6,
            excedente: true
        };
    }

    pull(userData, bannerId = 0) {
        let result;

        if (bannerId === 2)
            result = this._pullMochileiro(userData);
        else
            result = this._pullLimited(userData, bannerId);

        if (result.tipo !== 3) {
            const inv = this._addCharacter(
                userData,
                result.item,
                result.tipo
            );

            result.inventario = inv;
        }

        return result;
    }

    _pullLimited(userData, bannerId) {
        const banner = userData.primogemas.bannerlimitado;

        banner.pityt5++;
        banner.pityt4++;

        const featured5 = this.config.banners.atual.t5[bannerId];
        const featured4 = this.config.banners.atual.t4;

        let result = {
            tipo: null,
            item: null,
            banner: bannerId,
            garantido: false
        };

        const chance5 = this._get5StarChance(banner.pityt5);

        if (banner.pityt5 >= 90 || this._chance(chance5)) {
            banner.pityt5 = 0;
            banner.pityt4 = 0;

            result.tipo = 5;

            if (banner.garantidot5) {
                result.item = featured5;
                result.garantido = true;
                banner.garantidot5 = false;
            } else {
                if (this._chance(0.5)) {
                    result.item = featured5;
                } else {
                    result.item = this._pick(this.config.banners.mochileiro.t5);
                    banner.garantidot5 = true;
                }
            }

            return result;
        }

        if (this._is4Star(banner.pityt4)) {
            banner.pityt4 = 0;
            result.tipo = 4;

            if (banner.garantidot4) {
                result.item = this._pick(featured4);
                result.garantido = true;
                banner.garantidot4 = false;
            } else {
                if (this._chance(0.5)) {
                    result.item = this._pick(featured4);
                } else {
                    result.item = this._pick(this.config.banners.mochileiro.t4);
                    banner.garantidot4 = true;
                }
            }

            return result;
        }

        result.tipo = 3;
        result.item = "Arma 3";

        return result;
    }

    _pullMochileiro(userData) {
        const banner = userData.primogemas.mochileiro;

        banner.pityt5++;
        banner.pityt4++;

        let result = {
            tipo: null,
            item: null,
            banner: 2
        };

        const chance5 = this._get5StarChance(banner.pityt5);

        if (banner.pityt5 >= 90 || this._chance(chance5)) {
            banner.pityt5 = 0;
            banner.pityt4 = 0;

            result.tipo = 5;
            result.item = this._pick(this.config.banners.mochileiro.t5);

            return result;
        }

        if (this._is4Star(banner.pityt4)) {
            banner.pityt4 = 0;

            result.tipo = 4;
            result.item = this._pick(this.config.banners.mochileiro.t4);

            return result;
        }

        result.tipo = 3;
        result.item = "Arma 3";

        return result;
    }

    async multi(userData, bannerId, amount = 10) {
        const results = [];
        let has4 = false;
        let fiveStars = 0;

        for (let i = 0; i < amount; i++) {
            const res = this.pull(userData, bannerId);

            if (res.tipo === 4 || res.tipo === 5)
                has4 = true;

            if (res.tipo === 5)
                fiveStars++;

            results.push(res);
        }

        if (!has4) {
            const last = results[results.length - 1];

            last.tipo = 4;
            last.item = bannerId === 2
                ? this._pick(this.config.banners.mochileiro.t4)
                : this._pick(this.config.banners.atual.t4);

            const inv = this._addCharacter(userData, last.item, 4);
            last.inventario = inv;
        }

        if (fiveStars <= 1) {
            const premium = await PremiumManager.getUserPremium(userData.userId);
            const chanceExtra = premium.status ? (7 / 20) : (2 / 20);

            if (this._chance(chanceExtra)) {
                let extra;

                if (bannerId === 2) {
                    extra = {
                        tipo: 5,
                        item: this._pick(this.config.banners.mochileiro.t5),
                        banner: 2
                    };
                } else {
                    const featured5 = this.config.banners.atual.t5[bannerId];

                    if (this._chance(0.5)) {
                        extra = {
                            tipo: 5,
                            item: featured5,
                            banner: bannerId
                        };
                    } else {
                        extra = {
                            tipo: 5,
                            item: this._pick(this.config.banners.mochileiro.t5),
                            banner: bannerId
                        };
                    }
                }

                const inv = this._addCharacter(userData, extra.item, 5);
                extra.inventario = inv;

                results.push(extra);
            }
        }

        return results;
    }
}

module.exports = GachaSystem;