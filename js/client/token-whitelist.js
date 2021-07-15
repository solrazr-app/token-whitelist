/**
 * @flow
 */

import assert from 'assert';
import BN from 'bn.js';
import {Buffer} from 'buffer';
import * as BufferLayout from 'buffer-layout';
import type {
  Connection,
  TransactionSignature,
} from '@solana/web3.js';
import {
  Account,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';

import * as Layout from './layout';
import {sendAndConfirmTransaction} from './util/send-and-confirm-transaction';

/**
 * Some amount of tokens
 */
export class Numberu64 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): typeof Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 8) {
      return b;
    }
    assert(b.length < 8, 'Numberu64 too large');

    const zeroPad = Buffer.alloc(8);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a Numberu64 from Buffer representation
   */
  static fromBuffer(buffer: typeof Buffer): Numberu64 {
    assert(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    return new Numberu64(
      [...buffer]
        .reverse()
        .map(i => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16,
    );
  }
}

export const TOKEN_WHITELIST_MAP_DATA_LAYOUT = BufferLayout.struct([
  BufferLayout.u8("isInitialized"),
  Layout.publicKey("initPubkey"),
  Layout.uint64("maxWhitelistAccounts"),
]);

export const TOKEN_WHITELIST_ACCOUNT_DATA_LAYOUT = BufferLayout.struct([
  BufferLayout.u8("isInitialized"),
  Layout.publicKey("initPubkey"),
  Layout.uint64("maxWhitelistSize"),
]);

/**
 * A program to exchange tokens against a pool of liquidity
 */
export class TokenWhitelist {
  /**
   * @private
   */
  connection: Connection;

  /**
   * Fee payer
   */
  payer: Account;

  /**
   * Token Whitelist Map
   */
  tokenWhitelistMap: Account;

  /**
   * Program Identifier for the Token Whitelist program
   */
  tokenWhitelistProgramId: PublicKey;

  /**
   * Program Identifier for the Token program
   */
  tokenProgramId: PublicKey;

  /**
   * Create a Token object attached to the specific token
   *
   * @param connection The connection to use
   * @param payer Pays for the transaction
   * @param tokenWhitelistMap Account to store token whitelist map
   * @param tokenWhitelistProgramId The program ID of the token-whitelist program
   * @param tokenProgramId The program ID of the token program
   */
  constructor(
    connection: Connection,
    payer: Account,
    tokenWhitelistMap: Account,
    tokenWhitelistProgramId: PublicKey,
    tokenProgramId: PublicKey,
  ) {
    Object.assign(this, {
      connection,
      payer,
      tokenWhitelistMap,
      tokenWhitelistProgramId,
      tokenProgramId,
    });
  }

  /**
   * Create a new Token Whitelist
   *
   * @param connection The connection to use
   * @param payer Pays for the transaction
   * @param tokenWhitelistProgramId The program ID of the token-whitelist program
   * @param tokenProgramId The program ID of the token program
   * @return Token object for the newly minted token, Public key of the account holding the total supply of new tokens
   */
  static async createTokenWhitelist(
    connection: Connection,
    payer: Account,
    tokenWhitelistProgramId: PublicKey,
    tokenProgramId: PublicKey,
  ): Promise<TokenWhitelist> {
    const tokenWhitelist = new TokenWhitelist(
      connection,
      payer,
      new Account(),
      tokenWhitelistProgramId,
      tokenProgramId,
    );

    return tokenWhitelist;
  }

  /**
   * Initiaze Whitelist Map
   *
   * @param initAuthority Account calling the init whitelist map
   * @param whitelistSize Maximum number of whitelist accounts
   */
  async initTokenWhitelistMap(
    initAuthority: Account,
    whitelistSize: number | Numberu64,
  ): Promise<TransactionSignature> {

    const ACCOUNT_STATE_SPACE = 500000; // sufficient to hold at least 50 pubkeys in a map

    const createWhitelistAccountInstruction = SystemProgram.createAccount({
        space: ACCOUNT_STATE_SPACE,
        lamports: await this.connection.getMinimumBalanceForRentExemption(ACCOUNT_STATE_SPACE, 'singleGossip'),
        fromPubkey: initAuthority.publicKey,
        newAccountPubkey: this.tokenWhitelistMap.publicKey,
        programId: this.tokenWhitelistProgramId,
    });

    console.log(">>>>> Token Whitelist Map: " + this.tokenWhitelistMap.publicKey + " <<<<<");

    return await sendAndConfirmTransaction(
      'createTokenWhitelistAccount and initTokenWhitelist',
      this.connection,
      new Transaction().add(
        createWhitelistAccountInstruction,
        TokenWhitelist.initTokenWhitelistInstruction(
          this.tokenWhitelistProgramId,
          whitelistSize,
          initAuthority.publicKey,
          this.tokenWhitelistMap.publicKey,
        ),
      ),
      this.payer,
      initAuthority,
      this.tokenWhitelistMap,
    );
  }

  /**
   * Initiaze Whitelist
   *
   * @param initAuthority Account calling the init whitelist
   * @param tokenWhitelistAccount Account to store token whitelist
   * @param whitelistSize Maximum number of whitelist accounts
   */
  async initTokenWhitelist(
    initAuthority: Account,
    tokenWhitelistAccount: Account,
    whitelistSize: number | Numberu64,
  ): Promise<TransactionSignature> {

    const ACCOUNT_STATE_SPACE = 500000; // sufficient to hold at least 50 pubkeys in a map

    const createWhitelistAccountInstruction = SystemProgram.createAccount({
        space: ACCOUNT_STATE_SPACE,
        lamports: await this.connection.getMinimumBalanceForRentExemption(ACCOUNT_STATE_SPACE, 'singleGossip'),
        fromPubkey: initAuthority.publicKey,
        newAccountPubkey: tokenWhitelistAccount.publicKey,
        programId: this.tokenWhitelistProgramId,
    });

    return await sendAndConfirmTransaction(
      'createTokenWhitelistAccount and initTokenWhitelist',
      this.connection,
      new Transaction().add(
        createWhitelistAccountInstruction,
        TokenWhitelist.initTokenWhitelistInstruction(
          this.tokenWhitelistProgramId,
          whitelistSize,
          initAuthority.publicKey,
          tokenWhitelistAccount.publicKey,
        ),
      ),
      this.payer,
      initAuthority,
      tokenWhitelistAccount,
    );
  }

  static initTokenWhitelistInstruction(
    tokenWhitelistProgramId: PublicKey,
    whitelistSize: number | Numberu64,
    initAuthority: PublicKey,
    tokenWhitelistPubkey: PublicKey,
  ): TransactionInstruction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
      Layout.uint64('max_whitelist_size'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 0, // Init Whitelist instruction
        max_whitelist_size: new Numberu64(whitelistSize).toBuffer(),
      },
      data,
    );

    const keys = [
      {pubkey: initAuthority, isSigner: true, isWritable: false},
      {pubkey: tokenWhitelistPubkey, isSigner: false, isWritable: true},
      {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
    ];
    return new TransactionInstruction({
      keys,
      programId: tokenWhitelistProgramId,
      data,
    });
  }

  /**
   * Add Whitelist To Map
   *
   * @param initAuthority Account calling the init whitelist
   * @param accountToAdd Account to be added to whitelist
   * @param allocationAmount Maximum allocation amount in base tokens
   */
  async addWhitelistToMap(
    initAuthority: Account,
    accountToAdd: PublicKey,
    allocationAmount: number | Numberu64,
  ): Promise<TransactionSignature> {
    return await sendAndConfirmTransaction(
      'AddToWhitelist',
      this.connection,
      new Transaction().add(
        TokenWhitelist.addToWhitelistInstruction(
          this.tokenWhitelistProgramId,
          accountToAdd,
          allocationAmount,
          initAuthority.publicKey,
          this.tokenWhitelistMap.publicKey,
        ),
      ),
      this.payer,
      initAuthority,
    );
  }

  /**
   * Add To Whitelist
   *
   * @param initAuthority Account calling the init whitelist
   * @param accountToAdd Account to be added to whitelist
   * @param allocationAmount Maximum allocation amount in base tokens
   * @param tokenWhitelistAccount Token Whitelist Account
   */
  async addToWhitelist(
    initAuthority: Account,
    accountToAdd: PublicKey,
    allocationAmount: number | Numberu64,
    tokenWhitelistAccount: PublicKey,
  ): Promise<TransactionSignature> {
    return await sendAndConfirmTransaction(
      'AddToWhitelist',
      this.connection,
      new Transaction().add(
        TokenWhitelist.addToWhitelistInstruction(
          this.tokenWhitelistProgramId,
          accountToAdd,
          allocationAmount,
          initAuthority.publicKey,
          tokenWhitelistAccount,
        ),
      ),
      this.payer,
      initAuthority,
    );
  }

  static addToWhitelistInstruction(
    tokenWhitelistProgramId: PublicKey,
    accountToAdd: PublicKey,
    allocationAmount: number | Numberu64,
    initAuthority: PublicKey,
    tokenWhitelistPubkey: PublicKey,
  ): TransactionInstruction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
      Layout.uint64('allocation_amount'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 1, // AddToWhitelist instruction
        allocation_amount: new Numberu64(allocationAmount).toBuffer(),
      },
      data,
    );

    const keys = [
      {pubkey: initAuthority, isSigner: true, isWritable: false},
      {pubkey: tokenWhitelistPubkey, isSigner: false, isWritable: true},
      {pubkey: accountToAdd, isSigner: false, isWritable: false},
    ];
    return new TransactionInstruction({
      keys,
      programId: tokenWhitelistProgramId,
      data,
    });
  }

  /**
   * Remove From Whitelist
   *
   * @param initAuthority Account calling the init whitelist
   * @param accountToRemove Account to be removed from whitelist
   * @param tokenWhitelistAccount Token Whitelist Account
   */
  async removeFromWhitelist(
    initAuthority: Account,
    accountToRemove: PublicKey,
    tokenWhitelistAccount: PublicKey,
  ): Promise<TransactionSignature> {
    return await sendAndConfirmTransaction(
      'RemoveFromWhitelist',
      this.connection,
      new Transaction().add(
        TokenWhitelist.removeFromWhitelistInstruction(
          this.tokenWhitelistProgramId,
          accountToRemove,
          initAuthority.publicKey,
          tokenWhitelistAccount,
        ),
      ),
      this.payer,
      initAuthority,
    );
  }

  static removeFromWhitelistInstruction(
    tokenWhitelistProgramId: PublicKey,
    accountToRemove: PublicKey,
    initAuthority: PublicKey,
    tokenWhitelistPubkey: PublicKey,
  ): TransactionInstruction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 2, // RemoveFromWhitelist instruction
      },
      data,
    );

    const keys = [
      {pubkey: initAuthority, isSigner: true, isWritable: false},
      {pubkey: tokenWhitelistPubkey, isSigner: false, isWritable: true},
      {pubkey: accountToRemove, isSigner: false, isWritable: false},
    ];
    return new TransactionInstruction({
      keys,
      programId: tokenWhitelistProgramId,
      data,
    });
  }

  /**
   * Close Whitelist Account
   *
   * @param initAuthority Account calling the init whitelist
   * @param destinationAccount Account to transfer lamports from the whitelist account
   * @param tokenWhitelistAccount Token Whitelist Account
   */
  async closeWhitelistAccount(
    initAuthority: Account,
    destinationAccount: PublicKey,
    tokenWhitelistAccount: PublicKey,
  ): Promise<TransactionSignature> {
    return await sendAndConfirmTransaction(
      'CloseWhitelistAccount',
      this.connection,
      new Transaction().add(
        TokenWhitelist.closeWhitelistAccountInstruction(
          this.tokenWhitelistProgramId,
          destinationAccount,
          initAuthority.publicKey,
          tokenWhitelistAccount,
        ),
      ),
      this.payer,
      initAuthority,
    );
  }

  static closeWhitelistAccountInstruction(
    tokenWhitelistProgramId: PublicKey,
    destinationAccount: PublicKey,
    initAuthority: PublicKey,
    tokenWhitelistPubkey: PublicKey,
  ): TransactionInstruction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 4, // CloseWhitelistAccount instruction
      },
      data,
    );

    const keys = [
      {pubkey: initAuthority, isSigner: true, isWritable: false},
      {pubkey: tokenWhitelistPubkey, isSigner: false, isWritable: true},
      {pubkey: destinationAccount, isSigner: false, isWritable: true},
    ];
    return new TransactionInstruction({
      keys,
      programId: tokenWhitelistProgramId,
      data,
    });
  }
}
