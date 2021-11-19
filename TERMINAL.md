### Deploy custom candy machine

```sh
$ cd rust/nft-candy-machine/

$ anchor build

$ solana config get
Config File: /home/nam/.config/solana/cli/config.yml
RPC URL: https://api.devnet.solana.com 
WebSocket URL: wss://api.devnet.solana.com/ (computed)
Keypair Path: /home/nam/.config/solana/id.json 
Commitment: confirmed

$ solana balance
2.577134563 SOL

$ anchor deploy --provider.cluster http://api.devnet.solana.com/
Deploying workspace: http://api.devnet.solana.com
Upgrade authority: /home/nam/.config/solana/id.json
Deploying program "nft-candy-machine"...
Program path: /home/nam/workspace/starbots/metaplex/rust/target/deploy/nft_candy_machine.so...
Program Id: FbSXHVaDjJwGAmbyrnz2LDb5fR4825mND9CbCeEaJe8Q

$ anchor idl init -f /home/nam/workspace/starbots/metaplex/rust/target/idl/nft_candy_machine.json FbSXHVaDjJwGAmbyrnz2LDb5fR4825mND9CbCeEaJe8Q

Idl account created: 3r4JEN7KztxAtzfQxEfZfCSQCVsXfs5Sv4KBtmov7yZp
```

**Update Program ID**

```sh
$ anchor build

$ anchor upgrade /home/nam/workspace/starbots/metaplex/rust/target/deploy/nft_candy_machine.so --program-id FbSXHVaDjJwGAmbyrnz2LDb5fR4825mND9CbCeEaJe8Q

$ anchor idl upgrade -f /home/nam/workspace/starbots/metaplex/rust/target/idl/nft_candy_machine.json FbSXHVaDjJwGAmbyrnz2LDb5fR4825mND9CbCeEaJe8Q
```

### Upload NFT

### Logs

$ ts-node js/packages/cli/src/candy-machine-cli.ts upload js/asset_NFT_2/ --keypair /home/nam/.config/solana/id.json

$ ts-node js/packages/cli/src/candy-machine-cli.ts verify --keypair /home/nam/.config/solana/id.json

$ ts-node js/packages/cli/src/candy-machine-cli.ts create_candy_machine --keypair /home/nam/.config/solana/id.json

$ ts-node js/packages/cli/src/candy-machine-cli.ts mint_one_token --keypair /home/nam/.config/solana/id.json
