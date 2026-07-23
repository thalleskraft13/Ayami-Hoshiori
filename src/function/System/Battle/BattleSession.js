'use strict';

const BattleEngine    = require('./BattleEngine.js');
const BattleTeam      = require('./BattleTeam.js');
const CharacterLoader = require('./CharacterLoader.js');

class BattleSession {
    constructor(opts) {
        this.userA      = opts.userA;
        this.userB      = opts.userB;
        this.userAId    = opts.userAId;
        this.userBId    = opts.userBId;
        this.userAName  = opts.userAName;
        this.userBName  = opts.userBName;
        this.aposta     = opts.aposta ?? null;
        this.client     = opts.client;
        this.channelId  = opts.channelId;
        this.messageId  = opts.messageId ?? null;

        const personagensA = CharacterLoader.montarTime(
            this.userA,
            this.userA.times[this.userA.timeAtivo]?.personagens ?? []
        );
        const personagensB = CharacterLoader.montarTime(
            this.userB,
            this.userB.times[this.userB.timeAtivo]?.personagens ?? []
        );

        const timeA = new BattleTeam(this.userAId, this.userAName, personagensA);
        const timeB = new BattleTeam(this.userBId, this.userBName, personagensB);

        this.engine = new BattleEngine(timeA, timeB);

        this.logAtual = [];
    }


    processarAcao(userId, tipoAcao, opcoes = {}) {
        if (!this.engine.emAndamento) return { log: [], snapshot: this.engine.gerarSnapshot(), fim: true };

        const vezAtual = this.engine.vezAtual === 'A' ? this.userAId : this.userBId;
        if (userId !== vezAtual) {
            return { log: ['❌ Não é sua vez!'], snapshot: this.engine.gerarSnapshot(), fim: false };
        }

        const logInicio   = this.engine.processarInicioTurno();
        const { log, ativouPassivas } = this.engine.executarAcao(tipoAcao, opcoes);
        const logFim      = this.engine.processarFimTurno();
        const fimBatalha  = this.engine.verificarFimDeBatalha();

        this.logAtual = [
            ...logInicio,
            ...log,
            ...ativouPassivas,
            ...logFim,
        ];

        return {
            log:      this.logAtual,
            snapshot: this.engine.gerarSnapshot(),
            fim:      fimBatalha,
        };
    }


    get vezAtual() {
        return this.engine.vezAtual === 'A' ? this.userAId : this.userBId;
    }

    get timeAtacante() { return this.engine.timeAtacante; }
    get timeDefensor()  { return this.engine.timeDefensor; }
    get emAndamento()   { return this.engine.emAndamento; }


    getPersonagensParaTroca(userId) {
        const time = userId === this.userAId ? this.engine.timeA : this.engine.timeB;
        return time.personagens
            .map((p, i) => ({ personagem: p, indice: i }))
            .filter(({ personagem, indice }) => personagem.vivo && indice !== time.indiceAtivo);
    }


    getAcoesDisponiveis(userId) {
        const time  = userId === this.userAId ? this.engine.timeA : this.engine.timeB;
        const ativo = time?.ativo;
        if (!ativo) return [];
        return ativo.getAcoesDisponiveis();
    }
}

module.exports = BattleSession;
