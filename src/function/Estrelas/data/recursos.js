'use strict';

// Catálogo estático dos recursos existentes na economia da Ayami.
// Mantido separado para permitir autocomplete e cálculo de progresso de Coleções
// sem acoplar a outros services.
module.exports = {
  madeira:       { id: 'madeira',       nome: 'Madeira',        emoji: '🪵' },
  pedra:         { id: 'pedra',         nome: 'Pedra',          emoji: '🪨' },
  ferro:         { id: 'ferro',         nome: 'Ferro',          emoji: '⚙️' },
  cristais:      { id: 'cristais',      nome: 'Cristais',       emoji: '💎' },
  flores:        { id: 'flores',        nome: 'Flores',         emoji: '🌸' },
  livros:        { id: 'livros',        nome: 'Livros',         emoji: '📚' },
  reliquias:     { id: 'reliquias',     nome: 'Relíquias',      emoji: '🏺' },
  cogumelos:     { id: 'cogumelos',     nome: 'Cogumelos',      emoji: '🍄' },
  poeiraEstelar: { id: 'poeiraEstelar', nome: 'Poeira Estelar', emoji: '✨' }
};
