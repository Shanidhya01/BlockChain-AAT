const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const StellarSdk = require('@stellar/stellar-sdk');

const STATE_DIRECTORY = path.join(__dirname, '..', '..', 'data');
const STATE_FILE = path.join(STATE_DIRECTORY, 'election-state.json');
const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;
const FRIEND_BOT_URL = process.env.STELLAR_FRIENDBOT_URL || 'https://friendbot.stellar.org';
const ANCHOR_AMOUNT = '0.0000001';
const PENDING_ACTION_TTL_MS = 5 * 60 * 1000;

let stellarServer;
const pendingActions = new Map();

function getInitialState() {
  return {
    candidates: [],
    votesByVoter: {},
    dates: {
      start: null,
      end: null,
    },
    auditLog: [],
  };
}

function ensureStateFile() {
  if (!fs.existsSync(STATE_DIRECTORY)) {
    fs.mkdirSync(STATE_DIRECTORY, { recursive: true });
  }

  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(getInitialState(), null, 2));
  }
}

function loadState() {
  ensureStateFile();
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  ensureStateFile();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getServer() {
  if (!stellarServer) {
    stellarServer = new StellarSdk.Horizon.Server(HORIZON_URL);
  }

  return stellarServer;
}

function cleanupPendingActions() {
  const now = Date.now();

  for (const [actionId, action] of pendingActions.entries()) {
    if (action.expiresAt <= now) {
      pendingActions.delete(actionId);
    }
  }
}

function validateWalletAddress(walletAddress) {
  const trimmedAddress = String(walletAddress || '').trim();

  if (!trimmedAddress) {
    throw new Error('A Freighter wallet address is required.');
  }

  if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmedAddress)) {
    throw new Error('The Freighter wallet address is not a valid Stellar public key.');
  }

  return trimmedAddress;
}

