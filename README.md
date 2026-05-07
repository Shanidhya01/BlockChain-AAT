# VoteVault: Stellar-Based Voting App

VoteVault is a local voting application that uses Stellar testnet to anchor election activity on-chain. It started as an Ethereum/Truffle project, but the active app flow now runs through a Node.js server that prepares election transactions for the UI to sign with Freighter and serves the admin and voter pages directly.

## Overview

- Admins can add candidates and configure voting dates.
- Voters can log in and cast one vote during the active voting window.
- Candidate creation, date changes, and votes are anchored to Stellar testnet transactions signed with Freighter.
- Election state is also stored locally so the app is easy to run in development.
- The app includes seeded demo users, so it can run without MySQL or the old Python auth service.

## Current Architecture

- `index.js`
  Express server, auth endpoints, protected election routes, and static page serving.
- `src/services/stellarElection.js`
  Stellar integration, local election state management, and transaction anchoring.
- `src/services/authStore.js`
  Seeded demo login storage for local use.
- `src/js/app.js`
  Admin and voter page behavior.
- `src/js/login.js`
  Login flow for the demo users.
- `data/election-state.json`
  Generated at runtime and stores candidates, vote state, and audit log metadata.
- `data/voters.json`
  Generated at runtime and stores seeded local users.

## Requirements

- Node.js 18 or later
- Freighter browser extension with a Stellar testnet account
- Internet access to:
  Stellar Horizon testnet
  Friendbot, for first-time testnet account funding

## Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Review `.env`.

   The app still uses the Horizon configuration and JWT secret from `.env`:

   ```env
   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
   SECRET_KEY=...
   ```

## Running The App

1. Start the server:

   ```bash
   npm start
   ```

2. Open:

   ```text
   http://localhost:8080/
   ```

## Demo Credentials

- Admin: `admin001` / `admin123`
- Voter: `voter001` / `voter123`

These are seeded automatically the first time the app runs.

## Verified Local Flow

The current implementation has been exercised end to end:

1. Admin login works.
2. Election state loads correctly after authentication.
3. Admin can add a candidate.
4. Admin can set voting dates.
5. Voter can cast one vote.
6. Each election action is anchored to Stellar testnet.

## Stellar Behavior

- On each blockchain action, the server prepares a Stellar transaction for the connected Freighter wallet.
- If the wallet account does not exist and the network is Stellar testnet, the app attempts to fund it automatically using Friendbot before signing.
- Each election action creates a small self-payment transaction with a memo derived from the action payload hash.
- The resulting transaction hash and ledger number are stored in the local audit log.

## Local Data Files

The app creates these runtime files automatically:

- `data/election-state.json`
- `data/voters.json`

They are ignored by git and can be deleted if you want to reset local state.

## Legacy Files Still In The Repo

This repository still contains older Ethereum-era files for reference, including:

- `contracts/`
- `migrations/`
- `truffle-config.js`
- `Database_API/`

These are no longer part of the active app flow.

## Notes

- The active app no longer depends on MetaMask, Ganache, Truffle, Browserify bundling, or the Python/MySQL login service.
- Freighter is required for add-candidate, date update, and voting actions because it signs the Stellar transactions.
- If Stellar Horizon or Friendbot is unreachable, login will still work, but blockchain-backed election actions will fail until network access is available.
- The current project `package.json` still uses the original package name and license metadata from the earlier version.

## License

See [LICENSE](D:\BC\votevault\LICENSE).
