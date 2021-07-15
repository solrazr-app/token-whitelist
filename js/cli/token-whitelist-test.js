// @flow

import BN from 'bn.js';
import {
  Account,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {AccountLayout, Token,} from '@solana/spl-token';

import {
  TokenWhitelist,
  TOKEN_WHITELIST_MAP_DATA_LAYOUT,
  TOKEN_WHITELIST_ACCOUNT_DATA_LAYOUT,
} from '../client/token-whitelist';
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

/** 
 * Do not exceed 50 for MAX_WHITELIST_SIZE and MAX_WHITELIST_ACCOUNTS, exceeding 50 will result in
 * BTreeMap consuming more than 200K compute units and program will be halted by solana runtime.
 * To overcome this limitation, we have implemented map of maps to accommodate upto 2500 whitelists
 */
const MAX_WHITELIST_SIZE = 50; // number of user addresses that can be added to each whitelist
const MAX_WHITELIST_ACCOUNTS = 5; // number of whitelist accounts that can be added to the whitelist map

const ALLOCATION_AMOUNT = 250*1000000; // amount of base tokens multiplied represented in 6 decimals

function assert(condition, message) {
  if (!condition) {
    console.log(Error().stack + ':token-sale-test.js');
    throw message || 'Assertion failed';
  }
}

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
  payer = await newAccountWithLamports(connection, 10000000000);

  tokenWhitelist = await TokenWhitelist.createTokenWhitelist(
    connection,
    payer,
    TOKEN_WHITELIST_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
  );

  assert(tokenWhitelist.payer.publicKey.toString() == payer.publicKey.toString());
  assert(tokenWhitelist.tokenWhitelistProgramId.toString() == TOKEN_WHITELIST_PROGRAM_ID.toString());
  assert(tokenWhitelist.tokenProgramId.toString() == TOKEN_PROGRAM_ID.toString());

  console.log('Init Whitelist Map');
  await tokenWhitelist.initTokenWhitelistMap(
    payer,
    MAX_WHITELIST_ACCOUNTS, // number of whitelist accounts that can be added to the whitelist map
  );

  await sleep(500);

  console.log('Checking if init whitelist map was successful...');
  assert(tokenWhitelist.tokenWhitelistMap != null);
  let tokenWhitelistState;
  try {
      let tokenWhitelistInfo = await connection.getAccountInfo(tokenWhitelist.tokenWhitelistMap.publicKey, 'singleGossip');
      tokenWhitelistState = tokenWhitelistInfo.data;
  } catch (err) {
      throw new Error("Could not find token whitelist map account at given address!");
  }
  const tokenWhitelistLayout = TOKEN_WHITELIST_MAP_DATA_LAYOUT.decode(tokenWhitelistState);
  assert(tokenWhitelistLayout.isInitialized);
  assert(payer.publicKey.toBase58() == new PublicKey(tokenWhitelistLayout.initPubkey).toBase58());
  assert(MAX_WHITELIST_ACCOUNTS == new BN(tokenWhitelistLayout.maxWhitelistAccounts, 10, "le").toNumber());

  for (let i = 1; i <= MAX_WHITELIST_ACCOUNTS; i++) {
    await connection.requestAirdrop(payer.publicKey, 5000000000);
    let tokenWhitelistAccount = new Account();
    await InitTokenWhitelistAccount(tokenWhitelistAccount);
    await AddWhitelistToMap(tokenWhitelistAccount.publicKey);
  }
}

async function InitTokenWhitelistAccount(tokenWhitelistAccount: Account): Promise<void> {
  assert(tokenWhitelistAccount != null);

  console.log('Init Whitelist: ', tokenWhitelistAccount.publicKey.toString());
  await tokenWhitelist.initTokenWhitelist(
    payer,
    tokenWhitelistAccount,
    MAX_WHITELIST_SIZE, // number of user addresses that can be added to each whitelist
  );

  await sleep(500);
  
  let tokenWhitelistState;
  try {
      let tokenWhitelistInfo = await connection.getAccountInfo(tokenWhitelistAccount.publicKey, 'singleGossip');
      tokenWhitelistState = tokenWhitelistInfo.data;
  } catch (err) {
      throw new Error("Could not find token whitelist account at given address!");
  }
  const tokenWhitelistLayout = TOKEN_WHITELIST_ACCOUNT_DATA_LAYOUT.decode(tokenWhitelistState);
  assert(tokenWhitelistLayout.isInitialized);
  assert(payer.publicKey.toBase58() == new PublicKey(tokenWhitelistLayout.initPubkey).toBase58());
  assert(MAX_WHITELIST_SIZE == new BN(tokenWhitelistLayout.maxWhitelistSize, 10, "le").toNumber());
}

async function AddWhitelistToMap(accountToAdd: PublicKey): Promise<void> {
  console.log('Add Whitelist To Map: ', accountToAdd.toString());
  await tokenWhitelist.addWhitelistToMap(
    payer,
    accountToAdd,
    1, // allocation amount can be ignored for map of maps
  );
  await sleep(500);
}

export async function AddToWhitelist(): Promise<void> {
  const connection = await getConnection();
  let wallet = await newAccountWithLamports(connection, 100000000);

  accountToAdd = wallet.publicKey; // used to execute token sale
  console.log('>>>>> Account To Add To Whitelist: ', accountToAdd.toString());

  // whitelist account to which user wallet should be added
  const tokenWhitelistAccount: PublicKey = new PublicKey('XXXX');
  
  console.log('Add To Whitelist');
  await tokenWhitelist.addToWhitelist(
    payer,
    accountToAdd,
    ALLOCATION_AMOUNT,
    tokenWhitelistAccount,
  );

  await sleep(500);
  console.log('Add To Whitelist - Done');
}

export async function RemoveFromWhitelist(): Promise<void> {
  const connection = await getConnection();

  let accountToRemove = accountToAdd;
  console.log('>>>>> Account To Remove From Whitelist: ', accountToRemove.toString());

  // whitelist account from which user wallet should be removed
  const tokenWhitelistAccount: PublicKey = new PublicKey('XXXX');
  
  console.log('Remove From Whitelist');
  await tokenWhitelist.removeFromWhitelist(
    payer,
    accountToRemove,
    tokenWhitelistAccount,
  );

  await sleep(500);
  console.log('Remove From Whitelist - Done');
}

export async function CloseWhitelistAccount(): Promise<void> {
  const connection = await getConnection();

  let destinationAccount = payer.publicKey;
  console.log('>>>>> Account To Receive lamports From Whitelist Account: ', destinationAccount.toString());
  
  // whitelist account to be closed
  const tokenWhitelistAccount: PublicKey = new PublicKey('XXXX');

  console.log('Close Whitelist Account');
  await tokenWhitelist.closeWhitelistAccount(
    payer,
    destinationAccount,
    tokenWhitelistAccount,
  );

  await sleep(500);
  console.log('Close Whitelist Account - Done');
}
