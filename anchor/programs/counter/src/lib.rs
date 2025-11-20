// pubkey: 4dTyMmeLZz4Z8pWXWDVqFQJvVPL69nbcQZN3bzoENe9f

#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("CNZneaN4To4pfF4gHMGGpFfxyWmztQjTGngcRx6Lbsn4");

#[program]
pub mod counter {
    use super::*;
 
    // instructions need to start with context
    pub fn create_journal_entry(ctx: Context<CreateEntry>, title: String, message: String) -> Result<()> {
        // make account info mutable to save journal entry
        // load in context of the "journal entry" account
        let journal_entry = &mut ctx.accounts.journal_entry;

        // update fields in the journal entry based on owner's key
        journal_entry.owner = *ctx.accounts.owner.key;
        journal_entry.title = title;
        journal_entry.message = message;

        Ok(())
    }

    // _title: title is not used in the logic, but is still necessary information
    pub fn update_journal_entry(ctx: Context<UpdateEntry>, _title: String, message: String) -> Result<()> {
        let journal_entry = &mut ctx.accounts.journal_entry;
        journal_entry.message = message;

        Ok(())
    }

    // deleting accounts happens entirely inside the DeleteEntry context
    pub fn delete_journal_entry(_ctx: Context<DeleteEntry>, _title: String) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]

// use the instruction macro to get the title for CreateEntry
#[instruction(title: String)]

pub struct CreateEntry<'info> {
    // define all accounts to be passed into the state, such as the JournalEntryState
    #[account(
        init,
        // connect owner to pda, allow them to create multiple entries
        // seeds + program ID create a unique program derived address (pda)
        // pda: address that a program controls without needing a private key, can be used for user profiles
        seeds = [title.as_bytes(), owner.key().as_ref()],
        bump,
        // space: 8 = anchor discriminator
        space = 8 + JournalEntryState::INIT_SPACE,
        payer = owner,
    )]

    pub journal_entry: Account<'info, JournalEntryState>,

    // paying changes the state of the owner's account, so we define the account as mutable
    #[account(mut)]
    // owner = person signing instruction
    pub owner: Signer<'info>,

    pub system_program: Program<'info,System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct UpdateEntry<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), owner.key().as_ref()],
        bump,

        // rent for storage on chain will change based on length of title/message
        // realloc: reallocate space for an account
        realloc = 8 + JournalEntryState::INIT_SPACE,
        realloc::payer = owner,

        // set original calculation of space to 0, recalculate
        realloc::zero = true,
    )]

    pub journal_entry: Account<'info, JournalEntryState>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct DeleteEntry<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), owner.key().as_ref()],
        bump,
        
        // close constraint: running this constraint closes the account
        // only works if the public key that close equals is the signer of the instruction
        // i.e. only owner can close the account
        close = owner,
    )]

    pub journal_entry: Account<'info, JournalEntryState>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// create an account for the journal entry to store the data
// i.e. our state
#[account]

// calculate the space for the journal entry
#[derive(InitSpace)]
pub struct JournalEntryState {
    pub owner: Pubkey,

    // strings can be infinite length, so we need to specify the max length
    #[max_len(50)]
    pub title: String,

    #[max_len(1000)]
    pub message: String,
}