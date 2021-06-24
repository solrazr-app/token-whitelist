
/**
 * pubkeys.js - stores all pubkeys used across the program
 */

import {PublicKey} from '@solana/web3.js';

/// program ids

export const TOKEN_PROGRAM_ID: PublicKey = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // localnet && devnet
);
export const ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: PublicKey = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // localnet && devnet
);
export const TOKEN_WHITELIST_PROGRAM_ID: PublicKey = new PublicKey(
  '4ikowHMssMavQeDUaDVGPwsBcNMnU1nkzAJikMFG5mfv', // localnet && devnet
);