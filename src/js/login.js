import { connectFreighter, formatFreighterAddress, hasFreighterExtension, readFreighterAddress } from './freighter.js';

const loginForm = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const freighterButton = document.getElementById('freighterConnect');
const freighterStatus = document.getElementById('freighterStatus');

function setFreighterStatus(message, isError = false) {
  if (!freighterStatus) {
    return;
  }

  freighterStatus.textContent = message;
  freighterStatus.style.color = isError ? '#ffb3b3' : 'azure';
}

async function refreshFreighterStatus() {
  if (!freighterStatus) {
    return;
  }

  if (!hasFreighterExtension()) {
    setFreighterStatus('Freighter is not installed. You can still use the demo login.');
    if (freighterButton) {
      freighterButton.disabled = true;
    }
    return;
  }

  const address = await readFreighterAddress();

  if (address) {
    setFreighterStatus(`Freighter connected: ${formatFreighterAddress(address)}`);
  } else {
    setFreighterStatus('Freighter is available. Click the button to connect your wallet.');
  }
}

if (freighterButton) {
  freighterButton.addEventListener('click', async () => {
    setFreighterStatus('Requesting Freighter access...');

    try {
      const result = await connectFreighter();

      if (result.error) {
        setFreighterStatus(result.error.message, true);
        return;
      }

      setFreighterStatus(`Freighter connected: ${formatFreighterAddress(result.address)}`);
    } catch (error) {
      setFreighterStatus(error.message, true);
    }
  });
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const voter_id = document.getElementById('voter-id').value;
  const password = document.getElementById('password').value;
  if (errorBox) {
    errorBox.textContent = '';
  }

  fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voter_id, password }),
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      return response.json().then((data) => {
        throw new Error(data.message || 'Login failed');
      });
    }
  })
  .then(data => {
    if (data.role === 'admin') {
      localStorage.setItem('jwtTokenAdmin', data.token);
      window.location.replace(`/admin.html?Authorization=Bearer ${localStorage.getItem('jwtTokenAdmin')}`);
    } else if (data.role === 'user'){
      localStorage.setItem('jwtTokenVoter', data.token);
      window.location.replace(`/index.html?Authorization=Bearer ${localStorage.getItem('jwtTokenVoter')}`);
    }
  })
  .catch(error => {
    if (errorBox) {
      errorBox.textContent = error.message;
    }
  });
});

window.addEventListener('load', () => {
  refreshFreighterStatus();
});
