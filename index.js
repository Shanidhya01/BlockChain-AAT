const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const { ensureVotersFile, findUser } = require('./src/services/authStore');
const {
  getElectionState,
  prepareAddCandidate,
  prepareSetVotingDates,
  prepareVote,
  submitPreparedAction,
} = require('./src/services/stellarElection');

require('dotenv').config();

const app = express();
app.use(express.json());
ensureVotersFile();


// Authorization middleware
const authorizeUser = (req, res, next) => {
  const authHeader = req.headers.authorization || req.query.Authorization;
  const token = authHeader?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).send('<h1 align="center"> Login to Continue </h1>');
  }
  
  try {
    // Verify and decode the token
    const decodedToken = jwt.verify(token, process.env.SECRET_KEY, { algorithms: ['HS256'] });

    req.user = decodedToken;
    next(); // Proceed to the next middleware
  } catch (error) {
    return res.status(401).json({ message: 'Invalid authorization token' });
  }
};

const authorizeAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/login.html'));
});

app.get('/js/login.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/login.js'))
});

app.get('/css/login.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/login.css'))
});

app.get('/css/index.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/index.css'))
});

app.get('/css/admin.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/css/admin.css'))
});

app.get('/assets/eth5.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/assets/eth5.jpg'))
});

app.get('/js/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/app.js'))
});

app.get('/js/freighter.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/js/freighter.js'));
});

app.get('/vendor/freighter-api.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/@stellar/freighter-api/build/index.min.js'));
});

app.get('/admin.html', authorizeUser, (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/admin.html'));
});

app.get('/index.html', authorizeUser, (req, res) => {
  res.sendFile(path.join(__dirname, 'src/html/index.html'));
});

app.post('/api/auth/login', (req, res) => {
  const voterId = String(req.body.voter_id || '').trim();
  const password = String(req.body.password || '').trim();
  const user = findUser(voterId, password);

  if (!user) {
    return res.status(401).json({ message: 'Invalid voter id or password' });
  }

  const token = jwt.sign(
    { voter_id: user.voter_id, role: user.role },
    process.env.SECRET_KEY,
    { algorithm: 'HS256' }
  );

  res.json({
    token,
    role: user.role,
    voter_id: user.voter_id,
  });
});

app.get('/api/election/state', authorizeUser, async (req, res) => {
  try {
    const state = await getElectionState(req.user.voter_id);
    res.json({
      ...state,
      accountLabel: req.user.voter_id,
      role: req.user.role,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/election/candidates/prepare', authorizeUser, authorizeAdmin, async (req, res) => {
  try {
    const result = await prepareAddCandidate({
      name: req.body.name,
      party: req.body.party,
      actor: req.user.voter_id,
      walletAddress: req.body.walletAddress,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/election/dates/prepare', authorizeUser, authorizeAdmin, async (req, res) => {
  try {
    const result = await prepareSetVotingDates({
      start: req.body.start,
      end: req.body.end,
      actor: req.user.voter_id,
      walletAddress: req.body.walletAddress,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/election/vote/prepare', authorizeUser, async (req, res) => {
  try {
    const result = await prepareVote({
      candidateId: req.body.candidateId,
      voterId: req.user.voter_id,
      walletAddress: req.body.walletAddress,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/election/submit', authorizeUser, async (req, res) => {
  try {
    const result = await submitPreparedAction({
      actionId: req.body.actionId,
      signedTxXdr: req.body.signedTxXdr,
      actor: req.user.voter_id,
      voterId: req.user.voter_id,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Serve the favicon.ico file
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/favicon.ico'));
});

// Start the server
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
