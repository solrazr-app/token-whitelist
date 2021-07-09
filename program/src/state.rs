use solana_program::{
    program_error::ProgramError,
    program_pack::{IsInitialized},
    pubkey::Pubkey,
};

use std::collections::BTreeMap;
use borsh::{BorshDeserialize, BorshSerialize};
use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};

const INITIALIZED_BYTES: usize = 1;
const PUBKEY_BYTES: usize = 32;
const WHITELIST_SIZE_BYTES: usize = 8;
const MAP_LENGTH: usize = 4;
const MAP_BYTES: usize = 5116;
const ACCOUNT_STATE_SPACE: usize =
    INITIALIZED_BYTES + PUBKEY_BYTES + WHITELIST_SIZE_BYTES + MAP_LENGTH + MAP_BYTES; // 5161 bytes

#[derive(Clone, Debug, Default, PartialEq)]
pub struct TokenWhitelist {
    pub is_initialized: bool,
    pub init_pubkey: Pubkey,
    pub max_whitelist_size: u64,
    pub whitelist_map: BTreeMap<String, u64>,
}

impl IsInitialized for TokenWhitelist {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl TokenWhitelist {
    pub fn add_keypair(&mut self, key: &String, value: &u64) {
        self.whitelist_map.insert(key.to_string(), *value);
    }

    pub fn drop_key(&mut self, key: &String) {
        self.whitelist_map.remove(key);
    }

    pub fn contains_key(&mut self, key: &String) -> bool {
        return self.whitelist_map.contains_key(key);
    }

    pub fn get(&mut self, key: &String) -> Option<&u64> {
        return self.whitelist_map.get(key);
    }

    pub fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, ACCOUNT_STATE_SPACE];
        let (
            is_initialized,
            init_pubkey,
            max_whitelist_size,
            btree_map_len,
            btree_map_src,
        ) = array_refs![
            src,
            INITIALIZED_BYTES,
            PUBKEY_BYTES,
            WHITELIST_SIZE_BYTES,
            MAP_LENGTH,
            MAP_BYTES
        ];

        let mut btree_map = BTreeMap::<String, u64>::new();
        let btree_map_length = count_from_le(btree_map_len);
        if btree_map_length > 0 {
            btree_map = BTreeMap::<String, u64>::try_from_slice(&btree_map_src[0..btree_map_length]).unwrap();
        }

        Ok(TokenWhitelist {
            is_initialized: match is_initialized {
                [0] => false,
                [1] => true,
                _ => return Err(ProgramError::InvalidAccountData),
            },
            init_pubkey: Pubkey::new_from_array(*init_pubkey),
            max_whitelist_size: u64::from_le_bytes(*max_whitelist_size),
            whitelist_map: btree_map,
        })
    }

    pub fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, ACCOUNT_STATE_SPACE];
        let (
            is_initialized_dst,
            init_pubkey_dst,
            max_whitelist_size_dst,
            btree_map_len,
            btree_map_dst,
        ) = mut_array_refs![
            dst,
            INITIALIZED_BYTES,
            PUBKEY_BYTES,
            WHITELIST_SIZE_BYTES,
            MAP_LENGTH,
            MAP_BYTES
        ];
        
        is_initialized_dst[0] = self.is_initialized as u8;
        init_pubkey_dst.copy_from_slice(self.init_pubkey.as_ref());
        *max_whitelist_size_dst = self.max_whitelist_size.to_le_bytes();
        let data_ser = self.whitelist_map.try_to_vec().unwrap();
        btree_map_len[..].copy_from_slice(&transform_u32_to_array_of_u8(data_ser.len() as u32));
        btree_map_dst[..data_ser.len()].copy_from_slice(&data_ser);
    }
}

/// Get the Borsh container count (le) from buffer
fn count_from_le(array: &[u8]) -> usize {
    (array[0] as usize) << 0
        | (array[1] as usize) << 8
        | (array[2] as usize) << 16
        | (array[3] as usize) << 24
}

/// Convert a u32 to an array
fn transform_u32_to_array_of_u8(x: u32) -> [u8; 4] {
    let b1: u8 = ((x >> 24) & 0xff) as u8;
    let b2: u8 = ((x >> 16) & 0xff) as u8;
    let b3: u8 = ((x >> 8) & 0xff) as u8;
    let b4: u8 = (x & 0xff) as u8;
    return [b4, b3, b2, b1];
}

/// Struct for small data
#[derive(Clone, Debug, Default, BorshSerialize, BorshDeserialize, PartialEq)]
pub struct SmallData {
    /// The data contained by the account, could be anything or serializable
    pub bytes: [u8; Self::DATA_SIZE],
}

impl SmallData {
    /// small data for easy testing
    pub const DATA_SIZE: usize = 8;
}
