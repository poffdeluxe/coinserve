#!/usr/bin/env node

const cp = require('child_process');
const bitcore = require('bitcore-lib');
const eccrypto = require('eccrypto');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const DEFAULT_SATOSHI = 1000;
const DEFAULT_NUM_SEED_WALLETS = 5;

let wallets;
let walletByAddress = {};

const buildByAddrLookup = () => {
  Object.keys(wallets).forEach(function(wif) {
    const privateKey = new bitcore.PrivateKey(wif);
    const addr = privateKey.toAddress(bitcore.Networks.testnet).toString();
    walletByAddress[addr.toString()] = wif;
  });
};

// Load-up our args (looking for a seed filename or a webhook url)
const argOpts = {
  alias: {
    hook: 'h',
    seedFilename: 's'
  }
};
const argv = require('minimist')(process.argv.slice(2), argOpts);

const seedFilename = argv.seedFilename;
if(seedFilename) {
  const seedWallets = require(seedFilename);

  // Copy in the seed wallets.
  wallets = Object.assign({}, seedWallets);
}

const hookUrl = argv.hook;

// If we didn't just load wallets from a file, load up some seed wallets
if(!wallets) {
  wallets = {};

  for(var i = 0; i < DEFAULT_NUM_SEED_WALLETS; ++i) {
    const privateKey = new bitcore.PrivateKey();
    const wif = privateKey.toWIF();

    wallets[wif] = DEFAULT_SATOSHI;
  }
}

// Build our lookup
buildByAddrLookup();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/balance/:addr', (req, res) => {
  const addr = req.params.addr;
  const wif = walletByAddress[addr]

  if(!wif) {
    return res.sendStatus(404);
  }

  const balance = wallets[wif];

  return res.json({ balance });
});

app.post('/tx/create', (req, res) => {
  const to = req.body.to;
  const from = req.body.from;
  const amount = req.body.amount;

  // Make sure wallet exists
  if(!walletByAddress[to] || !walletByAddress[from]) {
    return res.sendStatus(400);
  }

  const fromWalletBalance = wallets[walletByAddress[from]];
  if(amount > fromWalletBalance) {
    return res.sendStatus(400);
  }

  var hash = crypto.randomBytes(20).toString('hex');
  const tx = { to, from, amount, hash };
  const toSign = crypto.createHash('sha256').update(JSON.stringify(tx)).digest().toString('hex');

  return res.json({tx, toSign});
});

app.post('/tx/sign', (req, res) => {
  // Expects tx we're verifying
  // Public in key format
  // and signature of transaction (in hex format)

  const tx = req.body.tx;
  const publicKey = Buffer.from(req.body.publicKey, 'hex');
  const toSign = crypto.createHash('sha256').update(JSON.stringify(tx)).digest();
  const sig = Buffer.from(req.body.sig, 'hex');

  eccrypto.verify(publicKey, toSign, sig).then(function() {
    wallets[walletByAddress[tx.from]] -= tx.amount;
    wallets[walletByAddress[tx.to]] += tx.amount;

    console.log(`Transfering ${tx.amount} from ${tx.from} to ${tx.to}`);

    // Send the response
    res.json(tx);

    // Call the webhook if one is defined
    if(hookUrl) {
      const child = cp.fork(__dirname + '/' + '/hook');

      child.send({
        tx,
        hookUrl
      });
    }
  }).catch(function() {
    res.status(400).json({errors: ['Failed to verify signature']});
  });
});

app.listen(3001, function () {
  console.log('Service running on port 3001!');

  console.log('WIF (ADDR): BALANCE');
  Object.keys(wallets).forEach(function(wif) {
    const privateKey = new bitcore.PrivateKey(wif);
    const addr = privateKey.toAddress(bitcore.Networks.testnet).toString();
    const balance = wallets[wif];

    console.log(`${privateKey.toWIF()} (${addr}): ${balance}`);
  });

  if(hookUrl) {
    console.log(`Webhook set to hit ${hookUrl}`);
  }
});
