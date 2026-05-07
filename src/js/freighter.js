const FREIGHTER_ADDRESS_STORAGE_KEY = 'freighterAddress';

function getFreighterApi() {
  return window.freighterApi || null;
}

function hasFreighterExtension() {
  return Boolean(getFreighterApi());
}

function formatFreighterAddress(address) {
  if (!address) {
    return '';
  }

  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function getStoredFreighterAddress() {
  return localStorage.getItem(FREIGHTER_ADDRESS_STORAGE_KEY) || '';
}

function setStoredFreighterAddress(address) {
  if (address) {
    localStorage.setItem(FREIGHTER_ADDRESS_STORAGE_KEY, address);
  } else {
    localStorage.removeItem(FREIGHTER_ADDRESS_STORAGE_KEY);
  }
}

async function readFreighterAddress() {
  const api = getFreighterApi();

  if (!api?.isConnected || !api?.getAddress) {
    return getStoredFreighterAddress();
  }

  const connection = await api.isConnected();
  if (!connection.isConnected) {
    return getStoredFreighterAddress();
  }

  const result = await api.getAddress();
  const address = result.address || '';

  if (address) {
    setStoredFreighterAddress(address);
  }

  return address || getStoredFreighterAddress();
}

async function connectFreighter() {
  const api = getFreighterApi();

  if (!api?.requestAccess) {
    return {
      address: '',
      error: new Error('Freighter is not installed. Install the Freighter extension to connect a wallet.'),
    };
  }

  const result = await api.requestAccess();
  const address = result.address || '';

  if (result.error || !address) {
    return {
      address: '',
      error: new Error(result.error?.message || 'Unable to connect to Freighter.'),
    };
  }

  setStoredFreighterAddress(address);

  return {
    address,
    error: null,
  };
}

async function readFreighterNetwork() {
  const api = getFreighterApi();

  if (!api?.getNetworkDetails) {
    return {
      network: '',
      networkPassphrase: '',
      error: new Error('Freighter network details are unavailable.'),
    };
  }

  const result = await api.getNetworkDetails();

  if (result.error) {
    return {
      network: '',
      networkPassphrase: '',
      error: new Error(result.error.message || 'Unable to read the Freighter network.'),
    };
  }

  return {
    network: result.network || '',
    networkPassphrase: result.networkPassphrase || '',
    error: null,
  };
}

async function signFreighterTransaction(transactionXdr, { networkPassphrase, address } = {}) {
  const api = getFreighterApi();

  if (!api?.signTransaction) {
    return {
      signedTxXdr: '',
      signerAddress: '',
      error: new Error('Freighter is not installed. Install the Freighter extension to sign transactions.'),
    };
  }

  if (api.requestAccess) {
    const access = await api.requestAccess();

    if (access.error) {
      return {
        signedTxXdr: '',
        signerAddress: '',
        error: new Error(access.error.message || 'Unable to access the Freighter wallet.'),
      };
    }
  }

  const result = await api.signTransaction(transactionXdr, {
    networkPassphrase,
    address,
  });

  if (result.error || !result.signedTxXdr) {
    return {
      signedTxXdr: '',
      signerAddress: '',
      error: new Error(result.error?.message || 'Freighter could not sign this transaction.'),
    };
  }

  if (result.signerAddress) {
    setStoredFreighterAddress(result.signerAddress);
  }

  return {
    signedTxXdr: result.signedTxXdr,
    signerAddress: result.signerAddress || address || '',
    error: null,
  };
}

export {
  connectFreighter,
  formatFreighterAddress,
  getStoredFreighterAddress,
  hasFreighterExtension,
  readFreighterAddress,
  readFreighterNetwork,
  setStoredFreighterAddress,
  signFreighterTransaction,
};

window.VoteVaultFreighter = {
  connectFreighter,
  formatFreighterAddress,
  getStoredFreighterAddress,
  hasFreighterExtension,
  readFreighterAddress,
  readFreighterNetwork,
  signFreighterTransaction,
  setStoredFreighterAddress,
};
