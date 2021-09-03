use num_traits::FromPrimitive;
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    decode_error::DecodeError,
    program_error::{PrintProgramError, ProgramError},
    program_pack::{IsInitialized},
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar},
};
use crate::{
    error::TokenWhitelistError,
    instruction::TokenWhitelistInstruction,
    state::TokenWhitelist,
};

pub struct Processor;
impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = TokenWhitelistInstruction::unpack(instruction_data)?;

        match instruction {
            TokenWhitelistInstruction::InitTokenWhitelist {max_whitelist_size} => {
                msg!("Instruction: InitTokenWhitelist");
                Self::process_init_whitelist(
                    accounts,
                    max_whitelist_size,
                    program_id
                )
            }
            TokenWhitelistInstruction::AddToWhitelist {allocation_amount} => {
                msg!("Instruction: AddToWhitelist");
                Self::process_add_whitelist(
                    accounts,
                    allocation_amount,
                    program_id
                )
            }
            TokenWhitelistInstruction::RemoveFromWhitelist {} => {
                msg!("Instruction: RemoveFromWhitelist");
                Self::process_remove_whitelist(
                    accounts,
                    program_id
                )
            }
            TokenWhitelistInstruction::SetAllocationToZero {} => {
                msg!("Instruction: SetAllocationToZero");
                Self::process_set_allocation_to_zero(
                    accounts,
                    program_id
                )
            }
            TokenWhitelistInstruction::CloseWhitelistAccount {} => {
                msg!("Instruction: CloseWhitelistAccount");
                Self::process_close_whitelist_account(
                    accounts,
                    program_id
                )
            }
        }
    }

    fn process_init_whitelist(
        accounts: &[AccountInfo],
        max_whitelist_size: u64,
        _program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        let whitelist_owner = next_account_info(account_info_iter)?;
        if !whitelist_owner.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let token_whitelist_account = next_account_info(account_info_iter)?;

        let sysvar_rent_pubkey = &Rent::from_account_info(next_account_info(account_info_iter)?)?;
        if !sysvar_rent_pubkey.is_exempt(token_whitelist_account.lamports(), token_whitelist_account.data_len()) {
            msg!("token whitelist account must be rent exempt");
            return Err(TokenWhitelistError::NotRentExempt.into());
        }

        let mut token_whitelist_state = TokenWhitelist::unpack_from_slice(&token_whitelist_account.data.borrow())?;
        if token_whitelist_state.is_initialized() {
            msg!("token whitelist already initialized");
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        token_whitelist_state.is_initialized = true;
        token_whitelist_state.init_pubkey = *whitelist_owner.key;
        token_whitelist_state.max_whitelist_size = max_whitelist_size;

        token_whitelist_state.pack_into_slice(&mut token_whitelist_account.data.borrow_mut());

        Ok(())
    }

    fn process_add_whitelist(
        accounts: &[AccountInfo],
        allocation_amount: u64,
        _program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        let whitelist_owner = next_account_info(account_info_iter)?;
        if !whitelist_owner.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let token_whitelist_account = next_account_info(account_info_iter)?;
        let account_to_add = next_account_info(account_info_iter)?;

        let mut token_whitelist_state = TokenWhitelist::unpack_from_slice(&token_whitelist_account.data.borrow())?;
        if !token_whitelist_state.is_initialized() {
            msg!("token whitelist needs to be initialized before attempting to add");
            return Err(TokenWhitelistError::TokenWhitelistNotInit.into());
        }
        if whitelist_owner.key != &token_whitelist_state.init_pubkey {
            msg!("signer must be whitelist owner");
            msg!("{}", whitelist_owner.key);
            msg!("{}", token_whitelist_state.init_pubkey);
            return Err(TokenWhitelistError::TokenWhitelistNotOwner.into());
        }

        token_whitelist_state.add_keypair(&account_to_add.key.to_string(), &allocation_amount);
        token_whitelist_state.pack_into_slice(&mut token_whitelist_account.data.borrow_mut());

        Ok(())
    }

    fn process_remove_whitelist(
        accounts: &[AccountInfo],
        _program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        let whitelist_owner = next_account_info(account_info_iter)?;
        if !whitelist_owner.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let token_whitelist_account = next_account_info(account_info_iter)?;
        let account_to_remove = next_account_info(account_info_iter)?;

        let mut token_whitelist_state = TokenWhitelist::unpack_from_slice(&token_whitelist_account.data.borrow())?;
        if !token_whitelist_state.is_initialized() {
            msg!("token whitelist needs to be initialized before attempting to remove");
            return Err(TokenWhitelistError::TokenWhitelistNotInit.into());
        }
        if whitelist_owner.key != &token_whitelist_state.init_pubkey {
            msg!("signer must be whitelist owner");
            msg!("{}", whitelist_owner.key);
            msg!("{}", token_whitelist_state.init_pubkey);
            return Err(TokenWhitelistError::TokenWhitelistNotOwner.into());
        }

        token_whitelist_state.drop_key(&account_to_remove.key.to_string());
        token_whitelist_state.pack_into_slice(&mut token_whitelist_account.data.borrow_mut());

        Ok(())
    }

    fn process_set_allocation_to_zero(
        accounts: &[AccountInfo],
        _program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        let account_owner = next_account_info(account_info_iter)?;
        if !account_owner.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let token_whitelist_account = next_account_info(account_info_iter)?;
        let account_to_reset = next_account_info(account_info_iter)?;

        let mut token_whitelist_state = TokenWhitelist::unpack_from_slice(&token_whitelist_account.data.borrow())?;
        if !token_whitelist_state.is_initialized() {
            msg!("token whitelist needs to be initialized before attempting to update");
            return Err(TokenWhitelistError::TokenWhitelistNotInit.into());
        }
        if account_owner.key != account_to_reset.key {
            msg!("signer must be the owner of the account");
            msg!("{}", account_owner.key);
            msg!("{}", account_to_reset.key);
            return Err(TokenWhitelistError::NotOwner.into());
        }
        if !token_whitelist_state.contains_key(&account_to_reset.key.to_string()) {
            msg!("attempting to reset non-whitelisted account");
            msg!(&account_to_reset.key.to_string());
            return Err(ProgramError::InvalidAccountData);
        }

        let whitelist_amount: u64 = 0;
        token_whitelist_state.add_keypair(&account_to_reset.key.to_string(), &whitelist_amount);
        token_whitelist_state.pack_into_slice(&mut token_whitelist_account.data.borrow_mut());

        Ok(())
    }

    fn process_close_whitelist_account(
        accounts: &[AccountInfo],
        _program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        let authority_account = next_account_info(account_info_iter)?;
        let token_whitelist_account = next_account_info(account_info_iter)?;
        let destination_account = next_account_info(account_info_iter)?;

        let token_whitelist_state = TokenWhitelist::unpack_from_slice(&token_whitelist_account.data.borrow())?;
        if !token_whitelist_state.is_initialized() {
            msg!("token whitelist needs to be initialized before attempting to close");
            return Err(TokenWhitelistError::TokenWhitelistNotInit.into());
        }

        Self::check_authority(authority_account, &token_whitelist_state.init_pubkey)?;

        let destination_starting_lamports = destination_account.lamports();
        let account_lamports = token_whitelist_account.lamports();
        
        **destination_account.lamports.borrow_mut() = destination_starting_lamports
            .checked_add(account_lamports)
            .ok_or(TokenWhitelistError::Overflow)?;
        **token_whitelist_account.lamports.borrow_mut() = 0;

        // token_whitelist_state.clear_data();
        // token_whitelist_state.pack_into_slice(&mut token_whitelist_account.data.borrow_mut());
        
        token_whitelist_account.data.borrow_mut().iter_mut().for_each(|byte| *byte = 0);

        Ok(())
    }

    fn check_authority(
        authority_info: &AccountInfo,
        expected_authority: &Pubkey,
    ) -> ProgramResult {
        if expected_authority != authority_info.key {
            msg!("Invalid authority provided");
            return Err(TokenWhitelistError::InvalidAuthority.into());
        }
        if !authority_info.is_signer {
            msg!("Authority signature missing");
            return Err(ProgramError::MissingRequiredSignature);
        }
        Ok(())
    }
}

impl PrintProgramError for TokenWhitelistError {
    fn print<E>(&self)
    where
        E: 'static + std::error::Error + DecodeError<E> + PrintProgramError + FromPrimitive,
    {
        match self {
            TokenWhitelistError::InvalidInstruction => msg!("Error: Invalid Instruction"),
            TokenWhitelistError::NotRentExempt => msg!("Error: Not Rent Exempt"),
            TokenWhitelistError::TokenWhitelistNotInit => msg!("Error: Token Whitelist Not Initialized"),
            TokenWhitelistError::TokenWhitelistNotOwner => msg!("Error: Signer Not Token Whitelist Owner"),
            TokenWhitelistError::TokenWhitelistSizeExceeds => msg!("Error: Token Whitelist Size Exceeds"),
            TokenWhitelistError::NotOwner => msg!("Error: Signer Not Account Owner"),
            TokenWhitelistError::InvalidAuthority => msg!("Error: Invalid authority provided"),
            TokenWhitelistError::Overflow => msg!("Error: Calculation overflow"),
        }
    }
}
