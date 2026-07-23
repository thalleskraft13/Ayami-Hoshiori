'use strict';

class BattleCharacter {
    constructor(dados, registroDB = {}) {
        this.dados     = dados;
        this.registroDB = registroDB;

        this.nome      = dados.nome;
        this.elemento  = dados.elemento;
        this.raridade  = dados.raridade;
        this.roles     = dados.roles ?? [];
        this.modoCombate = dados.modoCombate ?? { principal: true, offField: false };

        this.constelacao = Math.min(registroDB.constelacao ?? 0, 6);

        this.stats = this._calcularStats();

        this.hpAtual      = this.stats.hp;
        this.energiaAtual = 0;
        this.vivo         = true;
        this.ativo        = false;

        this.buffs    = []; 
        this.debuffs  = []; 
        this.escudos  = []; 
        this.marcas   = []; 
        this.auras    = new Set(); 

        this.cooldowns = {
            ataqueNormal:      0,
            habilidadeElemental: 0,
            supremo:           0,
        };

        this.estatisticas = {
            danoTotal:  0,
            curaTotal:  0,
            abatesFeitos: 0,
        };
    }


    _calcularStats() {
        const base = { ...this.dados.stats };
        const cons = this.dados.constelacoes ?? {};

        for (let i = 1; i <= this.constelacao; i++) {
            const c = cons[i];
            if (!c?.bonusStats) continue;

            for (const [stat, valor] of Object.entries(c.bonusStats)) {
                if (base[stat] !== undefined) base[stat] += valor;
            }
        }

        return base;
    }

    getStat(stat) {
        let valor = this.stats[stat] ?? 0;

        for (const buff of this.buffs) {
            if (buff.stat === stat) valor += buff.valor;
        }

        for (const debuff of this.debuffs) {
            if (debuff.stat === stat) valor -= debuff.valor;
        }

        return Math.max(0, valor);
    }


    receberDano(valor, fonte = 'desconhecido') {
        if (!this.vivo) return 0;

        let danoRestante = valor;

        for (const escudo of [...this.escudos]) {
            if (danoRestante <= 0) break;
            if (escudo.valor >= danoRestante) {
                escudo.valor -= danoRestante;
                danoRestante  = 0;
            } else {
                danoRestante -= escudo.valor;
                escudo.valor  = 0;
            }
        }

        this.escudos = this.escudos.filter(e => e.valor > 0);

        this.hpAtual = Math.max(0, this.hpAtual - danoRestante);

        if (this.hpAtual <= 0) {
            this.vivo  = false;
            this.ativo = false;
        }

        return danoRestante;
    }

    receberCura(valor) {
        if (!this.vivo) return 0;
        const hpAntes = this.hpAtual;
        this.hpAtual  = Math.min(this.stats.hp, this.hpAtual + valor);
        const curaReal = this.hpAtual - hpAntes;
        this.estatisticas.curaTotal += curaReal;
        return curaReal;
    }

    reviver(hp) {
        this.vivo    = true;
        this.hpAtual = Math.min(this.stats.hp, Math.max(1, hp));
    }


    adicionarEnergia(valor) {
        this.energiaAtual = Math.min(this.stats.energiaMax, this.energiaAtual + valor);
    }

    consumirEnergia(valor) {
        this.energiaAtual = Math.max(0, this.energiaAtual - valor);
    }

    temEnergiaSuficiente() {
        return this.energiaAtual >= (this.dados.supremo?.energiaNecessaria ?? 100);
    }


    aplicarBuff(buff) {
        this.buffs = this.buffs.filter(b => !(b.stat === buff.stat && b.fonte === buff.fonte));
        this.buffs.push({ id: Date.now() + Math.random(), ...buff });
    }

    aplicarDebuff(debuff) {
        this.debuffs = this.debuffs.filter(d => !(d.tipo === debuff.tipo && d.fonte === debuff.fonte));
        this.debuffs.push({ id: Date.now() + Math.random(), ...debuff });
    }

    aplicarEscudo(escudo) {
        this.escudos.push({ id: Date.now() + Math.random(), ...escudo });
    }

    aplicarMarca(marca) {
        this.marcas = this.marcas.filter(m => m.tipo !== marca.tipo);
        this.marcas.push({ id: Date.now() + Math.random(), ...marca });
    }


    setCooldown(acao, turnos) {
        this.cooldowns[acao] = turnos;
    }

    getCooldown(acao) {
        return this.cooldowns[acao] ?? 0;
    }

    podeUsar(acao) {
        return this.cooldowns[acao] <= 0;
    }

    reduzirCooldowns() {
        for (const acao of Object.keys(this.cooldowns)) {
            if (this.cooldowns[acao] > 0) this.cooldowns[acao]--;
        }
    }


    reduzirDuracoes() {
        this.buffs    = this.buffs.filter(b => { b.duracao--; return b.duracao > 0; });
        this.debuffs  = this.debuffs.filter(d => { d.duracao--; return d.duracao > 0; });
        this.escudos  = this.escudos.filter(e => { e.duracao--; return e.duracao > 0; });
        this.marcas   = this.marcas.filter(m => { m.duracao--; return m.duracao > 0; });
    }


    aplicarAura(elemento) {
        this.auras.add(elemento);
    }

    removerAura(elemento) {
        this.auras.delete(elemento);
    }

    temAura(elemento) {
        return this.auras.has(elemento);
    }


    podeAtorOffField() {
        return this.vivo && this.modoCombate.offField === true;
    }


    getAcoesDisponiveis() {
        const acoes = [];

        if (this.podeUsar('ataqueNormal')) {
            acoes.push({ id: 'ataqueNormal', label: this.dados.ataqueNormal?.nome ?? 'Ataque Normal' });
        }

        if (this.podeUsar('habilidadeElemental')) {
            acoes.push({ id: 'habilidadeElemental', label: this.dados.habilidadeElemental?.nome ?? 'Habilidade Elemental' });
        }

        if (this.podeUsar('supremo') && this.temEnergiaSuficiente()) {
            acoes.push({ id: 'supremo', label: this.dados.supremo?.nome ?? 'Supremo' });
        }

        return acoes;
    }


    temConstelacao(nivel) {
        return this.constelacao >= nivel;
    }

    getConstelacao(nivel) {
        return this.dados.constelacoes?.[nivel] ?? null;
    }


    toSnapshot() {
        return {
            nome:        this.nome,
            elemento:    this.elemento,
            hpAtual:     this.hpAtual,
            hpMax:       this.stats.hp,
            hpPercent:   Math.round((this.hpAtual / this.stats.hp) * 100),
            energia:     this.energiaAtual,
            energiaMax:  this.stats.energiaMax,
            vivo:        this.vivo,
            ativo:       this.ativo,
            constelacao: this.constelacao,
            escudoTotal: this.escudos.reduce((s, e) => s + e.valor, 0),
            buffs:       this.buffs.map(b => `${b.stat}+${b.valor}`),
            debuffs:     this.debuffs.map(d => `${d.tipo}-${d.valor}`),
        };
    }
}

module.exports = BattleCharacter;
