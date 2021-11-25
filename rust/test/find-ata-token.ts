import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { get } from 'dot-prop';

export type FindingATAToken = {
    connection: anchor.web3.Connection;
    userPublicKey: anchor.web3.PublicKey;
    nftTokenAddress: anchor.web3.PublicKey;
    isFilterAmount?: boolean;
};

export default async function findATAToken({
    connection,
    userPublicKey,
    nftTokenAddress,
    isFilterAmount = false
}: FindingATAToken) {
    let transferFromATA: null | anchor.web3.PublicKey = null;

    const { value } = await connection.getParsedTokenAccountsByOwner(
        userPublicKey,
        {
            programId: TOKEN_PROGRAM_ID,
        },
    );
  
    for (let i = 0; i < value.length; i += 1) {
        const tokenAta: anchor.web3.PublicKey = get(value[i], 'pubkey');
        const data = get(value[i], 'account.data.parsed');
        const mint = get(data, 'info.mint');
        if (
            nftTokenAddress.toBase58() === mint
        ) {
            if(!isFilterAmount || (isFilterAmount && parseInt(get(data, 'info.tokenAmount.amount')) > 0))
                transferFromATA = tokenAta;
        }
    }
  
    // if (!transferFromATA) {
    //   throw new Error(
    //     `Not found associated token account for ${userPublicKey.toBase58()} ${nftTokenAddress.toBase58()}`,
    //   );
    // }
    
    return transferFromATA;
}