import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { get } from 'dot-prop';

export type FindingATAToken = {
    connection: anchor.web3.Connection;
    userPublicKey: anchor.web3.PublicKey;
    nftTokenAddress: anchor.web3.PublicKey;
    isFilterAmount?: boolean;
};

export default async function closeAccount({
    connection,
    userPublicKey,
    nftTokenAddress,
}: FindingATAToken) {
    const { value } = await connection.getParsedTokenAccountsByOwner(
        userPublicKey,
        {
            programId: TOKEN_PROGRAM_ID,
        },
    );
  
    for (let i = 0; i < value.length; i += 1) {
        const tokenAta = get(value[i], 'pubkey');
        const data = get(value[i], 'account.data.parsed');
        const mint = get(data, 'info.mint');
        if (nftTokenAddress.toBase58() === mint && parseInt(get(data, 'info.tokenAmount.amount')) === 0) {
            console.log(new anchor.web3.PublicKey(tokenAta));
        }
    }
}