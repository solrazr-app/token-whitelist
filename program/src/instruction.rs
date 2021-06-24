use solana_program::{
    program_error::ProgramError,
    // pubkey::Pubkey,
};
use std::convert::TryInto;

use crate::error::TokenWhitelistError::InvalidInstruction;

pub enum TokenWhitelistInstruction {

    /// Accounts expected by InitTokenWhitelist
    ///
    /// 0. `[signer]` Owner of the whitelist and signer
    /// 1. `[writable]` Account holding whitelist init info
    InitTokenWhitelist {
        max_whitelist_size: u64, // max number of whitelist accounts
    },

    /// Accounts expected by AddToWhitelist
    ///
    /// 0. `[signer]` Owner of the whitelist and signer
    /// 1. `[]` Account holding whitelist init info
    /// 2. `[]` Account to be added to the whitelist
    AddToWhitelist {
        // account_to_add: Pubkey, // token account to be whitelisted
    },

    /// Accounts expected by RemoveFromWhitelist
    ///
    /// 0. `[signer]` Owner of the whitelist and signer
    /// 1. `[]` Account holding whitelist init info
    /// 2. `[]` Account to be removed from the whitelist
    RemoveFromWhitelist {
        // account_to_remove: Pubkey, // token account to be removed from the whitelist
    },

    /// Accounts expected: SetAllocationToZero
    ///
    /// 0. `[signer]` Owner of the whitelist and signer
    /// 1. `[]` Account holding whitelist init info
    /// 2. `[]` Account to be reset to 0
    SetAllocationToZero {
        // account_to_reset: Pubkey, // token account to be reset to 0
    },
}

impl TokenWhitelistInstruction {
    /// Unpacks a byte buffer into a [TokenWhitelistInstruction](enum.TokenWhitelistInstruction.html).
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

        Ok(match tag {
            0 => {
                let (max_whitelist_size, _rest) = rest.split_at(8);
                let max_whitelist_size = max_whitelist_size
                    .try_into()
                    .ok()
                    .map(u64::from_le_bytes)
                    .ok_or(InvalidInstruction)?;
                Self::InitTokenWhitelist {max_whitelist_size}
            },
            1 => {
                // let (account_to_add, _rest) = Self::unpack_pubkey(rest)?;
                Self::AddToWhitelist {}
            },
            2 => {
                // let (account_to_remove, _rest) = Self::unpack_pubkey(rest)?;
                Self::RemoveFromWhitelist {}
            },
            3 => {
                // let (account_to_remove, _rest) = Self::unpack_pubkey(rest)?;
                Self::SetAllocationToZero {}
            },
            _ => return Err(InvalidInstruction.into()),
        })
    }

    // fn unpack_pubkey(input: &[u8]) -> Result<(Pubkey, &[u8]), ProgramError> {
    //     if input.len() >= 32 {
    //         let (key, rest) = input.split_at(32);
    //         let pk = Pubkey::new(key);
    //         Ok((pk, rest))
    //     } else {
    //         Err(InvalidInstruction.into())
    //     }
    // }
}
