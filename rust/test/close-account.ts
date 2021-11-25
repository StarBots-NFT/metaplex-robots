import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { get } from 'dot-prop';

export type FindingATAToken = {
    connection: anchor.web3.Connection;
    token: Token;
    wallet: anchor.web3.Keypair;
    nftTokenAddress: anchor.web3.PublicKey;
    isFilterAmount?: boolean;
};

export default async function closeAccount({
    connection,
    token,
    wallet,
    nftTokenAddress,
}: FindingATAToken) {
    const { value } = await connection.getParsedTokenAccountsByOwner(
        wallet.publicKey,
        {
            programId: TOKEN_PROGRAM_ID,
        },
    );
    let count = 0;
    for (let i = 0; i < value.length; i += 1) {
        const tokenAta: anchor.web3.PublicKey = get(value[i], 'pubkey');
        const data = get(value[i], 'account.data.parsed');
        const mint = get(data, 'info.mint');
        if (nftTokenAddress.toBase58() === mint && parseInt(get(data, 'info.tokenAmount.amount')) === 0) {
            if(count > 0) {
                console.log(`close account token ${tokenAta.toBase58()}`);
                // Close for real
                await token.closeAccount(tokenAta, wallet.publicKey, wallet, []);
            }
            // NOTE: Keep 1 ATA for account
            count += 1;
        }
    }
}