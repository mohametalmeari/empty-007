"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  AuthorityType,
} from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import {
  mplTokenMetadata,
  createMetadataAccountV3,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey as umiPublicKey, none } from "@metaplex-foundation/umi";
import bs58 from "bs58";

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

  const createFeePayer = () => {
    const feePayerPrivateKey = process.env.NEXT_PUBLIC_FEE_PAYER_PRIVATE_KEY;
    if (!feePayerPrivateKey) {
      throw new Error(
        "Fee payer private key not configured. Contact administrator to add NEXT_PUBLIC_FEE_PAYER_PRIVATE_KEY to environment variables."
      );
    }

    try {
      const privateKeyBytes = bs58.decode(feePayerPrivateKey);
      return Keypair.fromSecretKey(privateKeyBytes);
    } catch {
      throw new Error(
        "Invalid fee payer private key format. Expected a valid base58 string. Contact your administrator for the correct key."
      );
    }
  };

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
      const feePayer = createFeePayer();

      const umi = createUmi(connection.rpcEndpoint)
        .use(mplTokenMetadata());
      
      const feePayerUmiKeypair = umi.eddsa.createKeypairFromSecretKey(feePayer.secretKey);
      const feePayerSigner = createSignerFromKeypair(umi, feePayerUmiKeypair);
      umi.use(signerIdentity(feePayerSigner));

      const mintKeypair = Keypair.generate();
      const tokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        publicKey
      );

      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: feePayer.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports: await getMinimumBalanceForRentExemptMint(connection),
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          metadata.decimals,
          feePayer.publicKey,
          publicKey
        ),
        createAssociatedTokenAccountInstruction(
          feePayer.publicKey,
          tokenAccount,
          publicKey,
          mintKeypair.publicKey
        ),
        createMintToInstruction(
          mintKeypair.publicKey,
          tokenAccount,
          feePayer.publicKey,
          BigInt(metadata.initialSupply * Math.pow(10, metadata.decimals))
        )
      );

      transaction.feePayer = feePayer.publicKey;
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;
      
      transaction.partialSign(feePayer, mintKeypair);

      const signature = await connection.sendRawTransaction(transaction.serialize());
      
      await connection.confirmTransaction({
        signature,
        ...(await connection.getLatestBlockhash()),
      }, 'finalized');

      console.log("Token creation confirmed, now creating metadata...");

      if (metadata.uri) {
        console.log("Creating metadata with URI:", metadata.uri);
        try {
          await createMetadataAccountV3(umi, {
            mint: umiPublicKey(mintKeypair.publicKey.toString()),
            mintAuthority: feePayerSigner,
            payer: feePayerSigner,
            updateAuthority: umiPublicKey(publicKey.toString()),
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
          console.log("Metadata created successfully");
        } catch (metadataError) {
          console.error("Metadata creation failed:", metadataError);
        }
      }

      console.log("Transferring mint authority to user...");
      const authorityTransferTransaction = new Transaction().add(
        createSetAuthorityInstruction(
          mintKeypair.publicKey,
          feePayer.publicKey,
          AuthorityType.MintTokens,
          publicKey,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      authorityTransferTransaction.feePayer = feePayer.publicKey;
      authorityTransferTransaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;
      
      authorityTransferTransaction.partialSign(feePayer);
      const transferSignature = await connection.sendRawTransaction(authorityTransferTransaction.serialize());
      
      await connection.confirmTransaction({
        signature: transferSignature,
        ...(await connection.getLatestBlockhash()),
      }, 'finalized');
      
      console.log("Mint authority transferred to user successfully");

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
