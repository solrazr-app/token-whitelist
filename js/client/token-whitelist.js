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
   * Token Whitelist Account
   */
  tokenWhitelistAccount: Account;

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
   * @param tokenWhitelistAccount Account to store token sale info
   * @param tokenWhitelistProgramId The program ID of the token-whitelist program
   * @param tokenProgramId The program ID of the token program
   */
  constructor(
    connection: Connection,
    payer: Account,
    tokenWhitelistAccount: Account,
    tokenWhitelistProgramId: PublicKey,
    tokenProgramId: PublicKey,
  ) {
    Object.assign(this, {
      connection,
      payer,
      tokenWhitelistAccount,
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
   * Initiaze Whitelist
   *
   * @param initAuthority Account calling the init whitelist
   * @param whitelistSize Maximum number of whitelist accounts
   */
  async initTokenWhitelist(
    initAuthority: Account,
    whitelistSize: number | Numberu64,
  ): Promise<TransactionSignature> {

    const INITIALIZED_BYTES = 1;
    const PUBKEY_BYTES = 32;
    const WHITELIST_SIZE_BYTES = 8;
    const MAP_LENGTH = 4;
    const MAP_BYTES = 5116;
    const ACCOUNT_STATE_SPACE =
      INITIALIZED_BYTES + PUBKEY_BYTES + WHITELIST_SIZE_BYTES + MAP_LENGTH + MAP_BYTES;

    const createWhitelistAccountInstruction = SystemProgram.createAccount({
        space: ACCOUNT_STATE_SPACE,
        lamports: await this.connection.getMinimumBalanceForRentExemption(ACCOUNT_STATE_SPACE, 'singleGossip'),
        fromPubkey: initAuthority.publicKey,
        newAccountPubkey: this.tokenWhitelistAccount.publicKey,
        programId: this.tokenWhitelistProgramId,
    });

    console.log(">>>>> Token Whitelist Account: " + this.tokenWhitelistAccount.publicKey + " <<<<<");

    return await sendAndConfirmTransaction(
      'createTokenWhitelistAccount and initTokenWhitelist',
      this.connection,
      new Transaction().add(
        createWhitelistAccountInstruction,
        TokenWhitelist.initTokenWhitelistInstruction(
          this.tokenWhitelistProgramId,
          whitelistSize,
          initAuthority.publicKey,
          this.tokenWhitelistAccount.publicKey,
        ),
      ),
      this.payer,
      initAuthority,
      this.tokenWhitelistAccount,
    );
  }

  static initTokenWhitelistInstruction(
    tokenWhitelistProgramId: PublicKey,
    whitelistSize: number | Numberu64,
    initAuthority: PublicKey,
    tokenWhitelistAccount: PublicKey,
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
      {pubkey: tokenWhitelistAccount, isSigner: false, isWritable: true},
      {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
    ];
    return new TransactionInstruction({
      keys,
      programId: tokenWhitelistProgramId,
      data,
    });
  }

  /**
   * Add To Whitelist
   *
   * @param initAuthority Account calling the init whitelist
   * @param accountToAdd Account to be added to whitelist
   */
  async addToWhitelist(
    initAuthority: Account,
    accountToAdd: PublicKey,
  ): Promise<TransactionSignature> {
    return await sendAndConfirmTransaction(
      'AddToWhitelist',
      this.connection,
      new Transaction().add(
        TokenWhitelist.addToWhitelistInstruction(
          this.tokenWhitelistProgramId,
          accountToAdd,
          initAuthority.publicKey,
          this.tokenWhitelistAccount.publicKey,
        ),
      ),
      this.payer,
      initAuthority,
    );
  }

  static addToWhitelistInstruction(
    tokenWhitelistProgramId: PublicKey,
    accountToAdd: PublicKey,
    initAuthority: PublicKey,
    tokenWhitelistAccount: PublicKey,
  ): TransactionInstruction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 1, // AddToWhitelist instruction
      },
      data,
    );

    const keys = [
      {pubkey: initAuthority, isSigner: true, isWritable: false},
      {pubkey: tokenWhitelistAccount, isSigner: false, isWritable: true},
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
   */
  async removeFromWhitelist(
    initAuthority: Account,
    accountToRemove: PublicKey,
  ): Promise<TransactionSignature> {
    return await sendAndConfirmTransaction(
      'RemoveFromWhitelist',
      this.connection,
      new Transaction().add(
        TokenWhitelist.removeFromWhitelistInstruction(
          this.tokenWhitelistProgramId,
          accountToRemove,
          initAuthority.publicKey,
          this.tokenWhitelistAccount.publicKey,
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
    tokenWhitelistAccount: PublicKey,
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
      {pubkey: tokenWhitelistAccount, isSigner: false, isWritable: true},
      {pubkey: accountToRemove, isSigner: false, isWritable: false},
    ];
    return new TransactionInstruction({
      keys,
      programId: tokenWhitelistProgramId,
      data,
    });
  }
}
