import * as anchor from '@project-serum/anchor';
import { Token, AccountLayout } from '@solana/spl-token';
import { TOKEN_PROGRAM_ID } from './constants';

export type TransferTokenType = {
  connection: anchor.web3.Connection;
  userPublicKey: anchor.web3.PublicKey;
  newAtaTokenAdressPublicKey: anchor.web3.PublicKey;
  nftTokenAddress: anchor.web3.PublicKey;
  transferFromATA: anchor.web3.PublicKey;
};

export default async function transferToken({
  connection,
  userPublicKey,
  newAtaTokenAdressPublicKey,
  nftTokenAddress,
  transferFromATA,
}: TransferTokenType) {
  // https://explorer.solana.com/address/HJdiGaCEa7gg7dyNqkxWWkaGvDNxTHEzGkcCqDophJM7?cluster=devnet
  const createTempTokenAccountIx = anchor.web3.SystemProgram.createAccount({
    programId: TOKEN_PROGRAM_ID,
    space: AccountLayout.span,
    lamports: await connection.getMinimumBalanceForRentExemption(
      AccountLayout.span,
    ),
    fromPubkey: userPublicKey,
    newAccountPubkey: newAtaTokenAdressPublicKey,
  });

  const initTempAccountIx = Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID,
    nftTokenAddress,
    newAtaTokenAdressPublicKey,
    userPublicKey,
  );

  const transferXTokensToTempAccIx = Token.createTransferInstruction(
    TOKEN_PROGRAM_ID,
    transferFromATA,
    newAtaTokenAdressPublicKey,
    userPublicKey,
    [],
    1,
  );

  return [
    createTempTokenAccountIx,
    initTempAccountIx,
    transferXTokensToTempAccIx,
  ];
}
