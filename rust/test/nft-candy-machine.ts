import * as anchor from "@project-serum/anchor";
import assert from "assert";
import { AccountLayout, MintLayout, Token } from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { CandyMachine, Config } from "./nft-candy-machine-types";
import transferToken, { createATAToken } from './transfer-token';
import findATAToken from './find-ata-token';
import closeAccount from './close-account';
import {
  PRIMARY_WALLET,
  LOOTBOX_HOLDER_WALLET
} from './constants';

const NFT_LOOTBOX = new PublicKey('4FwT8xRru7NRk4GF2iQmbBmuXwh7QqP6dhSmA23swGKC');

let PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS;

let LOOTBOX_HOLDER_WALLET_LOOTBOX_ATA_ADDRESS;

const NFT_LOOTBOX_NOT_ISSUE_BY_US = new PublicKey('7coQY4DvPkWawMemd5X8Tj1M3xHXtP5nD4ZmKhJdMXEa');

let PRIMARY_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS;

let LOOTBOX_HOLDER_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS;

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

function fromUTF8Array(data: number[]) {
  // array of bytes
  let str = "",
    i;

  for (i = 0; i < data.length; i++) {
    const value = data[i];

    if (value < 0x80) {
      str += String.fromCharCode(value);
    } else if (value > 0xbf && value < 0xe0) {
      str += String.fromCharCode(((value & 0x1f) << 6) | (data[i + 1] & 0x3f));
      i += 1;
    } else if (value > 0xdf && value < 0xf0) {
      str += String.fromCharCode(
        ((value & 0x0f) << 12) |
          ((data[i + 1] & 0x3f) << 6) |
          (data[i + 2] & 0x3f)
      );
      i += 2;
    } else {
      // surrogate pair
      const charCode =
        (((value & 0x07) << 18) |
          ((data[i + 1] & 0x3f) << 12) |
          ((data[i + 2] & 0x3f) << 6) |
          (data[i + 3] & 0x3f)) -
        0x010000;

      str += String.fromCharCode(
        (charCode >> 10) | 0xd800,
        (charCode & 0x03ff) | 0xdc00
      );
      i += 3;
    }
  }

  return str;
}
export function createAssociatedTokenAccountInstruction(
  associatedTokenAddress: PublicKey,
  payer: PublicKey,
  walletAddress: PublicKey,
  splTokenMintAddress: PublicKey
) {
  const keys = [
    {
      pubkey: payer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
}
const configArrayStart =
  32 + // authority
  4 +
  6 + // uuid + u32 len
  4 +
  10 + // u32 len + symbol
  2 + // seller fee basis points
  1 +
  4 +
  5 * 34 + // optional + u32 len + actual vec
  8 + //max supply
  1 + //is mutable
  1 + // retain authority
  4; // max number of lines;
const configLineSize = 4 + 32 + 4 + 200;

const CANDY_MACHINE = "candy_machine";
describe("nft-candy-machine", function () {
  // Configure the client to use the local cluster.
  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/nft_candy_machine.json", "utf8")
  );

  // const myWallet = anchor.web3.Keypair.fromSecretKey(
  //   new Uint8Array(
  //     JSON.parse(require("fs").readFileSync(process.env.MY_WALLET, "utf8"))
  //   )
  // );

  const myWallet = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(
      PRIMARY_WALLET
    )
  );

  console.log(`main wallet = ${myWallet.publicKey.toString()}`);

  const lootboxHolderWallet = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(
      LOOTBOX_HOLDER_WALLET
    )
  );

  console.log(`lootbox holder wallet = ${lootboxHolderWallet.publicKey.toString()}`);

  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com/",
    "recent"
  );

  const nftLootboxToken = new Token(
    connection,
    NFT_LOOTBOX,
    TOKEN_PROGRAM_ID,
    myWallet
  );

  const nftLootboxNotIssueByUsToken = new Token(
    connection,
    NFT_LOOTBOX_NOT_ISSUE_BY_US,
    TOKEN_PROGRAM_ID,
    myWallet
  );

  // Address of the deployed program.
  const programId = new anchor.web3.PublicKey(
    // "cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ",
    "62pGDxQSA9pYR6SVE2Z58zAi2Xzpxyztgp4w5otf4bXE"
  );

  const walletWrapper = new anchor.Wallet(myWallet);

  const provider = new anchor.Provider(connection, walletWrapper, {
    preflightCommitment: "recent",
  });
  const program = new anchor.Program(idl, programId, provider);

  const getCandyMachine = async (
    config: anchor.web3.PublicKey,
    uuid: string
  ) => {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(CANDY_MACHINE), config.toBuffer(), Buffer.from(uuid)],
      programId
    );
  };

  const getMetadata = async (
    mint: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> => {
    return (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0];
  };

  const getMasterEdition = async (
    mint: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> => {
    return (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0];
  };

  const createConfig = async function (
    that,
    retainAuthority: boolean,
    size: number
  ): Promise<TransactionInstruction> {
    that.authority = anchor.web3.Keypair.generate();
    that.uuid = anchor.web3.Keypair.generate().publicKey.toBase58().slice(0, 6);

    return await program.instruction.initializeConfig(
      {
        uuid: that.uuid,
        maxNumberOfLines: new anchor.BN(size),
        symbol: "SYMBOL",
        sellerFeeBasisPoints: 500,
        isMutable: true,
        maxSupply: new anchor.BN(0),
        retainAuthority,
        creators: [
          { address: myWallet.publicKey, verified: false, share: 100 },
        ],
      },
      {
        accounts: {
          config: that.config.publicKey,
          authority: that.authority.publicKey,
          payer: myWallet.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [myWallet, that.config],
      }
    );
  };

  const addConfigLines = async function (
    that,
    size: number
  ): Promise<TransactionInstruction[]> {
    const sample = {
      uri: "www.aol.com",
      isMutable: true,
    };
    const firstVec = [];
    for (let i = 0; i < 5; i++) {
      firstVec.push({ ...sample, name: `Sample ${i}` });
    }

    const tx1 = await program.instruction.addConfigLines(0, firstVec, {
      accounts: {
        config: that.config.publicKey,
        authority: that.authority.publicKey,
      },
      signers: [that.authority, myWallet],
    });
    if (size != 5) {
      const secondVec = [];
      for (let i = 5; i < 10; i++) {
        secondVec.push({ ...sample, name: `Sample ${i}` });
      }
      const tx2 = await program.instruction.addConfigLines(5, secondVec, {
        accounts: {
          config: that.config.publicKey,
          authority: that.authority.publicKey,
        },
        signers: [that.authority, myWallet],
      });

      // Run tx2 twice to simulate an overwrite which might tip counter to overcount.
      return [tx1, tx2, tx2];
    } else return [tx1];
  };

  const getTokenWallet = async function (wallet: PublicKey, mint: PublicKey) {
    return (
      await PublicKey.findProgramAddress(
        [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
      )
    )[0];
  };

  describe("sol only", function () {
    beforeEach(async function () {

      LOOTBOX_HOLDER_WALLET_LOOTBOX_ATA_ADDRESS = await findATAToken({
        connection,
        userPublicKey: lootboxHolderWallet.publicKey,
        nftTokenAddress: NFT_LOOTBOX,
        isFilterAmount: true
      });

      PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS = await findATAToken({
        connection,
        userPublicKey: myWallet.publicKey,
        nftTokenAddress: NFT_LOOTBOX
      });

      if(!LOOTBOX_HOLDER_WALLET_LOOTBOX_ATA_ADDRESS) {
        // if not found, find any ata addrress
        LOOTBOX_HOLDER_WALLET_LOOTBOX_ATA_ADDRESS = await findATAToken({
          connection,
          userPublicKey: lootboxHolderWallet.publicKey,
          nftTokenAddress: NFT_LOOTBOX,
        });
      }

      const config = await anchor.web3.Keypair.generate();
      this.config = config;
      const txInstr = await createConfig(this, false, 10);
      const linesInstr = await addConfigLines(this, 10);
      this.candyMachineUuid = anchor.web3.Keypair.generate()
        .publicKey.toBase58()
        .slice(0, 6);
      const [candyMachine, bump] = await getCandyMachine(
        this.config.publicKey,
        this.candyMachineUuid
      );

      try {
        const tx = await program.rpc.initializeCandyMachine(
          bump,
          {
            uuid: this.candyMachineUuid,
            price: new anchor.BN(1000000000),
            itemsAvailable: new anchor.BN(10),
            // goLiveDate: null,
            goLiveDate: new anchor.BN(1632615120)
          },
          {
            accounts: {
              candyMachine,
              wallet: myWallet.publicKey,
              config: this.config.publicKey,
              authority: this.authority.publicKey,
              payer: myWallet.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [myWallet, this.authority, this.config],
            instructions: [
              anchor.web3.SystemProgram.createAccount({
                fromPubkey: myWallet.publicKey,
                newAccountPubkey: config.publicKey,
                space: configArrayStart + 4 + 10 * configLineSize + 4 + 2,
                lamports:
                  await provider.connection.getMinimumBalanceForRentExemption(
                    configArrayStart + 4 + 10 * configLineSize + 4 + 2
                  ),
                programId: programId,
              }),
              anchor.web3.SystemProgram.transfer({
                fromPubkey: myWallet.publicKey,
                toPubkey: this.authority.publicKey,
                lamports: 5,
              }),
              txInstr,
              ...linesInstr,
            ],
          }
        );
      } catch (e) {
        console.log(e);
        throw e;
      }
    });

    it("has all ten lines", async function () {
      const config = await connection.getAccountInfo(this.config.publicKey);

      const amountOfConfigs = new anchor.BN(
        config.data.slice(configArrayStart, configArrayStart + 4),
        "le"
      );
      assert.equal(amountOfConfigs.toNumber(), 10);
      for (let i = 0; i < amountOfConfigs.toNumber(); i++) {
        const thisSlice = config.data.slice(
          configArrayStart + 4 + configLineSize * i,
          configArrayStart + 4 + configLineSize * (i + 1)
        );
        const name = fromUTF8Array([...thisSlice.slice(4, 36)]);
        const uri = fromUTF8Array([...thisSlice.slice(40, 240)]);
        assert.equal(name.replace(/\0/g, "").trim(), `Sample ${i}`);
        assert.equal(uri.replace(/\0/g, "").trim(), "www.aol.com");
      }
    });

    it("Is initialized!", async function () {
      // Add your test here.
      const [candyMachine, bump] = await getCandyMachine(
        this.config.publicKey,
        this.candyMachineUuid
      );

      const machine: CandyMachine = await program.account.candyMachine.fetch(
        candyMachine
      );
      assert.equal(machine.data.uuid, this.candyMachineUuid);
      assert.ok(machine.wallet.equals(myWallet.publicKey));
      assert.ok(machine.config.equals(this.config.publicKey));
      assert.ok(machine.authority.equals(this.authority.publicKey));
      assert.equal(
        machine.data.price.toNumber(),
        new anchor.BN(1000000000).toNumber()
      );
      assert.equal(machine.bump, bump);
      assert.equal(
        machine.data.itemsAvailable.toNumber(),
        new anchor.BN(10).toNumber()
      );
      assert.equal(machine.tokenMint, null);
    });

    const transferToATAKeypair = new anchor.web3.Keypair();

    it("mint 1 robot and transfer 1 lootbox", async function () {
      // transfer NFT
      const primaryWalletLootboxAtaInfo = await nftLootboxToken.getAccountInfo(PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS);

      const holderWalletLootboxAtaInfo = await nftLootboxToken.getAccountInfo(LOOTBOX_HOLDER_WALLET_LOOTBOX_ATA_ADDRESS);

      // https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js#L862
      if(holderWalletLootboxAtaInfo.amount.toNumber() === 1 && primaryWalletLootboxAtaInfo.amount.toNumber() === 0) {
        const transaction = await nftLootboxToken.transfer(
          LOOTBOX_HOLDER_WALLET_LOOTBOX_ATA_ADDRESS,
          PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS,
          lootboxHolderWallet.publicKey,
          [lootboxHolderWallet],
          1,
        );
        console.log(`transfer nft to ${PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS.toString()}`, transaction);
      }
  
      const mint = anchor.web3.Keypair.generate();
      const token = await getTokenWallet(
        this.authority.publicKey,
        mint.publicKey
      );
      const metadata = await getMetadata(mint.publicKey);
      const masterEdition = await getMasterEdition(mint.publicKey);
      const [candyMachine, _] = await getCandyMachine(
        this.config.publicKey,
        this.candyMachineUuid
      );

      const transferTokenInstruction = await transferToken({
        connection,
        userPublicKey: myWallet.publicKey,
        // userPublicKey: this.authority.publicKey,
        newAtaTokenAdressPublicKey: transferToATAKeypair.publicKey,
        nftTokenAddress: NFT_LOOTBOX,
        transferFromATA: PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS,
      });

      try {
        const tx = await program.rpc.mintNft({
          accounts: {
            config: this.config.publicKey,
            candyMachine: candyMachine,
            // payer: this.authority.publicKey,
            payer: myWallet.publicKey,
            wallet: myWallet.publicKey,
            mint: mint.publicKey,

            nftTokenAddress: NFT_LOOTBOX,
            transferToAtaKeypair: transferToATAKeypair.publicKey,
            boxMetadataAddress: await getMetadata(NFT_LOOTBOX),
            nftHolderAddress: PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS,

            metadata,
            masterEdition,
            mintAuthority: this.authority.publicKey,
            updateAuthority: this.authority.publicKey,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          },
          signers: [mint, this.authority, transferToATAKeypair, myWallet],
          instructions: [
            ...transferTokenInstruction,
            // Give authority enough to pay off the cost of the nft!
            // it'll be funnneled right back
            anchor.web3.SystemProgram.transfer({
              fromPubkey: myWallet.publicKey,
              toPubkey: this.authority.publicKey,
              lamports: 1000000000 + 10000000, // add minting fees in there
            }),
            anchor.web3.SystemProgram.createAccount({
              fromPubkey: myWallet.publicKey,
              newAccountPubkey: mint.publicKey,
              space: MintLayout.span,
              lamports:
                await provider.connection.getMinimumBalanceForRentExemption(
                  MintLayout.span
                ),
              programId: TOKEN_PROGRAM_ID,
            }),
            Token.createInitMintInstruction(
              TOKEN_PROGRAM_ID,
              mint.publicKey,
              0,
              this.authority.publicKey,
              this.authority.publicKey
            ),
            createAssociatedTokenAccountInstruction(
              token,
              myWallet.publicKey,
              this.authority.publicKey,
              mint.publicKey
            ),
            Token.createMintToInstruction(
              TOKEN_PROGRAM_ID,
              mint.publicKey,
              token,
              this.authority.publicKey,
              [],
              1
            ),
          ],
        });

        console.log(`tx = ${tx}`);
      } catch (e) {
        console.log("Failure at ", e);
        throw e;
      }

      const metadataAccount = await connection.getAccountInfo(metadata);
      assert.ok(metadataAccount.data.length > 0);
      const masterEditionAccount = await connection.getAccountInfo(
        masterEdition
      );
      assert.ok(masterEditionAccount.data.length > 0);
    });

    it("mint robot with empty temp account", async function () {
      const transferToATAKeypair = new anchor.web3.Keypair();

      try {
        const transferTokenInstruction = await createATAToken({
          connection,
          userPublicKey: myWallet.publicKey,
          // userPublicKey: this.authority.publicKey,
          newAtaTokenAdressPublicKey: transferToATAKeypair.publicKey,
          nftTokenAddress: NFT_LOOTBOX,
          transferFromATA: PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS,
        });

        const mint = anchor.web3.Keypair.generate();
        const token = await getTokenWallet(
          this.authority.publicKey,
          mint.publicKey
        );
        const metadata = await getMetadata(mint.publicKey);
        const masterEdition = await getMasterEdition(mint.publicKey);
        const [candyMachine, _] = await getCandyMachine(
          this.config.publicKey,
          this.candyMachineUuid
        );

        const tx = await program.rpc.mintNft({
          accounts: {
            config: this.config.publicKey,
            candyMachine: candyMachine,
            // payer: this.authority.publicKey,
            payer: myWallet.publicKey,
            wallet: myWallet.publicKey,
            mint: mint.publicKey,

            nftTokenAddress: NFT_LOOTBOX,
            transferToAtaKeypair: transferToATAKeypair.publicKey,
            boxMetadataAddress: await getMetadata(NFT_LOOTBOX),
            nftHolderAddress: PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS, // DONE

            metadata,
            masterEdition,
            mintAuthority: this.authority.publicKey,
            updateAuthority: this.authority.publicKey,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          },
          signers: [mint, this.authority, transferToATAKeypair, myWallet],
          instructions: [
            ...transferTokenInstruction,
            // Give authority enough to pay off the cost of the nft!
            // it'll be funnneled right back
            anchor.web3.SystemProgram.transfer({
              fromPubkey: myWallet.publicKey,
              toPubkey: this.authority.publicKey,
              lamports: 1000000000 + 10000000, // add minting fees in there
            }),
            anchor.web3.SystemProgram.createAccount({
              fromPubkey: myWallet.publicKey,
              newAccountPubkey: mint.publicKey,
              space: MintLayout.span,
              lamports:
                await provider.connection.getMinimumBalanceForRentExemption(
                  MintLayout.span
                ),
              programId: TOKEN_PROGRAM_ID,
            }),
            Token.createInitMintInstruction(
              TOKEN_PROGRAM_ID,
              mint.publicKey,
              0,
              this.authority.publicKey,
              this.authority.publicKey
            ),
            createAssociatedTokenAccountInstruction(
              token,
              myWallet.publicKey,
              this.authority.publicKey,
              mint.publicKey
            ),
            Token.createMintToInstruction(
              TOKEN_PROGRAM_ID,
              mint.publicKey,
              token,
              this.authority.publicKey,
              [],
              1
            ),
          ],
        });

        assert.equal(true, false, 'tx should be false');

      } catch (err) {
        assert.equal(err.msg, 'Balance is invalid');

        await closeAccount({
          connection,
          token: nftLootboxToken,
          wallet: myWallet,
          nftTokenAddress: NFT_LOOTBOX
        });

        await closeAccount({
          connection,
          token: nftLootboxToken,
          wallet: lootboxHolderWallet,
          nftTokenAddress: NFT_LOOTBOX
        });
      }
    });

    it("user try to send fake lootbox nft", async function () {
      try {
        // transfer NFT
        const transferToATAKeypair = new anchor.web3.Keypair();

        LOOTBOX_HOLDER_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS = await findATAToken({
          connection,
          userPublicKey: lootboxHolderWallet.publicKey,
          nftTokenAddress: NFT_LOOTBOX_NOT_ISSUE_BY_US,
          isFilterAmount: true
        });

        PRIMARY_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS = await findATAToken({
          connection,
          userPublicKey: myWallet.publicKey,
          nftTokenAddress: NFT_LOOTBOX_NOT_ISSUE_BY_US
        });

        if(!LOOTBOX_HOLDER_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS) {
          // if not found, find any ata addrress
          LOOTBOX_HOLDER_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS = await findATAToken({
            connection,
            userPublicKey: lootboxHolderWallet.publicKey,
            nftTokenAddress: NFT_LOOTBOX_NOT_ISSUE_BY_US,
          });
        }

        const primaryWalletLootboxAtaInfo = await nftLootboxNotIssueByUsToken.getAccountInfo(PRIMARY_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS);

        const holderWalletLootboxAtaInfo = await nftLootboxNotIssueByUsToken.getAccountInfo(LOOTBOX_HOLDER_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS);

        // https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js#L862
        if(holderWalletLootboxAtaInfo.amount.toNumber() === 1 && primaryWalletLootboxAtaInfo.amount.toNumber() === 0) {
          const transaction = await nftLootboxNotIssueByUsToken.transfer(
            LOOTBOX_HOLDER_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS,
            PRIMARY_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS,
            lootboxHolderWallet.publicKey,
            [lootboxHolderWallet],
            1,
          );

          console.log(`transfer nft to ${PRIMARY_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS.toString()}`, transaction);
        }
  
        const mint = anchor.web3.Keypair.generate();
        const token = await getTokenWallet(
          this.authority.publicKey,
          mint.publicKey
        );
        const metadata = await getMetadata(mint.publicKey);
        const masterEdition = await getMasterEdition(mint.publicKey);
        const [candyMachine, _] = await getCandyMachine(
          this.config.publicKey,
          this.candyMachineUuid
        );

        const transferTokenInstruction = await transferToken({
          connection,
          userPublicKey: myWallet.publicKey,
          // userPublicKey: this.authority.publicKey,
          newAtaTokenAdressPublicKey: transferToATAKeypair.publicKey,
          nftTokenAddress: NFT_LOOTBOX_NOT_ISSUE_BY_US,
          transferFromATA: PRIMARY_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS,
        });

        const tx = await program.rpc.mintNft({
          accounts: {
            config: this.config.publicKey,
            candyMachine: candyMachine,
            // payer: this.authority.publicKey,
            payer: myWallet.publicKey,
            wallet: myWallet.publicKey,
            mint: mint.publicKey,

            nftTokenAddress: NFT_LOOTBOX_NOT_ISSUE_BY_US,
            transferToAtaKeypair: transferToATAKeypair.publicKey,
            boxMetadataAddress: await getMetadata(NFT_LOOTBOX_NOT_ISSUE_BY_US),
            nftHolderAddress: PRIMARY_WALLET_NFT_LOOTBOX_NOT_ISSUE_ATA_ADDRESS,

            metadata,
            masterEdition,
            mintAuthority: this.authority.publicKey,
            updateAuthority: this.authority.publicKey,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          },
          signers: [mint, this.authority, transferToATAKeypair, myWallet],
          instructions: [
            ...transferTokenInstruction,
            // Give authority enough to pay off the cost of the nft!
            // it'll be funnneled right back
            anchor.web3.SystemProgram.transfer({
              fromPubkey: myWallet.publicKey,
              toPubkey: this.authority.publicKey,
              lamports: 1000000000 + 10000000, // add minting fees in there
            }),
            anchor.web3.SystemProgram.createAccount({
              fromPubkey: myWallet.publicKey,
              newAccountPubkey: mint.publicKey,
              space: MintLayout.span,
              lamports:
                await provider.connection.getMinimumBalanceForRentExemption(
                  MintLayout.span
                ),
              programId: TOKEN_PROGRAM_ID,
            }),
            Token.createInitMintInstruction(
              TOKEN_PROGRAM_ID,
              mint.publicKey,
              0,
              this.authority.publicKey,
              this.authority.publicKey
            ),
            createAssociatedTokenAccountInstruction(
              token,
              myWallet.publicKey,
              this.authority.publicKey,
              mint.publicKey
            ),
            Token.createMintToInstruction(
              TOKEN_PROGRAM_ID,
              mint.publicKey,
              token,
              this.authority.publicKey,
              [],
              1
            ),
          ],
        });

        assert.equal(true, false, 'tx should be false');

      } catch (err) {
        assert.equal(err.msg, 'Your loot box is not issue by us!');

        await closeAccount({
          connection,
          token: nftLootboxNotIssueByUsToken,
          wallet: lootboxHolderWallet,
          nftTokenAddress: NFT_LOOTBOX_NOT_ISSUE_BY_US
        });
      }
    });

    it("user try to send fake metadata address", async function () {
      try {
        const transferToATAKeypair = new anchor.web3.Keypair();

        // transfer NFT
        const primaryWalletLootboxAtaInfo = await nftLootboxToken.getAccountInfo(PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS);

        const holderWalletLootboxAtaInfo = await nftLootboxToken.getAccountInfo(LOOTBOX_HOLDER_WALLET_LOOTBOX_ATA_ADDRESS);

        // https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js#L862
        if(holderWalletLootboxAtaInfo.amount.toNumber() === 1 && primaryWalletLootboxAtaInfo.amount.toNumber() === 0) {
          const transaction = await nftLootboxToken.transfer(
            LOOTBOX_HOLDER_WALLET_LOOTBOX_ATA_ADDRESS,
            PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS,
            lootboxHolderWallet.publicKey,
            [lootboxHolderWallet],
            1,
          );
          console.log(`transfer nft to ${PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS.toString()}`, transaction);
        }
    
        const mint = anchor.web3.Keypair.generate();
        const token = await getTokenWallet(
          this.authority.publicKey,
          mint.publicKey
        );
        const metadata = await getMetadata(mint.publicKey);
        const masterEdition = await getMasterEdition(mint.publicKey);
        const [candyMachine, _] = await getCandyMachine(
          this.config.publicKey,
          this.candyMachineUuid
        );

        const transferTokenInstruction = await transferToken({
          connection,
          userPublicKey: myWallet.publicKey,
          // userPublicKey: this.authority.publicKey,
          newAtaTokenAdressPublicKey: transferToATAKeypair.publicKey,
          nftTokenAddress: NFT_LOOTBOX,
          transferFromATA: PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS,
        });

        const tx = await program.rpc.mintNft({
          accounts: {
            config: this.config.publicKey,
            candyMachine: candyMachine,
            // payer: this.authority.publicKey,
            payer: myWallet.publicKey,
            wallet: myWallet.publicKey,
            mint: mint.publicKey,

            nftTokenAddress: NFT_LOOTBOX,
            transferToAtaKeypair: transferToATAKeypair.publicKey,
            boxMetadataAddress: await getMetadata(new PublicKey('5ddkvpA1x5ypGmsYkfKwFzhvnNKuTGttUAvzDrkWKawS')),
            nftHolderAddress: PRIMARY_WALLET_LOOTBOX_ATA_ADDRESS, // DONE

            metadata,
            masterEdition,
            mintAuthority: this.authority.publicKey,
            updateAuthority: this.authority.publicKey,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          },
          signers: [mint, this.authority, transferToATAKeypair, myWallet],
          instructions: [
            ...transferTokenInstruction,
            // Give authority enough to pay off the cost of the nft!
            // it'll be funnneled right back
            anchor.web3.SystemProgram.transfer({
              fromPubkey: myWallet.publicKey,
              toPubkey: this.authority.publicKey,
              lamports: 1000000000 + 10000000, // add minting fees in there
            }),
            anchor.web3.SystemProgram.createAccount({
              fromPubkey: myWallet.publicKey,
              newAccountPubkey: mint.publicKey,
              space: MintLayout.span,
              lamports:
                await provider.connection.getMinimumBalanceForRentExemption(
                  MintLayout.span
                ),
              programId: TOKEN_PROGRAM_ID,
            }),
            Token.createInitMintInstruction(
              TOKEN_PROGRAM_ID,
              mint.publicKey,
              0,
              this.authority.publicKey,
              this.authority.publicKey
            ),
            createAssociatedTokenAccountInstruction(
              token,
              myWallet.publicKey,
              this.authority.publicKey,
              mint.publicKey
            ),
            Token.createMintToInstruction(
              TOKEN_PROGRAM_ID,
              mint.publicKey,
              token,
              this.authority.publicKey,
              [],
              1
            ),
          ],
        });
        assert.equal(true, false, 'tx should be false');

      } catch (err) {
        console.log(err);
        assert.equal(err.msg, 'Metadata of lootbox is not match with nft address');
      }
    });

    // it("mints with goLive date not as the authority over the candy machine", async function () {
    //   // myWallet isnt authority, this.authority is, so shouldnt be able to mint until goLive set.
    //   const mint = anchor.web3.Keypair.generate();
    //   const token = await getTokenWallet(myWallet.publicKey, mint.publicKey);
    //   const metadata = await getMetadata(mint.publicKey);
    //   const masterEdition = await getMasterEdition(mint.publicKey);
    //   const [candyMachine, _] = await getCandyMachine(
    //     this.config.publicKey,
    //     this.candyMachineUuid
    //   );

    //   try {
    //     const tx = await program.rpc.mintNft({
    //       accounts: {
    //         config: this.config.publicKey,
    //         candyMachine,
    //         payer: myWallet.publicKey,
    //         wallet: myWallet.publicKey,
    //         mint: mint.publicKey,
    //         metadata,
    //         masterEdition,
    //         mintAuthority: myWallet.publicKey,
    //         updateAuthority: myWallet.publicKey,
    //         tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    //         tokenProgram: TOKEN_PROGRAM_ID,
    //         systemProgram: SystemProgram.programId,
    //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //         clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    //       },
    //       signers: [mint, this.authority, myWallet],
    //       instructions: [
    //         program.instruction.updateCandyMachine(null, new anchor.BN(500), {
    //           accounts: {
    //             candyMachine,
    //             authority: this.authority.publicKey,
    //           },
    //         }),
    //         anchor.web3.SystemProgram.createAccount({
    //           fromPubkey: myWallet.publicKey,
    //           newAccountPubkey: mint.publicKey,
    //           space: MintLayout.span,
    //           lamports:
    //             await provider.connection.getMinimumBalanceForRentExemption(
    //               MintLayout.span
    //             ),
    //           programId: TOKEN_PROGRAM_ID,
    //         }),
    //         Token.createInitMintInstruction(
    //           TOKEN_PROGRAM_ID,
    //           mint.publicKey,
    //           0,
    //           myWallet.publicKey,
    //           myWallet.publicKey
    //         ),
    //         createAssociatedTokenAccountInstruction(
    //           token,
    //           myWallet.publicKey,
    //           myWallet.publicKey,
    //           mint.publicKey
    //         ),
    //         Token.createMintToInstruction(
    //           TOKEN_PROGRAM_ID,
    //           mint.publicKey,
    //           token,
    //           myWallet.publicKey,
    //           [],
    //           1
    //         ),
    //       ],
    //     });
    //   } catch (e) {
    //     console.log(e);
    //     throw e;
    //   }

    //   const metadataAccount = await connection.getAccountInfo(metadata);
    //   assert.ok(metadataAccount.data.length > 0);

    //   const metadataAuthority = metadataAccount.data.slice(1, 33).join("");

    //   assert.equal(metadataAuthority, myWallet.publicKey.toBytes().join(""));

    //   const masterEditionAccount = await connection.getAccountInfo(
    //     masterEdition
    //   );
    //   assert.ok(masterEditionAccount.data.length > 0);
    // });

  //   it("mints without goLive date", async function () {
  //     const authorityLamports = await connection.getBalance(
  //       this.authority.publicKey
  //     );
  //     const walletLamports = await connection.getBalance(myWallet.publicKey);
  //     const mint = anchor.web3.Keypair.generate();
  //     const token = await getTokenWallet(
  //       this.authority.publicKey,
  //       mint.publicKey
  //     );
  //     const metadata = await getMetadata(mint.publicKey);
  //     const masterEdition = await getMasterEdition(mint.publicKey);
  //     const [candyMachine, _] = await getCandyMachine(
  //       this.config.publicKey,
  //       this.candyMachineUuid
  //     );
  //     try {
  //       const tx = await program.rpc.mintNft({
  //         accounts: {
  //           config: this.config.publicKey,
  //           candyMachine: candyMachine,
  //           payer: this.authority.publicKey,
  //           wallet: myWallet.publicKey,
  //           mint: mint.publicKey,
  //           metadata,
  //           masterEdition,
  //           mintAuthority: this.authority.publicKey,
  //           updateAuthority: this.authority.publicKey,
  //           tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //           tokenProgram: TOKEN_PROGRAM_ID,
  //           systemProgram: SystemProgram.programId,
  //           rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //           clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //         },
  //         signers: [mint, this.authority, myWallet],
  //         instructions: [
  //           // Give authority enough to pay off the cost of the nft!
  //           // it'll be funnneled right back
  //           anchor.web3.SystemProgram.transfer({
  //             fromPubkey: myWallet.publicKey,
  //             toPubkey: this.authority.publicKey,
  //             lamports: 1000000000 + 10000000, // add minting fees in there
  //           }),
  //           anchor.web3.SystemProgram.createAccount({
  //             fromPubkey: myWallet.publicKey,
  //             newAccountPubkey: mint.publicKey,
  //             space: MintLayout.span,
  //             lamports:
  //               await provider.connection.getMinimumBalanceForRentExemption(
  //                 MintLayout.span
  //               ),
  //             programId: TOKEN_PROGRAM_ID,
  //           }),
  //           Token.createInitMintInstruction(
  //             TOKEN_PROGRAM_ID,
  //             mint.publicKey,
  //             0,
  //             this.authority.publicKey,
  //             this.authority.publicKey
  //           ),
  //           createAssociatedTokenAccountInstruction(
  //             token,
  //             myWallet.publicKey,
  //             this.authority.publicKey,
  //             mint.publicKey
  //           ),
  //           Token.createMintToInstruction(
  //             TOKEN_PROGRAM_ID,
  //             mint.publicKey,
  //             token,
  //             this.authority.publicKey,
  //             [],
  //             1
  //           ),
  //         ],
  //       });
  //     } catch (e) {
  //       console.log(e);
  //       throw e;
  //     }

  //     const metadataAccount = await connection.getAccountInfo(metadata);
  //     assert.ok(metadataAccount.data.length > 0);
  //     const masterEditionAccount = await connection.getAccountInfo(
  //       masterEdition
  //     );
  //     assert.ok(masterEditionAccount.data.length > 0);
  //     // since we transferred in the exact amount in advance from our own wallet,
  //     // should be no net change in authority, and should be minor change in wallet
  //     // since nft price paid back. Only real cost should be tx fees.
  //     const newAuthorityLamports = await connection.getBalance(
  //       this.authority.publicKey
  //     );
  //     const newWalletLamports = await connection.getBalance(myWallet.publicKey);
  //     assert.ok(authorityLamports - newAuthorityLamports < 10000);
  //     // less minting fees...
  //     assert.ok(walletLamports - newWalletLamports < 15000000);
  //   });
  // });

  // describe("token", function () {
  //   beforeEach(async function () {
  //     const config = await anchor.web3.Keypair.generate();
  //     this.config = config;
  //     const txInstr = await createConfig(this, true, 5);
  //     const linesInstr = await addConfigLines(this, 5);
  //     this.tokenMint = anchor.web3.Keypair.generate();
  //     this.candyMachineUuid = anchor.web3.Keypair.generate()
  //       .publicKey.toBase58()
  //       .slice(0, 6);
  //     const [candyMachine, bump] = await getCandyMachine(
  //       this.config.publicKey,
  //       this.candyMachineUuid
  //     );
  //     this.walletToken = await getTokenWallet(
  //       myWallet.publicKey,
  //       this.tokenMint.publicKey
  //     );
  //     try {
  //       const tx = await program.rpc.initializeCandyMachine(
  //         bump,
  //         {
  //           uuid: this.candyMachineUuid,
  //           price: new anchor.BN(1),
  //           itemsAvailable: new anchor.BN(5),
  //           goLiveDate: null,
  //         },
  //         {
  //           accounts: {
  //             candyMachine,
  //             wallet: this.walletToken,
  //             config: this.config.publicKey,
  //             authority: this.authority.publicKey,
  //             payer: myWallet.publicKey,
  //             systemProgram: anchor.web3.SystemProgram.programId,
  //             rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //           },
  //           remainingAccounts: [
  //             {
  //               pubkey: this.tokenMint.publicKey,
  //               isWritable: false,
  //               isSigner: true,
  //             },
  //           ],
  //           signers: [myWallet, this.tokenMint, this.authority, this.config],
  //           instructions: [
  //             anchor.web3.SystemProgram.createAccount({
  //               fromPubkey: myWallet.publicKey,
  //               newAccountPubkey: config.publicKey,
  //               space: configArrayStart + 4 + 5 * configLineSize + 4 + 1,
  //               lamports:
  //                 await provider.connection.getMinimumBalanceForRentExemption(
  //                   configArrayStart + 4 + 5 * configLineSize + 4 + 1
  //                 ),
  //               programId: programId,
  //             }),
  //             anchor.web3.SystemProgram.transfer({
  //               fromPubkey: myWallet.publicKey,
  //               toPubkey: this.authority.publicKey,
  //               lamports: 5,
  //             }),
  //             anchor.web3.SystemProgram.createAccount({
  //               fromPubkey: myWallet.publicKey,
  //               newAccountPubkey: this.tokenMint.publicKey,
  //               space: MintLayout.span,
  //               lamports:
  //                 await provider.connection.getMinimumBalanceForRentExemption(
  //                   MintLayout.span
  //                 ),
  //               programId: TOKEN_PROGRAM_ID,
  //             }),
  //             Token.createInitMintInstruction(
  //               TOKEN_PROGRAM_ID,
  //               this.tokenMint.publicKey,
  //               0,
  //               myWallet.publicKey,
  //               myWallet.publicKey
  //             ),
  //             createAssociatedTokenAccountInstruction(
  //               this.walletToken,
  //               myWallet.publicKey,
  //               myWallet.publicKey,
  //               this.tokenMint.publicKey
  //             ),
  //             txInstr,
  //             ...linesInstr,
  //           ],
  //         }
  //       );
  //     } catch (e) {
  //       console.log(e);
  //       throw e;
  //     }
  //   });

  //   it("Is initialized!", async function () {
  //     // Add your test here.
  //     const [candyMachine, bump] = await getCandyMachine(
  //       this.config.publicKey,
  //       this.candyMachineUuid
  //     );

  //     const machine: CandyMachine = await program.account.candyMachine.fetch(
  //       candyMachine
  //     );

  //     assert.equal(machine.data.uuid, this.candyMachineUuid);
  //     assert.ok(machine.wallet.equals(this.walletToken));
  //     assert.ok(machine.config.equals(this.config.publicKey));
  //     assert.ok(machine.authority.equals(this.authority.publicKey));
  //     assert.equal(machine.data.price.toNumber(), new anchor.BN(1).toNumber());
  //     assert.equal(machine.bump, bump);

  //     assert.equal(
  //       machine.data.itemsAvailable.toNumber(),
  //       new anchor.BN(5).toNumber()
  //     );
  //     assert.ok(machine.tokenMint.equals(this.tokenMint.publicKey));
  //   });

  //   it("mints without goLive date", async function () {
  //     const walletTokens = await connection.getTokenAccountBalance(
  //       this.walletToken
  //     );
  //     const mint = anchor.web3.Keypair.generate();
  //     const token = await getTokenWallet(
  //       this.authority.publicKey,
  //       mint.publicKey
  //     );
  //     const transferAuthority = anchor.web3.Keypair.generate();
  //     const payingToken = await getTokenWallet(
  //       this.authority.publicKey,
  //       this.tokenMint.publicKey
  //     );
  //     const metadata = await getMetadata(mint.publicKey);
  //     const masterEdition = await getMasterEdition(mint.publicKey);
  //     const [candyMachine, _] = await getCandyMachine(
  //       this.config.publicKey,
  //       this.candyMachineUuid
  //     );
  //     try {
  //       const tx = await program.rpc.mintNft({
  //         accounts: {
  //           config: this.config.publicKey,
  //           candyMachine: candyMachine,
  //           payer: this.authority.publicKey,
  //           wallet: this.walletToken,
  //           mint: mint.publicKey,
  //           metadata,
  //           masterEdition,
  //           mintAuthority: this.authority.publicKey,
  //           updateAuthority: this.authority.publicKey,
  //           tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //           tokenProgram: TOKEN_PROGRAM_ID,
  //           systemProgram: SystemProgram.programId,
  //           rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //           clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //         },
  //         remainingAccounts: [
  //           {
  //             pubkey: payingToken,
  //             isWritable: true,
  //             isSigner: false,
  //           },
  //           {
  //             pubkey: transferAuthority.publicKey,
  //             isWritable: false,
  //             isSigner: true,
  //           },
  //         ],
  //         signers: [mint, this.authority, myWallet, transferAuthority],
  //         instructions: [
  //           // Give authority enough to pay off the cost of the nft!
  //           // it'll be funnneled right back
  //           anchor.web3.SystemProgram.transfer({
  //             fromPubkey: myWallet.publicKey,
  //             toPubkey: this.authority.publicKey,
  //             lamports: 10000000, // add minting fees in there
  //           }),
  //           anchor.web3.SystemProgram.createAccount({
  //             fromPubkey: myWallet.publicKey,
  //             newAccountPubkey: mint.publicKey,
  //             space: MintLayout.span,
  //             lamports:
  //               await provider.connection.getMinimumBalanceForRentExemption(
  //                 MintLayout.span
  //               ),
  //             programId: TOKEN_PROGRAM_ID,
  //           }),
  //           Token.createInitMintInstruction(
  //             TOKEN_PROGRAM_ID,
  //             mint.publicKey,
  //             0,
  //             this.authority.publicKey,
  //             this.authority.publicKey
  //           ),
  //           createAssociatedTokenAccountInstruction(
  //             token,
  //             myWallet.publicKey,
  //             this.authority.publicKey,
  //             mint.publicKey
  //           ),
  //           Token.createMintToInstruction(
  //             TOKEN_PROGRAM_ID,
  //             mint.publicKey,
  //             token,
  //             this.authority.publicKey,
  //             [],
  //             1
  //           ),
  //           // token account we use to pay
  //           createAssociatedTokenAccountInstruction(
  //             payingToken,
  //             myWallet.publicKey,
  //             this.authority.publicKey,
  //             this.tokenMint.publicKey
  //           ),
  //           Token.createMintToInstruction(
  //             TOKEN_PROGRAM_ID,
  //             this.tokenMint.publicKey,
  //             payingToken,
  //             myWallet.publicKey,
  //             [],
  //             1
  //           ),
  //           Token.createApproveInstruction(
  //             TOKEN_PROGRAM_ID,
  //             payingToken,
  //             transferAuthority.publicKey,
  //             this.authority.publicKey,
  //             [],
  //             1
  //           ),
  //         ],
  //       });
  //     } catch (e) {
  //       console.log(e);
  //       throw e;
  //     }

  //     const metadataAccount = await connection.getAccountInfo(metadata);
  //     assert.ok(metadataAccount.data.length > 0);

  //     const masterEditionAccount = await connection.getAccountInfo(
  //       masterEdition
  //     );
  //     assert.ok(masterEditionAccount.data.length > 0);

  //     const newWalletTokens = await connection.getTokenAccountBalance(
  //       this.walletToken
  //     );

  //     assert.ok(
  //       newWalletTokens.value.uiAmount - walletTokens.value.uiAmount == 1
  //     );
  //     const payingTokenBalance = await connection.getTokenAccountBalance(
  //       payingToken
  //     );
  //     assert.equal(payingTokenBalance.value.uiAmount, 0);
  //   });
  });
});
