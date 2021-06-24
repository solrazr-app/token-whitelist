use num_derive::FromPrimitive;
use thiserror::Error;
use solana_program::{decode_error::DecodeError, program_error::ProgramError};

#[derive(Error, Debug, Copy, Clone, FromPrimitive)]
pub enum TokenWhitelistError {
    /// Invalid instruction
    #[error("Invalid Instruction")]
    InvalidInstruction,
    /// Not Rent Exempt
    #[error("Not Rent Exempt")]
    NotRentExempt,
    /// Token Whitelist Not Initialized
    #[error("Token Whitelist Not Initialized")]
    TokenWhitelistNotInit,
    /// Signer Not Token Whitelist Owner
    #[error("Signer Not Token Whitelist Owner")]
    TokenWhitelistNotOwner,
    /// Token Whitelist Size Exceeds
    #[error("Token Whitelist Size Exceeds")]
    TokenWhitelistSizeExceeds,
    /// Signer Not Account Owner
    #[error("Signer Not Account Owner")]
    NotOwner,
}

impl From<TokenWhitelistError> for ProgramError {
    fn from(e: TokenWhitelistError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for TokenWhitelistError {
    fn type_of() -> &'static str {
        "Token Whitelist Error"
    }
}
