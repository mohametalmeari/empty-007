"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  mplTokenMetadata,
  createMetadataAccountV3,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey as umiPublicKey, none } from "@metaplex-foundation/umi";

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  uri?: string;
}

export interface TokenCreationResult {
  mintAddress: string;
  tokenAccountAddress: string;
  signature: string;
}

export function useTokenCreation() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createToken = async (
    metadata: TokenMetadata
  ): Promise<TokenCreationResult | null> => {
    if (!publicKey || !sendTransaction || !wallet.wallet) {
      setError("Wallet not connected");
      return null;
    }

    setIsCreating(true);
    setError(null);

    try {
      const umi = createUmi(connection.rpcEndpoint)
        .use(mplTokenMetadata())
        .use(walletAdapterIdentity(wallet));

      const mintKeypair = Keypair.generate();
      const tokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        publicKey
      );

      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports: await getMinimumBalanceForRentExemptMint(connection),
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          metadata.decimals,
          publicKey,
          publicKey
        ),
        createAssociatedTokenAccountInstruction(
          publicKey,
          tokenAccount,
          publicKey,
          mintKeypair.publicKey
        ),
        createMintToInstruction(
          mintKeypair.publicKey,
          tokenAccount,
          publicKey,
          BigInt(metadata.initialSupply * Math.pow(10, metadata.decimals))
        )
      );

      transaction.feePayer = publicKey;
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;
      transaction.partialSign(mintKeypair);

      const signature = await sendTransaction(transaction, connection);

      try {
        if (metadata.uri) {
          await createMetadataAccountV3(umi, {
            mint: umiPublicKey(mintKeypair.publicKey.toString()),
            mintAuthority: umi.identity,
            payer: umi.identity,
            updateAuthority: umi.identity.publicKey,
            data: {
              name: metadata.name,
              symbol: metadata.symbol,
              uri: metadata.uri,
              sellerFeeBasisPoints: 0,
              creators: none(),
              collection: none(),
              uses: none(),
            },
            isMutable: true,
            collectionDetails: none(),
          }).sendAndConfirm(umi);
        }
      } catch {}

      return {
        mintAddress: mintKeypair.publicKey.toString(),
        tokenAccountAddress: tokenAccount.toString(),
        signature,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const clearError = () => setError(null);

  return {
    createToken,
    isCreating,
    error,
    clearError,
  };
}
