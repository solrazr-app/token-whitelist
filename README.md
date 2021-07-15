# SolRazr Token Whitelist

This repo contains
* Token Whitelist program
* JavaScript bindings (using @solana/web3.js)
* Test client

## Environment Setup

1. Install the latest Rust stable from https://rustup.rs/
2. Install Solana v1.6.6 or later from https://docs.solana.com/cli/install-solana-cli-tools

## Build And Deploy Token Whitelist Program

Start a local Solana cluster:
```bash
$ solana-test-validator
```
Build token whitelist on-chain program
```bash
$ cd program
$ cargo build-bpf
```
Deploy the program to localnet using the command displayed when you run the build above. Note down the public-key of the program once deployed (this is the solrazr-token-whitelist program id) and do the following.

Update `TOKEN_WHITELIST_PROGRAM_ID` inside `js/client/pubkeys.js` with the public-key generated above

## Running JS Client To Create Token Whitelist

You can use the JS client to test the program
```bash
$ cd js
$ npm run start
```
You can modify `js/cli/main.js` and `js/cli/token-sale-test.js` to suit your needs.

## Using Token Whitelist In Token Sale

In order to run token sale program (https://github.com/solrazr-app/solr-token-sale), you need token whitelist map to be created.

You can find token whitelist map account printed to console when you run the JS client above. You need to use this account when initialising token sale.
