import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { get } from 'dot-prop';

export type FindingATAToken = {
    connection: anchor.web3.Connection;
    userPublicKey: anchor.web3.PublicKey;
    nftTokenAddress: anchor.web3.PublicKey;
};

export default async function findATAToken({
    connection,
    userPublicKey,
    nftTokenAddress
}: FindingATAToken) {
    let transferFromATA: null | anchor.web3.PublicKey = null;

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

        if (
            nftTokenAddress.toBase58() === mint
        ) {
            transferFromATA = new anchor.web3.PublicKey(tokenAta);
        }
    }
  
    if (!transferFromATA) {
      throw new Error(
        `Not found associated token account for ${nftTokenAddress.toBase58()}`,
      );
    }
    
    return transferFromATA;
}