'use strict';

const BattleEngine    = require('./BattleEngine.js');
const BattleTeam      = require('./BattleTeam.js');
const CharacterLoader = require('./CharacterLoader.js');

/**
 * BattleSession
 *
 * Gerencia uma sessão de batalha ativa.
 * Liga a engine de batalha com o Discord: cria embeds, botões e coleta interações.
 *
 * Uma sessão é criada por /batalha iniciar e destruída quando a batalha termina.
 */
class BattleSession {
    /**
     * @param {object} opts
     * @param {object} opts.userA       - Documento UserGlobalDb do desafiante
     * @param {object} opts.userB       - Documento UserGlobalDb do adversário
     * @param {string} opts.userAId     - Discord ID do desafiante
     * @param {string} opts.userBId     - Discord ID do adversário
     * @param {string} opts.userAName   - Nome do desafiante
     * @param {string} opts.userBName   - Nome do adversário
     * @param {object} opts.aposta      - { primogemas, personagem } (opcional)
     * @param {object} opts.client      - Instância do DiscordGatewayClient
     * @param {string} opts.channelId   - Canal onde a batalha ocorre
     * @param {string} opts.messageId   - ID da mensagem da batalha (atualizada a cada turno)
     */
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

        // Monta times a partir dos dados do banco
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

        // Log do turno atual para exibição
        this.logAtual = [];
    }

    // ─── Execução de ação ─────────────────────────────────────────────────────

    /**
     * Processa uma ação do jogador.
     * Retorna o log completo do turno para exibição no embed.
     *
     * @param {string} userId    - Quem está agindo
     * @param {string} tipoAcao
     * @param {object} [opcoes]
     * @returns {{ log: string[], snapshot: object, fim: boolean }}
     */
    processarAcao(userId, tipoAcao, opcoes = {}) {
        if (!this.engine.emAndamento) return { log: [], snapshot: this.engine.gerarSnapshot(), fim: true };

        // Verifica se é a vez do jogador
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

    // ─── Getters convenientes ─────────────────────────────────────────────────

    get vezAtual() {
        return this.engine.vezAtual === 'A' ? this.userAId : this.userBId;
    }

    get timeAtacante() { return this.engine.timeAtacante; }
    get timeDefensor()  { return this.engine.timeDefensor; }
    get emAndamento()   { return this.engine.emAndamento; }

    // ─── Personagens disponíveis para troca ───────────────────────────────────

    getPersonagensParaTroca(userId) {
        const time = userId === this.userAId ? this.engine.timeA : this.engine.timeB;
        return time.personagens
            .map((p, i) => ({ personagem: p, indice: i }))
            .filter(({ personagem, indice }) => personagem.vivo && indice !== time.indiceAtivo);
    }

    // ─── Ações disponíveis para o jogador ─────────────────────────────────────

    getAcoesDisponiveis(userId) {
        const time  = userId === this.userAId ? this.engine.timeA : this.engine.timeB;
        const ativo = time?.ativo;
        if (!ativo) return [];
        return ativo.getAcoesDisponiveis();
    }
}

module.exports = BattleSession;
