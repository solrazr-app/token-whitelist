use solana_program::{
    program_error::ProgramError,
    // pubkey::Pubkey,
};
use std::convert::TryInto;
use std::mem::size_of;

use crate::error::TokenWhitelistError::InvalidInstruction;

#[derive(Clone, Debug, PartialEq)]
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
    /// 1. `[writable]` Account holding whitelist init info
    /// 2. `[]` Account to be added to the whitelist
    AddToWhitelist {
        // account_to_add: Pubkey, // token account to be whitelisted
        allocation_amount: u64, // maximum allocation amount in base tokens
    },

    /// Accounts expected by RemoveFromWhitelist
    ///
    /// 0. `[signer]` Owner of the whitelist and signer
    /// 1. `[writable]` Account holding whitelist init info
    /// 2. `[]` Account to be removed from the whitelist
    RemoveFromWhitelist {
        // account_to_remove: Pubkey, // token account to be removed from the whitelist
    },

    /// Accounts expected: SetAllocationToZero
    ///
    /// 0. `[signer]` Owner of the whitelist and signer
    /// 1. `[writable]` Account holding whitelist init info
    /// 2. `[]` Account to be reset to 0
    SetAllocationToZero {
        // account_to_reset: Pubkey, // token account to be reset to 0
    },

    /// Accounts expected: CloseWhitelistAccount
    ///
    /// 0. `[signer]` Owner of the whitelist and signer
    /// 1. `[writable]` Account holding whitelist init info
    /// 2. `[writable]` Destination account to transfer lamports to
    CloseWhitelistAccount {
        // dest_account: Pubkey, // token account to be reset to 0
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
                let (allocation_amount, _rest) = rest.split_at(8);
                let allocation_amount = allocation_amount
                    .try_into()
                    .ok()
                    .map(u64::from_le_bytes)
                    .ok_or(InvalidInstruction)?;
                Self::AddToWhitelist {allocation_amount}
            },
            2 => {
                // let (account_to_remove, _rest) = Self::unpack_pubkey(rest)?;
                Self::RemoveFromWhitelist {}
            },
            3 => {
                // let (account_to_reset, _rest) = Self::unpack_pubkey(rest)?;
                Self::SetAllocationToZero {}
            },
            4 => {
                // let (dest_account, _rest) = Self::unpack_pubkey(rest)?;
                Self::CloseWhitelistAccount {}
            },
            _ => return Err(InvalidInstruction.into()),
        })
    }

    /// Packs a [TokenWhitelistInstruction](enum.TokenWhitelistInstruction.html) into a byte buffer.
    pub fn pack(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(size_of::<Self>());
        match *self {
            Self::InitTokenWhitelist {max_whitelist_size} => {
                buf.push(0);
                buf.extend_from_slice(&max_whitelist_size.to_le_bytes());
            }
            Self::AddToWhitelist {allocation_amount} => {
                buf.push(1);
                buf.extend_from_slice(&allocation_amount.to_le_bytes());
            }
            Self::RemoveFromWhitelist{} => {
                buf.push(2);
            }
            Self::SetAllocationToZero{} => {
                buf.push(3);
            }
            Self::CloseWhitelistAccount{} => {
                buf.push(4);
            }
        };
        buf
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_init_whitelist() {
        let whitelist_size: u64 = 50;
        let check = TokenWhitelistInstruction::InitTokenWhitelist {
            max_whitelist_size: whitelist_size,
        };
        let packed = check.pack();
        let mut expect = vec![0];
        expect.extend_from_slice(&whitelist_size.to_le_bytes());
        assert_eq!(packed, expect);
        let unpacked = TokenWhitelistInstruction::unpack(&expect).unwrap();
        assert_eq!(unpacked, check);
    }

    #[test]
    fn test_pack_add_to_whitelist() {
        let allocation: u64 = 250;
        let check = TokenWhitelistInstruction::AddToWhitelist{
            allocation_amount: allocation,
        };
        let packed = check.pack();
        let mut expect = vec![1];
        expect.extend_from_slice(&allocation.to_le_bytes());
        assert_eq!(packed, expect);
        let unpacked = TokenWhitelistInstruction::unpack(&expect).unwrap();
        assert_eq!(unpacked, check);
    }

    #[test]
    fn test_pack_remove_from_whitelist() {
        let check = TokenWhitelistInstruction::RemoveFromWhitelist{};
        let packed = check.pack();
        let expect = vec![2];
        assert_eq!(packed, expect);
        let unpacked = TokenWhitelistInstruction::unpack(&expect).unwrap();
        assert_eq!(unpacked, check);
    }

    #[test]
    fn test_pack_set_allocation_zero() {
        let check = TokenWhitelistInstruction::SetAllocationToZero{};
        let packed = check.pack();
        let expect = vec![3];
        assert_eq!(packed, expect);
        let unpacked = TokenWhitelistInstruction::unpack(&expect).unwrap();
        assert_eq!(unpacked, check);
    }

    #[test]
    fn test_pack_close_whitelist_account() {
        let check = TokenWhitelistInstruction::CloseWhitelistAccount{};
        let packed = check.pack();
        let expect = vec![4];
        assert_eq!(packed, expect);
        let unpacked = TokenWhitelistInstruction::unpack(&expect).unwrap();
        assert_eq!(unpacked, check);
    }
}