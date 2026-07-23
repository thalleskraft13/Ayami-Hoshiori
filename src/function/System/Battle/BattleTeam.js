'use strict';

const BattleCharacter = require('./BattleCharacter.js');

class BattleTeam {
    constructor(userId, username, personagens = []) {
        this.userId   = userId;
        this.username = username;

        this.personagens = personagens.map(
            ({ dados, registroDB }) => new BattleCharacter(dados, registroDB)
        );

        this._indiceAtivo = 0;
        this._ativarPersonagem(0);
    }


    get ativo() {
        return this.personagens[this._indiceAtivo] ?? null;
    }

    get indiceAtivo() {
        return this._indiceAtivo;
    }


    get offField() {
        return this.personagens.filter((p, i) => i !== this._indiceAtivo && p.vivo);
    }


    trocar(indice) {
        if (indice === this._indiceAtivo) {
            return { sucesso: false, mensagem: `${this.personagens[indice]?.nome} já está em campo.` };
        }

        const alvo = this.personagens[indice];
        if (!alvo) {
            return { sucesso: false, mensagem: 'Personagem não encontrado.' };
        }

        if (!alvo.vivo) {
            return { sucesso: false, mensagem: `${alvo.nome} está derrotado e não pode entrar em campo.` };
        }

        const anterior = this.ativo;
        if (anterior) anterior.ativo = false;

        this._indiceAtivo = indice;
        this._ativarPersonagem(indice);

        return { sucesso: true, mensagem: `${anterior?.nome ?? '?'} → ${alvo.nome}` };
    }

    trocarPorNome(nome) {
        const indice = this.personagens.findIndex(
            p => p.nome.toLowerCase() === nome.toLowerCase()
        );
        if (indice === -1) return { sucesso: false, mensagem: `${nome} não está neste time.` };
        return this.trocar(indice);
    }

    _ativarPersonagem(indice) {
        if (this.personagens[indice]) {
            this.personagens[indice].ativo = true;
        }
    }


    estaVivo() {
        return this.personagens.some(p => p.vivo);
    }

    vivos() {
        return this.personagens.filter(p => p.vivo);
    }

    derrotados() {
        return this.personagens.filter(p => !p.vivo);
    }

    avancarParaProximoVivo() {
        const proximo = this.personagens.findIndex((p, i) => i !== this._indiceAtivo && p.vivo);
        if (proximo === -1) return false;

        if (this.ativo) this.ativo.ativo = false;
        this._indiceAtivo = proximo;
        this._ativarPersonagem(proximo);
        return true;
    }


    processarFimDeTurno() {
        for (const p of this.vivos()) {
            p.reduzirCooldowns();
            p.reduzirDuracoes();
        }
    }


    toSnapshot() {
        return {
            userId:   this.userId,
            username: this.username,
            personagens: this.personagens.map(p => p.toSnapshot()),
            ativoIndex: this._indiceAtivo,
            vivo: this.estaVivo(),
        };
    }

    static barraHP(personagem, tamanho = 10) {
        const pct      = personagem.hpAtual / personagem.stats.hp;
        const cheios   = Math.round(pct * tamanho);
        const vazios   = tamanho - cheios;
        const emoji    = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
        return emoji.repeat(cheios) + '⬛'.repeat(vazios);
    }
}

module.exports = BattleTeam;
