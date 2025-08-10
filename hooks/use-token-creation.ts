"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction,
} from "@solana/spl-token";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { useState } from "react";

interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
}

interface TokenCreationResult {
  mintAddress: string;
  tokenAccountAddress: string;
  signature: string;
}

export function useTokenCreation() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createToken = async (
    metadata: TokenMetadata
  ): Promise<TokenCreationResult | null> => {
    if (!publicKey || !sendTransaction) {
      setError("Wallet not connected or does not support signing");
      return null;
    }

    setIsCreating(true);
    setError(null);

    try {
      const mintKeypair = Keypair.generate();
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      console.log(":::::>>", { mintKeypair, lamports });

      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey
      );

      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
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
          associatedTokenAddress,
          publicKey,
          mintKeypair.publicKey
        ),
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAddress,
          publicKey,
          BigInt(metadata.initialSupply * Math.pow(10, metadata.decimals))
        )
      );

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      transaction.feePayer = publicKey;
      transaction.recentBlockhash = blockhash;
      transaction.partialSign(mintKeypair);

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      return {
        mintAddress: mintKeypair.publicKey.toString(),
        tokenAccountAddress: associatedTokenAddress.toString(),
        signature: signature,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to create token: ${errorMessage}`);
      console.error("Token creation error:", err);
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createToken,
    isCreating,
    error,
    clearError: () => setError(null),
  };
}
