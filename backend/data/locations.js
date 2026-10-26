// data/locations.js
// Country -> State/Province -> Cities. Extend freely; the checkout API
// validates addresses against this list and the frontend builds its
// dropdowns from it (GET /api/checkout/locations).

const LOCATIONS = {
  Cambodia: {
    'Phnom Penh': ['Chamkar Mon', 'Daun Penh', 'Prampir Meakkakra', 'Tuol Kork', 'Dangkao', 'Mean Chey', 'Russey Keo', 'Sen Sok', 'Pou Senchey', 'Chroy Changvar', 'Prek Pnov', 'Chbar Ampov', 'Boeng Keng Kang', 'Kamboul'],
    'Siem Reap': ['Siem Reap', 'Angkor Chum', 'Banteay Srei', 'Chi Kraeng', 'Pourk', 'Soutr Nikom'],
    'Battambang': ['Battambang', 'Banan', 'Moung Ruessei', 'Sangkae', 'Thma Koul'],
    'Kampong Cham': ['Kampong Cham', 'Cheung Prey', 'Kampong Siem', 'Kang Meas', 'Stueng Trang'],
    'Kandal': ['Ta Khmau', 'Kandal Stueng', 'Khsach Kandal', 'Koh Thom', 'Lvea Em', 'Mukh Kampul', 'Saang'],
    'Kampot': ['Kampot', 'Angkor Chey', 'Chhuk', 'Chum Kiri', 'Dang Tong', 'Kampong Trach'],
    'Kep': ['Kep', 'Damnak Chang Aeur'],
    'Preah Sihanouk': ['Sihanoukville', 'Prey Nob', 'Stueng Hav', 'Kampong Seila'],
    'Koh Kong': ['Khemarak Phoumin', 'Mondol Seima', 'Smach Mean Chey'],
    'Takeo': ['Doun Kaev', 'Angkor Borei', 'Bati', 'Kiri Vong', 'Samraong'],
    'Kampong Speu': ['Chbar Mon', 'Aoral', 'Kong Pisei', 'Odongk', 'Samraong Tong'],
    'Kampong Chhnang': ['Kampong Chhnang', 'Boribo', 'Kampong Tralach', 'Rolea B\'ier'],
    'Kampong Thom': ['Stung Saen', 'Baray', 'Santuk', 'Stoung'],
    'Prey Veng': ['Prey Veng', 'Ba Phnum', 'Kampong Leav', 'Peam Ro'],
    'Svay Rieng': ['Svay Rieng', 'Bavet', 'Chantrea', 'Romeas Haek'],
    'Pursat': ['Pursat', 'Bakan', 'Krakor', 'Phnum Kravanh'],
    'Banteay Meanchey': ['Serei Saophoan', 'Poipet', 'Mongkol Borei', 'Thma Puok'],
    'Oddar Meanchey': ['Samraong', 'Anlong Veaeng', 'Banteay Ampil'],
    'Pailin': ['Pailin', 'Sala Krau'],
    'Preah Vihear': ['Preah Vihear', 'Chey Saen', 'Tbaeng Meanchey'],
    'Stung Treng': ['Stung Treng', 'Siem Bouk', 'Thala Barivat'],
    'Kratie': ['Kratie', 'Chhloung', 'Snuol'],
    'Mondulkiri': ['Senmonorom', 'Kaev Seima', 'Pech Chreada'],
    'Ratanakiri': ['Banlung', 'Andoung Meas', 'Ou Chum'],
    'Tboung Khmum': ['Suong', 'Dambae', 'Ponhea Kraek', 'Tboung Khmum'],
  },
  Thailand: {
    'Bangkok': ['Bangkok'],
    'Chiang Mai': ['Chiang Mai', 'Hang Dong', 'San Sai'],
    'Phuket': ['Phuket', 'Kathu', 'Thalang'],
    'Chonburi': ['Pattaya', 'Chonburi', 'Si Racha'],
  },
  Vietnam: {
    'Ho Chi Minh City': ['Ho Chi Minh City', 'Thu Duc', 'Binh Thanh'],
    'Hanoi': ['Hanoi', 'Ba Dinh', 'Hoan Kiem'],
    'Da Nang': ['Da Nang', 'Hai Chau'],
  },
  Laos: {
    'Vientiane': ['Vientiane'],
    'Luang Prabang': ['Luang Prabang'],
  },
  Singapore: {
    'Singapore': ['Singapore'],
  },
};

function getCountries() {
  return Object.keys(LOCATIONS);
}

function isValidLocation(country, state, city) {
  const states = LOCATIONS[country];
  if (!states) return { ok: false, message: 'Please select a valid country' };
  if (!states[state]) return { ok: false, message: 'Please select a valid state/province for the chosen country' };
  if (!states[state].includes(city)) return { ok: false, message: 'Please select a valid city for the chosen state/province' };
  return { ok: true };
}

module.exports = { LOCATIONS, getCountries, isValidLocation };
