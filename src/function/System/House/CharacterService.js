'use strict';

const HouseCharacter = require('../../../Mongodb/houseCharacter.js');

class CharacterService {

  async create(guildId, data) {
    return HouseCharacter.create({ guildId, ...data });
  }

  async update(guildId, characterId, data) {
    return HouseCharacter.findOneAndUpdate({ guildId, _id: characterId }, data, { new: true });
  }

  async delete(guildId, characterId) {
    return HouseCharacter.findOneAndDelete({ guildId, _id: characterId });
  }

  async list(guildId) {
    return HouseCharacter.find({ guildId }).sort({ name: 1 });
  }

  async listAvailable(guildId) {
    return HouseCharacter.find({ guildId, available: true, $expr: { $lt: ['$occupiedSlots', '$slots'] } }).sort({ name: 1 });
  }

  async listOccupied(guildId) {
    return HouseCharacter.find({ guildId, occupiedSlots: { $gt: 0 } }).sort({ name: 1 });
  }

  async get(guildId, characterId) {
    return HouseCharacter.findOne({ guildId, _id: characterId });
  }

  async assign(guildId, characterId, userId, approvedBy = null) {
    const character = await this.get(guildId, characterId);
    if (!character) return { ok: false, reason: 'personagem_inexistente' };
    if (!character.available || character.occupiedSlots >= character.slots) {
      return { ok: false, reason: 'sem_vagas' };
    }

    character.occupiedSlots += 1;
    character.currentUserId = userId;
    character.chosenAt = new Date();
    character.approvedBy = approvedBy;
    if (character.occupiedSlots >= character.slots) character.available = false;
    await character.save();

    return { ok: true, character };
  }

  async release(guildId, characterId, reason = null) {
    const character = await this.get(guildId, characterId);
    if (!character) return { ok: false, reason: 'personagem_inexistente' };

    character.occupiedSlots = Math.max(0, character.occupiedSlots - 1);
    character.currentUserId = null;
    character.chosenAt = null;
    character.available = true;
    await character.save();

    return { ok: true, character };
  }

  async findByUser(guildId, userId) {
    return HouseCharacter.findOne({ guildId, currentUserId: userId });
  }
}

module.exports = CharacterService;
