import {
  connectFreighter,
  formatFreighterAddress,
  hasFreighterExtension,
  readFreighterAddress,
  readFreighterNetwork,
  signFreighterTransaction,
} from './freighter.js';

const authToken =
  new URLSearchParams(window.location.search).get('Authorization')?.replace('Bearer ', '') ||
  localStorage.getItem('jwtTokenAdmin') ||
  localStorage.getItem('jwtTokenVoter');

let currentElectionState = null;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  };
}

function setMessage(message, isError = false) {
  const element = document.getElementById('msg');

  if (!element) {
    return;
  }

  element.innerHTML = `<p style="color:${isError ? '#a40000' : '#0b6b0b'};">${message}</p>`;
}

function formatDateRange(dates) {
  if (!dates?.start || !dates?.end) {
    return 'Not scheduled yet';
  }

  const startDate = new Date(dates.start * 1000);
  const endDate = new Date(dates.end * 1000);
  return `${startDate.toDateString()} - ${endDate.toDateString()}`;
}

function renderCandidates(candidates, allowVote) {
  const tableBody = document.getElementById('boxCandidate');

  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = '';

  candidates.forEach((candidate) => {
    const selector = allowVote
      ? `<input class="form-check-input" type="radio" name="candidate" value="${candidate.id}" id="candidate-${candidate.id}"> `
      : '';

    tableBody.insertAdjacentHTML(
      'beforeend',
      `<tr><td>${selector}${candidate.name}</td><td>${candidate.party}</td><td>${candidate.voteCount}</td></tr>`
    );
  });
}

async function fetchElectionState() {
  const response = await fetch('/api/election/state', {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unable to load election state.' }));
    throw new Error(error.message);
  }

  const state = await response.json();
  currentElectionState = state;
  return state;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

async function ensureFreighterWallet(expectedNetworkPassphrase) {
  if (!hasFreighterExtension()) {
    throw new Error('Freighter is required for this action. Install the extension and connect a Stellar testnet wallet.');
  }

  let walletAddress = await readFreighterAddress();

  if (!walletAddress) {
    const connection = await connectFreighter();

    if (connection.error) {
      throw connection.error;
    }

    walletAddress = connection.address;
  }

  if (!walletAddress) {
    throw new Error('Freighter did not return a wallet address.');
  }

  const network = await readFreighterNetwork();

  if (network.error) {
    throw network.error;
  }

  if (expectedNetworkPassphrase && network.networkPassphrase && network.networkPassphrase !== expectedNetworkPassphrase) {
    throw new Error('Freighter is connected to a different Stellar network. Switch Freighter to Stellar testnet and try again.');
  }

  return walletAddress;
}

async function submitFreighterAction(prepareUrl, payload) {
  const networkPassphrase = currentElectionState?.stellar?.networkPassphrase || '';
  const walletAddress = await ensureFreighterWallet(networkPassphrase);
  const preparedAction = await postJson(prepareUrl, {
    ...payload,
    walletAddress,
  });
  const signed = await signFreighterTransaction(preparedAction.transactionXdr, {
    address: walletAddress,
    networkPassphrase: preparedAction.networkPassphrase,
  });

  if (signed.error) {
    throw signed.error;
  }

  return postJson('/api/election/submit', {
    actionId: preparedAction.actionId,
    signedTxXdr: signed.signedTxXdr,
  });
}

function updateAccountBanner(state, freighterAddress) {
  const accountParts = [`Authenticated Voter: ${state.accountLabel}`];

  if (freighterAddress) {
    accountParts.push(`Freighter Wallet: ${formatFreighterAddress(freighterAddress)}`);
  } else {
    accountParts.push('Freighter Wallet: not connected');
  }

  accountParts.push('Signing: Freighter');
  document.getElementById('accountAddress').textContent = accountParts.join(' | ');
}

window.App = {
  async eventStart() {
    try {
      const state = await fetchElectionState();
      const isAdminPage = window.location.pathname.endsWith('/admin.html');
      const freighterAddress = await readFreighterAddress();

      document.getElementById('dates').textContent = formatDateRange(state.dates);
      updateAccountBanner(state, freighterAddress);
      renderCandidates(state.candidates, !isAdminPage);

      const voteButton = document.getElementById('voteButton');
      if (voteButton) {
        const votingLocked = state.hasVoted || !state.votingOpen || state.candidates.length === 0;
        voteButton.disabled = votingLocked;

        if (votingLocked) {
          if (state.hasVoted) {
            setMessage('You have already voted in this election.');
          } else if (!state.votingOpen) {
            setMessage('Voting is not currently open.', true);
          } else {
            setMessage('Add at least one candidate before voting.', true);
          }
        }
      }

      if (isAdminPage) {
        const addCandidateButton = document.getElementById('addCandidate');
        const addDateButton = document.getElementById('addDate');

        if (addCandidateButton) {
          addCandidateButton.onclick = async () => {
            try {
              await submitFreighterAction('/api/election/candidates/prepare', {
                name: document.getElementById('name').value,
                party: document.getElementById('party').value,
              });
              setMessage('Candidate added on Stellar testnet.');
              window.location.reload();
            } catch (error) {
              setMessage(error.message, true);
            }
          };
        }

        if (addDateButton) {
          addDateButton.onclick = async () => {
            try {
              const start = Math.floor(new Date(document.getElementById('startDate').value).getTime() / 1000);
              const end = Math.floor(new Date(document.getElementById('endDate').value).getTime() / 1000);

              await submitFreighterAction('/api/election/dates/prepare', { start, end });
              setMessage('Voting dates recorded on Stellar testnet.');
              window.location.reload();
            } catch (error) {
              setMessage(error.message, true);
            }
          };
        }
      }
    } catch (error) {
      setMessage(error.message, true);
    }
  },

  async vote() {
    const candidateId = document.querySelector("input[name='candidate']:checked")?.value;

    if (!candidateId) {
      setMessage('Please vote for a candidate.', true);
      return;
    }

    try {
      await submitFreighterAction('/api/election/vote/prepare', { candidateId: Number(candidateId) });
      document.getElementById('voteButton').disabled = true;
      setMessage('Vote recorded on Stellar testnet.');
      window.location.reload();
    } catch (error) {
      setMessage(error.message, true);
    }
  },
};

window.addEventListener('load', () => {
  window.App.eventStart();
});
