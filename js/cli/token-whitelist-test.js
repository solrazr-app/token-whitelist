// @flow

import {
  Account,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {AccountLayout, Token,} from '@solana/spl-token';

import {TokenWhitelist} from '../client/token-whitelist';
import {sendAndConfirmTransaction} from '../client/util/send-and-confirm-transaction';
import {
  newAccountWithLamports,
  loadAccountWithLamports,
  loadAccount,
  loadWalletWithLamports,
  loadWallet,
} from '../client/util/new-account-with-lamports';
import {url} from '../url';
import {sleep} from '../client/util/sleep';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_WHITELIST_PROGRAM_ID,
} from '../client/pubkeys';

// Token sale
let tokenWhitelist: TokenWhitelist;
// payer
let payer: Account;
// mintAuthority of the usdt mint
let mintAuthority: Account;
// Token mints & accounts
let mintUSDT: Token;
let accountToAdd: PublicKey;

const MAX_WHITELIST_SIZE = 100;

let connection;
async function getConnection(): Promise<Connection> {
  if (connection) return connection;

  connection = new Connection(url, 'recent');
  const version = await connection.getVersion();

  console.log('Connection to cluster established:', url, version);
  return connection;
}

export async function InitTokenWhitelist(): Promise<void> {
  const connection = await getConnection();
  payer = await newAccountWithLamports(connection, 100000000);

  console.log('>>>>> TOKEN_PROGRAM_ID: ', TOKEN_PROGRAM_ID.toString());
  console.log('>>>>> TOKEN_WHITELIST_PROGRAM_ID: ', TOKEN_WHITELIST_PROGRAM_ID.toString());

  tokenWhitelist = await TokenWhitelist.createTokenWhitelist(
    connection,
    payer,
    TOKEN_WHITELIST_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
  );

  console.log('Init Whitelist');
  await tokenWhitelist.initTokenWhitelist(
    payer,
    MAX_WHITELIST_SIZE, // max whitelist size
  );

  await sleep(500);
  console.log('Init Whitelist Done');
}

export async function AddToWhitelist(): Promise<void> {
  const connection = await getConnection();
  wallet = await newAccountWithLamports(connection, 100000000);

  accountToAdd = wallet.publicKey; // used to execute token sale
  console.log('>>>>> Account To Add To Whitelist: ', accountToAdd.toString());
  
  console.log('Add To Whitelist');
  await tokenWhitelist.addToWhitelist(
    payer,
    accountToAdd,
  );

  await sleep(500);
  console.log('Add To Whitelist - Done');
}

export async function RemoveFromWhitelist(): Promise<void> {
  const connection = await getConnection();

  let accountToRemove = accountToAdd;
  console.log('>>>>> Account To Remove From Whitelist: ', accountToRemove.toString());
  
  console.log('Remove From Whitelist');
  await tokenWhitelist.removeFromWhitelist(
    payer,
    accountToRemove,
  );

  await sleep(500);
  console.log('Remove From Whitelist - Done');
}
