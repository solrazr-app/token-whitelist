// @flow

import fs from 'mz/fs';
import {Account, Connection} from '@solana/web3.js';
import {sleep} from './sleep';

export async function newAccountWithLamports(
  connection: Connection,
  lamports: number = 1000000,
): Promise<Account> {
  
  // const keypairFile = "./keypair.json";
  // const secretKey = JSON.parse(await fs.readFile(keypairFile));
  // const account = new Account(secretKey);

  const account = new Account();

  let retries = 30;
  await connection.requestAirdrop(account.publicKey, lamports);
  for (;;) {
    await sleep(500);
    if (lamports == (await connection.getBalance(account.publicKey))) {
      return account;
    }
    if (--retries <= 0) {
      break;
    }
  }
  throw new Error(`Airdrop of ${lamports} failed`);
}
