const fs = require('fs');
const path = require('path');

const DATA_DIRECTORY = path.join(__dirname, '..', '..', 'data');
const VOTERS_FILE = path.join(DATA_DIRECTORY, 'voters.json');

function getSeedVoters() {
  return [
    {
      voter_id: 'admin001',
      password: 'admin123',
      role: 'admin',
    },
    {
      voter_id: 'voter001',
      password: 'voter123',
      role: 'user',
    },
  ];
}

function ensureVotersFile() {
  if (!fs.existsSync(DATA_DIRECTORY)) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
  }

  if (!fs.existsSync(VOTERS_FILE)) {
    fs.writeFileSync(VOTERS_FILE, JSON.stringify(getSeedVoters(), null, 2));
  }
}

function loadVoters() {
  ensureVotersFile();
  return JSON.parse(fs.readFileSync(VOTERS_FILE, 'utf8'));
}

function findUser(voterId, password) {
  return loadVoters().find((user) => user.voter_id === voterId && user.password === password) || null;
}

module.exports = {
  ensureVotersFile,
  findUser,
  loadVoters,
};
