'use strict';

const path = require('path');
const fs   = require('fs');

class CharacterLoader {
    constructor() {
        this._cache = new Map();
        this._basePath = path.join(process.cwd(), 'src', 'function', 'System', 'Battle', 'personagens');
        this._carregarTodos();
    }

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

    getDados(nome) {
        return this._cache.get(nome.toLowerCase()) ?? null;
    }

    existe(nome) {
        return this._cache.has(nome.toLowerCase());
    }

    listarNomes() {
        return [...this._cache.keys()];
    }

    montarTime(user, nomesTime) {
        const resultado = [];

        for (const nome of nomesTime) {
            const dados = this.getDados(nome);
            if (!dados) {
                console.warn(`[CharacterLoader] Personagem não encontrado: ${nome}`);
                continue;
            }

            const registroDB = user.personagens?.find(
                p => p.nome.toLowerCase() === nome.toLowerCase()
            ) ?? {};

            resultado.push({ dados, registroDB });
        }

        return resultado;
    }

    recarregar() {
        this._cache.clear();
        for (const key of Object.keys(require.cache)) {
            if (key.includes('personagens')) delete require.cache[key];
        }
        this._carregarTodos();
    }
}

const instancia = new CharacterLoader();
module.exports = instancia;