async function ensureStellarAccount(publicKey) {
  const server = getServer();

  try {
    await server.loadAccount(publicKey);
    return publicKey;
  } catch (error) {
    const status = error?.response?.status;

    if (status !== 404 || NETWORK_PASSPHRASE !== StellarSdk.Networks.TESTNET) {
      throw error;
    }

    const response = await fetch(`${FRIEND_BOT_URL}?addr=${encodeURIComponent(publicKey)}`);

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Unable to fund Stellar testnet account: ${details}`);
    }

    await server.loadAccount(publicKey);
    return publicKey;
  }
}

function hashVoterId(voterId) {
  return crypto.createHash('sha256').update(voterId).digest('hex').slice(0, 16);
}

function getNowUnix() {
  return Math.floor(Date.now() / 1000);
}

function isVotingOpen(state) {
  if (!state.dates.start || !state.dates.end) {
    return false;
  }

  const now = getNowUnix();
  return state.dates.start <= now && state.dates.end > now;
}

async function buildPreparedTransaction(walletAddress, payloadHash) {
  await ensureStellarAccount(walletAddress);

  const server = getServer();
  const sourceAccount = await server.loadAccount(walletAddress);
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: walletAddress,
        asset: StellarSdk.Asset.native(),
        amount: ANCHOR_AMOUNT,
      })
    )
    .addMemo(StellarSdk.Memo.text(payloadHash.slice(0, 28)))
    .setTimeout(30)
    .build();

  return transaction;
}

function createPendingAction({ type, actor, voterId, walletAddress, details, payloadHash, transaction }) {
  cleanupPendingActions();

  const actionId = crypto.randomUUID();
  const transactionHash = transaction.hash().toString('hex');

  pendingActions.set(actionId, {
    actionId,
    type,
    actor: actor || null,
    voterId: voterId || null,
    walletAddress,
    details,
    payloadHash,
    transactionHash,
    expiresAt: Date.now() + PENDING_ACTION_TTL_MS,
  });

  return {
    actionId,
    transactionXdr: transaction.toXDR(),
    transactionHash,
    networkPassphrase: NETWORK_PASSPHRASE,
    horizonUrl: HORIZON_URL,
    expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS).toISOString(),
  };
}

function parseTransactionFromXdr(transactionXdr) {
  try {
    return StellarSdk.TransactionBuilder.fromXDR(transactionXdr, NETWORK_PASSPHRASE);
  } catch (error) {
    throw new Error('Invalid Stellar transaction returned from Freighter.');
  }
}

function getPendingAction(actionId) {
  cleanupPendingActions();

  const pendingAction = pendingActions.get(actionId);

  if (!pendingAction) {
    throw new Error('This pending Stellar action was not found or has expired. Please try again.');
  }

  return pendingAction;
}

function removePendingAction(actionId) {
  pendingActions.delete(actionId);
}

function buildPublicState(state, voterId) {
  return {
    candidates: state.candidates,
    dates: state.dates,
    hasVoted: Boolean(voterId && state.votesByVoter[voterId]),
    votingOpen: isVotingOpen(state),
    auditLog: state.auditLog.slice(-10).reverse(),
    stellar: {
      horizonUrl: HORIZON_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      publicKey: null,
    },
  };
}

async function getElectionState(voterId) {
  const state = loadState();
  return buildPublicState(state, voterId);
}

async function prepareAddCandidate({ name, party, actor, walletAddress }) {
  const trimmedName = String(name || '').trim();
  const trimmedParty = String(party || '').trim();
  const validatedWalletAddress = validateWalletAddress(walletAddress);

  if (!trimmedName || !trimmedParty) {
    throw new Error('Candidate name and party are required.');
  }

  const payload = {
    action: 'add_candidate',
    actor,
    walletAddress: validatedWalletAddress,
    candidate: {
      name: trimmedName,
      party: trimmedParty,
    },
    timestamp: new Date().toISOString(),
  };
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const transaction = await buildPreparedTransaction(validatedWalletAddress, payloadHash);

  return createPendingAction({
    type: 'add_candidate',
    actor,
    walletAddress: validatedWalletAddress,
    details: {
      name: trimmedName,
      party: trimmedParty,
    },
    payloadHash,
    transaction,
  });
}

async function prepareSetVotingDates({ start, end, actor, walletAddress }) {
  const startDate = Number(start);
  const endDate = Number(end);
  const validatedWalletAddress = validateWalletAddress(walletAddress);
  validateVotingDates(startDate, endDate);

  const payload = {
    action: 'set_dates',
    actor,
    walletAddress: validatedWalletAddress,
    start: startDate,
    end: endDate,
    timestamp: new Date().toISOString(),
  };
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const transaction = await buildPreparedTransaction(validatedWalletAddress, payloadHash);

  return createPendingAction({
    type: 'set_dates',
    actor,
    walletAddress: validatedWalletAddress,
    details: {
      start: startDate,
      end: endDate,
    },
    payloadHash,
    transaction,
  });
}

async function prepareVote({ candidateId, voterId, walletAddress }) {
  const numericCandidateId = Number(candidateId);
  const validatedWalletAddress = validateWalletAddress(walletAddress);
  const state = loadState();
  validateVoteRequest(state, numericCandidateId, voterId);

  const payload = {
    action: 'vote',
    candidateId: numericCandidateId,
    voterHash: hashVoterId(voterId),
    walletAddress: validatedWalletAddress,
    timestamp: new Date().toISOString(),
  };
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const transaction = await buildPreparedTransaction(validatedWalletAddress, payloadHash);

  return createPendingAction({
    type: 'vote',
    voterId,
    walletAddress: validatedWalletAddress,
    details: {
      candidateId: numericCandidateId,
    },
    payloadHash,
    transaction,
  });
}

function validateSubmittedTransaction(pendingAction, signedTxXdr) {
  const transaction = parseTransactionFromXdr(signedTxXdr);
  const sourceAddress = transaction.source;
  const transactionHash = transaction.hash().toString('hex');

  if (sourceAddress !== pendingAction.walletAddress) {
    throw new Error('The signed transaction does not match the connected Freighter wallet.');
  }

  if (transactionHash !== pendingAction.transactionHash) {
    throw new Error('The signed transaction does not match the prepared election action.');
  }

  if (!transaction.signatures?.length) {
    throw new Error('Freighter did not add a signature to this Stellar transaction.');
  }

  return transaction;
}

function validateVotingDates(startDate, endDate) {
  if (!Number.isInteger(startDate) || !Number.isInteger(endDate)) {
    throw new Error('Voting dates must be valid unix timestamps.');
  }

  if (endDate <= startDate) {
    throw new Error('End date must be after the start date.');
  }

  const now = getNowUnix();
  if (endDate <= now) {
    throw new Error('End date must be in the future.');
  }
}

function validateVoteRequest(state, candidateId, voterId) {
  if (!Number.isInteger(candidateId)) {
    throw new Error('A valid candidate must be selected.');
  }

  const candidate = state.candidates.find((entry) => entry.id === candidateId);

  if (!candidate) {
    throw new Error('Candidate not found.');
  }

  if (!state.dates.start || !state.dates.end) {
    throw new Error('Voting dates have not been configured yet.');
  }

  if (!isVotingOpen(state)) {
    throw new Error('Voting is not currently open.');
  }

  if (state.votesByVoter[voterId]) {
    throw new Error('This voter has already cast a ballot.');
  }
}

function finalizeAddCandidate(state, pendingAction, anchor) {
  const candidate = {
    id: state.candidates.length + 1,
    name: pendingAction.details.name,
    party: pendingAction.details.party,
    voteCount: 0,
  };

  state.candidates.push(candidate);
  state.auditLog.push({
    type: 'add_candidate',
    timestamp: new Date().toISOString(),
    actor: pendingAction.actor,
    walletAddress: pendingAction.walletAddress,
    candidateId: candidate.id,
    transactionHash: anchor.transactionHash,
    ledger: anchor.ledger,
    payloadHash: pendingAction.payloadHash,
  });
  saveState(state);

  return {
    candidate,
    anchor,
    state: buildPublicState(state),
  };
}

function finalizeSetVotingDates(state, pendingAction, anchor) {
  state.dates = {
    start: pendingAction.details.start,
    end: pendingAction.details.end,
  };
  state.auditLog.push({
    type: 'set_dates',
    timestamp: new Date().toISOString(),
    actor: pendingAction.actor,
    walletAddress: pendingAction.walletAddress,
    start: pendingAction.details.start,
    end: pendingAction.details.end,
    transactionHash: anchor.transactionHash,
    ledger: anchor.ledger,
    payloadHash: pendingAction.payloadHash,
  });
  saveState(state);

  return {
    dates: state.dates,
    anchor,
    state: buildPublicState(state),
  };
}

function finalizeVote(state, pendingAction, anchor) {
  const candidate = state.candidates.find((entry) => entry.id === pendingAction.details.candidateId);

  if (!candidate) {
    throw new Error('Candidate not found.');
  }

  if (!state.dates.start || !state.dates.end) {
    throw new Error('Voting dates have not been configured yet.');
  }

  if (!isVotingOpen(state)) {
    throw new Error('Voting is not currently open.');
  }

  if (state.votesByVoter[pendingAction.voterId]) {
    throw new Error('This voter has already cast a ballot.');
  }

  candidate.voteCount += 1;
  state.votesByVoter[pendingAction.voterId] = {
    candidateId: pendingAction.details.candidateId,
    timestamp: new Date().toISOString(),
    transactionHash: anchor.transactionHash,
    walletAddress: pendingAction.walletAddress,
  };
  state.auditLog.push({
    type: 'vote',
    timestamp: new Date().toISOString(),
    voterHash: hashVoterId(pendingAction.voterId),
    walletAddress: pendingAction.walletAddress,
    candidateId: pendingAction.details.candidateId,
    transactionHash: anchor.transactionHash,
    ledger: anchor.ledger,
    payloadHash: pendingAction.payloadHash,
  });
  saveState(state);

  return {
    candidate,
    anchor,
    state: buildPublicState(state, pendingAction.voterId),
  };
}

async function submitPreparedAction({ actionId, signedTxXdr, actor, voterId }) {
  const pendingAction = getPendingAction(actionId);

  if (pendingAction.actor && actor && pendingAction.actor !== actor) {
    removePendingAction(actionId);
    throw new Error('The signed action does not belong to the current admin session.');
  }

  if (pendingAction.voterId && voterId && pendingAction.voterId !== voterId) {
    removePendingAction(actionId);
    throw new Error('The signed action does not belong to the current voter session.');
  }

  const signedTransaction = validateSubmittedTransaction(pendingAction, signedTxXdr);
  const state = loadState();

  if (pendingAction.type === 'set_dates') {
    validateVotingDates(pendingAction.details.start, pendingAction.details.end);
  }

  if (pendingAction.type === 'vote') {
    validateVoteRequest(state, pendingAction.details.candidateId, pendingAction.voterId);
  }

  const result = await getServer().submitTransaction(signedTransaction);
  const anchor = {
    transactionHash: result.hash,
    ledger: result.ledger,
    publicKey: pendingAction.walletAddress,
    payloadHash: pendingAction.payloadHash,
  };

  removePendingAction(actionId);

  if (pendingAction.type === 'add_candidate') {
    return finalizeAddCandidate(state, pendingAction, anchor);
  }

  if (pendingAction.type === 'set_dates') {
    return finalizeSetVotingDates(state, pendingAction, anchor);
  }

  if (pendingAction.type === 'vote') {
    return finalizeVote(state, pendingAction, anchor);
  }

  throw new Error('Unsupported pending Stellar action.');
}

module.exports = {
  getElectionState,
  prepareAddCandidate,
  prepareSetVotingDates,
  prepareVote,
  submitPreparedAction,
};
