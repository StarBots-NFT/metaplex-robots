//! Module provide program defined errors

use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Account does not have correct owner!")]
    IncorrectOwner,
    #[msg("Account is not initialized!")]
    Uninitialized,
    #[msg("Mint Mismatch!")]
    MintMismatch,
    #[msg("Your loot box has beed used!")]
    MintLootBoxUsed,
    #[msg("Index greater than length!")]
    IndexGreaterThanLength,
    #[msg("Config must have atleast one entry!")]
    ConfigMustHaveAtleastOneEntry,
    #[msg("Numerical overflow error!")]
    NumericalOverflowError,
    #[msg("Can only provide up to 4 creators to candy machine (because candy machine is one)!")]
    TooManyCreators,
    #[msg("Uuid must be exactly of 6 length")]
    UuidMustBeExactly6Length,
    #[msg("Not enough tokens to pay for this minting")]
    NotEnoughTokens,
    #[msg("Not enough SOL to pay for this minting")]
    NotEnoughSOL,
    #[msg("Token transfer failed")]
    TokenTransferFailed,
    #[msg("Candy machine is empty!")]
    CandyMachineEmpty,
    #[msg("Candy machine is not live yet!")]
    CandyMachineNotLiveYet,
    #[msg("Number of config lines must be at least number of items available")]
    ConfigLineMismatch,
    #[msg("The Box did not tranfer to us")]
    DidNotTranferBox,
    #[msg("Balance is invalid")]
    InvalidBalance,
    #[msg("Your loot box is not issue by us!")]
    LootBoxInvaild,
    #[msg("Temp account owner must be payer")]
    TempAccountOwnerMustBePayer,
    #[msg("Temp account mint must be NFT address")]
    TempAccountOwnerMintMustBeNFTAddress,
    #[msg("Metadata of lootbox is not match with nft address")]
    MetadataNotMatch,
}
