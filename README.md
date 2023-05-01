# Events subscription tester

# Overview

This program will connect on 2 nodes, one for events subscriptions and the other for sending signed transaction. That way, we get the same emulation as the final system, composed of a browser dApp connected to a node through Metamask and the cache API connected to Quiknode to read data and subscribe events.

# Installation

Simply run `npm install`.

Then open the .env file to specify the following variables :

| Variable name  | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| JSON_RPC_URL   | URL to the WS RPC node to use for events subscriptions (eg. Quiknode)     |
| SIGNER_RPC_URL | URL of the Json RPC to use for sending signed transactions (eg. Metamask) |
| ADDRESS        | Wallet public address                                                     |
| PRIVATE_KEY    | Wallet private key                                                        |

# Updating test smart contract

The app provides a single contract `solidity/SampleContract.sol`.

It can be built using the npm script `npm run contracts`. This uses the script `solidity/buildContract.js` with the default compile template in `solidity/solc.json`.

The JSON compile outputs are then updated in `src/contracts`.

# Running the tester

The npm script `npm start` will run the entrypoint for the testing process `src/index.ts`.

This will :

- prepare the two providers
- deploy a new `SampleContract`
- subscribe to events on it
- every ten seconds call SampleContract.add with a random value
- every ten seconds call SampleContract.sub with a random value

The last two operations will update a counter in the contract. Each update generates a new event. Those events will then be compared to the date of mining for the same tx to determine and log the notification delay.

Websocket connection losses will result in restarting the Websocket provider and trying to find missed events.

After one hour of running (hoping we'll get disconnected from the websocket), the program will review all events fired since the contract deployment and compare them to the list of events that were notified to find missed ones.
