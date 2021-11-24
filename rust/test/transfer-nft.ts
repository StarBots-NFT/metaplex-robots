import * as anchor from "@project-serum/anchor";

import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export type TransferNFTParams = {
    fromWallet: anchor.web3.Keypair,
    connection: anchor.web3.Connection,
    fromTokenAccount: anchor.web3.PublicKey,
    toTokenAccount: anchor.web3.PublicKey,
}

export default async function transferNFT({
    connection,
    fromWallet,
    fromTokenAccount,
    toTokenAccount
}: TransferNFTParams) {
    // Add token transfer instructions to transaction
    const transaction = new anchor.web3.Transaction().add(
        Token.createTransferInstruction(
            TOKEN_PROGRAM_ID,
            fromTokenAccount,
            toTokenAccount,
            fromWallet.publicKey,
            [],
            1,
        ),
    );

    // Sign transaction, broadcast, and confirm
    const signature = await anchor.web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [fromWallet],
        {commitment: 'confirmed'},
    );
    return signature;
}