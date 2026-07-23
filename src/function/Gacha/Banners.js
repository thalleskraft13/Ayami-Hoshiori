const PremiumManager = require("../Utils/PremiumManager.js");
const { BASE_FIVE_STAR_EXTRA_CHANCE } = require("../Utils/PremiumPlans.js");


const ARMAS_3 = [
    "Espada de Ferro", "Espada Fria", "Espada Harpe", "Lâmina Filosa",
    "Espada do Viajante", "Lâmina Prateada",
    "Espadão Sem Corte", "Pacifista", "Debate Club", "Espada Feisbane",
    "Lâmina Blanc", "Espadão Feroce",
    "Lança Haste de Junco", "Lança de Ferro Negro", "Lança Negra",
    "Dardo de Chumbo", "Lança Borla Branca",
    "Arco de Recurvo", "Arco Sling", "Arco Sharpshooter's Oath",
    "Arco Raven Bow", "Arco Messenger", "Arco Ebony Bow",
    "Amuleto de Âmbar", "Orbe Mágico", "Olho da Percepção",
    "Twiddle Fingers", "Catalisador Thrilling Tales", "Magic Guide"
];

const ARMAS_4 = [
    "A Espada Negra", "Lâmina para o Céu", "Íris Sacrificial",
    "Flauta", "Lionroar", "Espada da Ferrugem",
    "Espada Festiva do Dragão", "Espada do Favonius",
    "Serpent Spine", "Blackcliff Slasher", "Rainslasher",
    "Sacrificial Greatsword", "Whiteblind", "Espadão do Favonius",
    "Luxurious Sea-Lord",
    "Deathmatch", "Dragonspine Spear", "Favonius Lance",
    "Blackcliff Pole", "Lança Sacrificial", "Kitain Cross Spear",
    "Dragon's Bane", "Wavebreaker's Fin",
    "Viridescent Hunt", "Prototype Crescent", "Favonius Warbow",
    "Blackcliff Warbow", "Rust", "Sacrificial Bow",
    "Stringless", "Hamayumi",
    "Widsith", "Eye of Perception", "Favonius Codex",
    "Blackcliff Agate", "Solar Pearl", "Sacrificial Fragments",
    "Frostbearer", "Mappa Mare"
];


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
        return pity4 >= 9 || this._chance(0.051);
    }


    _isArma(nome) {
        return ARMAS_3.includes(nome) || ARMAS_4.includes(nome);
    }

    _addCharacter(userData, nome, raridade) {
        if (this._isArma(nome)) {
            return { arma: true };
        }

        if (!userData.personagens) userData.personagens = [];

        const char = userData.personagens.find(p => p.nome === nome);

        if (!char) {
            userData.personagens.push({ nome, raridade, constelacao: 0 });
            return { novo: true, constelacao: 0 };
        }

        if (char.constelacao < 6) {
            char.constelacao++;
            return { novo: false, constelacao: char.constelacao };
        }

        return { novo: false, constelacao: 6, excedente: true };
    }

    _addArma(userData, nome, raridade) {
        if (!userData.armas) userData.armas = [];

        const arma = userData.armas.find(a => a.nome === nome);

        if (!arma) {
            userData.armas.push({ nome, raridade, refinamento: 1 });
            return { novo: true, refinamento: 1 };
        }

        if (arma.refinamento < 5) {
            arma.refinamento++;
            return { novo: false, refinamento: arma.refinamento };
        }

        return { novo: false, refinamento: 5, excedente: true };
    }

    _addItem(userData, nome, raridade) {
        if (this._isArma(nome)) {
            return this._addArma(userData, nome, raridade);
        }
        return this._addCharacter(userData, nome, raridade);
    }


    _resolve5050_t5(banner, featured5) {
        if (banner.garantidot5) {
            banner.garantidot5 = false;
            return { item: featured5, garantido: true };
        }

        if (this._chance(0.5)) {
            return { item: featured5, garantido: false };
        }

        banner.garantidot5 = true;
        return {
            item: this._pick(this.config.banners.mochileiro.t5),
            garantido: false
        };
    }

    _resolve5050_t4(banner, featured4) {
        if (banner.garantidot4) {
            banner.garantidot4 = false;
            return { item: this._pick(featured4), garantido: true };
        }

        if (this._chance(0.5)) {
            return { item: this._pick(featured4), garantido: false };
        }

        banner.garantidot4 = true;
        return {
            item: this._pick(this.config.banners.mochileiro.t4),
            garantido: false
        };
    }


    pull(userData, bannerId = 0) {
        const result = bannerId === 2
            ? this._pullMochileiro(userData)
            : this._pullLimited(userData, bannerId);

        result.inventario = this._addItem(userData, result.item, result.tipo);

        return result;
    }

    _pullLimited(userData, bannerId) {
        const banner = userData.primogemas.bannerlimitado;

        banner.pityt5++;
        banner.pityt4++;

        const featured5 = this.config.banners.atual.t5[bannerId];
        const featured4 = this.config.banners.atual.t4;

        const result = {
            tipo: null,
            item: null,
            banner: bannerId,
            garantido: false
        };

        if (banner.pityt5 >= 90 || this._chance(this._get5StarChance(banner.pityt5))) {
            banner.pityt5 = 0;
            banner.pityt4 = 0;

            const resolved = this._resolve5050_t5(banner, featured5);

            result.tipo = 5;
            result.item = resolved.item;
            result.garantido = resolved.garantido;

            return result;
        }

        if (this._is4Star(banner.pityt4)) {
            banner.pityt4 = 0;

            const resolved = this._resolve5050_t4(banner, featured4);

            result.tipo = 4;
            result.item = resolved.item;
            result.garantido = resolved.garantido;

            return result;
        }

        result.tipo = 3;
        result.item = this._pick(ARMAS_3);

        return result;
    }

    _pullMochileiro(userData) {
        const banner = userData.primogemas.mochileiro;

        banner.pityt5++;
        banner.pityt4++;

        const result = { tipo: null, item: null, banner: 2 };

        if (banner.pityt5 >= 90 || this._chance(this._get5StarChance(banner.pityt5))) {
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
        result.item = this._pick(ARMAS_3);

        return result;
    }


    async multi(userData, bannerId, amount = 10) {
        const results = [];
        let has4OrMore = false;
        let fiveStarCount = 0;

        for (let i = 0; i < amount; i++) {
            if (i === amount - 1 && !has4OrMore) {
                const bannerData = bannerId === 2
                    ? userData.primogemas.mochileiro
                    : userData.primogemas.bannerlimitado;

                bannerData.pityt4 = 9; 
            }

            const res = this.pull(userData, bannerId);

            if (res.tipo >= 4) has4OrMore = true;
            if (res.tipo === 5) fiveStarCount++;

            results.push(res);
        }

        if (fiveStarCount <= 1) {
            const premium = await PremiumManager.getUserPlan(userData.userId);
            const chanceExtra = premium.status
                ? premium.plan.fiveStarExtraChance
                : BASE_FIVE_STAR_EXTRA_CHANCE;

            if (this._chance(chanceExtra)) {
                const extra = this._buildExtraPull(userData, bannerId);
                results.push(extra);
            }
        }

        return results;
    }

    _buildExtraPull(userData, bannerId) {
        let item;
        let garantido = false;

        if (bannerId === 2) {
            item = this._pick(this.config.banners.mochileiro.t5);
        } else {
            const banner = userData.primogemas.bannerlimitado;
            const featured5 = this.config.banners.atual.t5[bannerId];
            const resolved = this._resolve5050_t5(banner, featured5);

            item = resolved.item;
            garantido = resolved.garantido;
        }

        const inventario = this._addItem(userData, item, 5);

        return {
            tipo: 5,
            item,
            banner: bannerId,
            garantido,
            inventario,
            extra: true
        };
    }
}

module.exports = GachaSystem;
module.exports.ARMAS_3 = ARMAS_3;
module.exports.ARMAS_4 = ARMAS_4;
