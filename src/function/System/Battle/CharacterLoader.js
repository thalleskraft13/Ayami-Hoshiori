'use strict';

const path = require('path');
const fs   = require('fs');

/**
 * CharacterLoader
 *
 * Carrega os arquivos de dados de personagens da pasta /personagens/
 * e monta os objetos necessários para instanciar BattleCharacters.
 *
 * Separa completamente os dados estáticos do personagem do registro do banco.
 */
class CharacterLoader {
    constructor() {
        this._cache = new Map();
        this._basePath = path.join(process.cwd(), 'src', 'function', 'System', 'Battle', 'personagens');
        this._carregarTodos();
    }

    /**
     * Carrega todos os arquivos .js da pasta de personagens no cache.
     */
    _carregarTodos() {
        if (!fs.existsSync(this._basePath)) {
            console.warn('[CharacterLoader] Pasta de personagens não encontrada:', this._basePath);
            return;
        }

        let carregados = 0;

        for (const arquivo of fs.readdirSync(this._basePath)) {
            if (!arquivo.endsWith('.js')) continue;

            try {
                const dados = require(path.join(this._basePath, arquivo));
                if (!dados?.nome) continue;

                this._cache.set(dados.nome.toLowerCase(), dados);
                carregados++;
            } catch (err) {
                console.error(`[CharacterLoader] Erro ao carregar ${arquivo}:`, err);
            }
        }

        console.log(`[CharacterLoader] ${carregados} personagens carregados.`);
    }

    /**
     * Retorna os dados estáticos de um personagem pelo nome.
     * @param {string} nome
     * @returns {object|null}
     */
    getDados(nome) {
        return this._cache.get(nome.toLowerCase()) ?? null;
    }

    /**
     * Verifica se um personagem existe no sistema.
     * @param {string} nome
     */
    existe(nome) {
        return this._cache.has(nome.toLowerCase());
    }

    /**
     * Retorna todos os nomes de personagens disponíveis.
     */
    listarNomes() {
        return [...this._cache.keys()];
    }

    /**
     * Monta o array de { dados, registroDB } a partir do UserDB para um time.
     *
     * @param {object} user           - Documento do UserGlobalDb
     * @param {string[]} nomesTime    - Nomes dos personagens no time ativo
     * @returns {{ dados, registroDB }[]}
     */
    montarTime(user, nomesTime) {
        const resultado = [];

        for (const nome of nomesTime) {
            const dados = this.getDados(nome);
            if (!dados) {
                console.warn(`[CharacterLoader] Personagem não encontrado: ${nome}`);
                continue;
            }

            // Busca o registro do personagem no banco do usuário
            const registroDB = user.personagens?.find(
                p => p.nome.toLowerCase() === nome.toLowerCase()
            ) ?? {};

            resultado.push({ dados, registroDB });
        }

        return resultado;
    }

    /**
     * Recarrega o cache (útil para hot-reload em dev).
     */
    recarregar() {
        this._cache.clear();
        // Limpa require cache para os arquivos de personagem
        for (const key of Object.keys(require.cache)) {
            if (key.includes('personagens')) delete require.cache[key];
        }
        this._carregarTodos();
    }
}

// Singleton para reutilização
const instancia = new CharacterLoader();
module.exports = instancia;
