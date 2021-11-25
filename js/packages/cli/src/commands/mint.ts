import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { get } from 'dot-prop';
import {
  getCandyMachineAddress,
  getMasterEdition,
  getMetadata,
  getTokenWallet,
  loadCandyProgram,
  loadWalletKey,
  uuidFromConfigPubkey,
} from '../helpers/accounts';
import {
  TOKEN_METADATA_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../helpers/constants';
import * as anchor from '@project-serum/anchor';
import { MintLayout, Token } from '@solana/spl-token';
import { createAssociatedTokenAccountInstruction } from '../helpers/instructions';
import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
import transferToken from '../helpers/transfer-token';

export async function mint(
  keypair: string,
  nftTokenAddress: PublicKey,
  env: string,
  configAddress: PublicKey,
  rpcUrl: string,
): Promise<string> {
  let transferFromATA: null | anchor.web3.PublicKey = null;

  let amount: number = 0;

  const mint = Keypair.generate();

  const userKeyPair = loadWalletKey(keypair);

  const anchorProgram = await loadCandyProgram(userKeyPair, env, rpcUrl);

  const userTokenAccountAddress = await getTokenWallet(
    userKeyPair.publicKey,
    mint.publicKey,
  );

  const transferToATAKeypair = new anchor.web3.Keypair();

  const { connection } = anchorProgram.provider;

  const { value } = await connection.getParsedTokenAccountsByOwner(
    userKeyPair.publicKey,
    {
      programId: TOKEN_PROGRAM_ID,
    },
  );

  for (let i = 0; i < value.length; i += 1) {
    const tokenAta = get(value[i], 'pubkey');
    const data = get(value[i], 'account.data.parsed');
    const mint = get(data, 'info.mint');

    if (
      nftTokenAddress.toBase58() === mint &&
      parseInt(get(data, 'info.tokenAmount.amount')) > 0
    ) {
      transferFromATA = new anchor.web3.PublicKey(tokenAta);
      amount = parseInt(get(data, 'info.tokenAmount.amount'));
    }
  }

  if (!transferFromATA) {
    throw new Error(
      `Not found associated token account for ${nftTokenAddress.toBase58()}`,
    );
  }

  if (amount === 0) {
    throw new Error(
      `Amount should be greater than zero for ${nftTokenAddress.toBase58()}`,
    );
  }

  const transferTokenInstruction = await transferToken({
    connection,
    userPublicKey: userKeyPair.publicKey,
    newAtaTokenAdressPublicKey: transferToATAKeypair.publicKey,
    nftTokenAddress,
    transferFromATA,
  });

  const uuid = uuidFromConfigPubkey(configAddress);
  const [candyMachineAddress] = await getCandyMachineAddress(
    configAddress,
    uuid,
  );
  const candyMachine: any = await anchorProgram.account.candyMachine.fetch(
    candyMachineAddress,
  );

  const remainingAccounts = [];
  const signers = [mint, transferToATAKeypair, userKeyPair];
  const instructions = [
    ...transferTokenInstruction,

    anchor.web3.SystemProgram.createAccount({
      fromPubkey: userKeyPair.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MintLayout.span,
      lamports:
        await anchorProgram.provider.connection.getMinimumBalanceForRentExemption(
          MintLayout.span,
        ),
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitMintInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      0,
      userKeyPair.publicKey,
      userKeyPair.publicKey,
    ),
    createAssociatedTokenAccountInstruction(
      userTokenAccountAddress,
      userKeyPair.publicKey,
      userKeyPair.publicKey,
      mint.publicKey,
    ),
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      userTokenAccountAddress,
      userKeyPair.publicKey,
      [],
      1,
    ),
  ];

  let tokenAccount;
  if (candyMachine.tokenMint) {
    const transferAuthority = anchor.web3.Keypair.generate();

    tokenAccount = await getTokenWallet(
      userKeyPair.publicKey,
      candyMachine.tokenMint,
    );

    remainingAccounts.push({
      pubkey: tokenAccount,
      isWritable: true,
      isSigner: false,
    });
    remainingAccounts.push({
      pubkey: userKeyPair.publicKey,
      isWritable: false,
      isSigner: true,
    });

    instructions.push(
      Token.createApproveInstruction(
        TOKEN_PROGRAM_ID,
        tokenAccount,
        transferAuthority.publicKey,
        userKeyPair.publicKey,
        [],
        candyMachine.data.price.toNumber(),
      ),
    );
  }
  const metadataAddress = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);

  instructions.push(
    await anchorProgram.instruction.mintNft({
      accounts: {
        // address that store name and uri of asset
        config: configAddress, // DONE
        candyMachine: candyMachineAddress,

        payer: userKeyPair.publicKey, // DONE
        //@ts-ignore
        wallet: candyMachine.wallet,
        mint: mint.publicKey, // DONE
        metadata: metadataAddress, // DONE
        masterEdition, // DONE

        // temp account that hold use's nft balance
        transferToAtaKeypair: transferToATAKeypair.publicKey, // DONE

        // ATA of address user NFT
        nftHolderAddress: transferFromATA, // DONE

        // metadata address for NFT
        boxMetadataAddress: await getMetadata(nftTokenAddress), // DONE

        // nft address
        nftTokenAddress, // DONE

        mintAuthority: userKeyPair.publicKey, // done
        updateAuthority: userKeyPair.publicKey, // done

        // token meta program id
        // FIXME: should we move this in rust code?
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID, // DONE

        // token program id
        // FIXME: should we move this in rust code?
        tokenProgram: TOKEN_PROGRAM_ID, // DONE

        // system program id
        // FIXME: should we move this in rust code?
        systemProgram: SystemProgram.programId, // DONE

        // rent program id
        // FIXME: should we move this in rust code?
        rent: anchor.web3.SYSVAR_RENT_PUBKEY, // DONE

        // check go_live_date for when user mints nft
        // FIXME: should we move this in rust code?
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY, // DONE
      },
      remainingAccounts,
    }),
  );

  if (tokenAccount) {
    instructions.push(
      Token.createRevokeInstruction(
        TOKEN_PROGRAM_ID,
        tokenAccount,
        userKeyPair.publicKey,
        [],
      ),
    );
  }

  return (
    await sendTransactionWithRetryWithKeypair(
      anchorProgram.provider.connection,
      userKeyPair,
      instructions,
      signers,
    )
  ).txid;
}
