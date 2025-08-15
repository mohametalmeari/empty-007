"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createFeeReceiver, FEE_IN_SOL } from "@/lib/solana-utils";
import { mintNewToken } from "@/server";

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
  feeSignature: string;
}

export function useTokenCreation() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey: userPublicKey, sendTransaction } = wallet;
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createToken = async (
    metadata: TokenMetadata
  ): Promise<TokenCreationResult | null> => {
    if (!userPublicKey || !sendTransaction || !wallet.wallet) {
      setError("Wallet not connected");
      return null;
    }

    setIsCreating(true);
    setError(null);

    try {
      const feeAmount = FEE_IN_SOL * LAMPORTS_PER_SOL;
      const feeReceiver = createFeeReceiver();

      const userBalance = await connection.getBalance(userPublicKey);
      if (userBalance < feeAmount) {
        throw new Error(
          `Insufficient balance. You need at least 0.1 SOL but have ${(
            userBalance / LAMPORTS_PER_SOL
          ).toFixed(4)} SOL`
        );
      }

      const feeTransaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: userPublicKey,
          toPubkey: feeReceiver.publicKey,
          lamports: feeAmount,
        })
      );

      feeTransaction.feePayer = userPublicKey;
      feeTransaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      const feeSignature = await sendTransaction(feeTransaction, connection, {
        skipPreflight: false,
        preflightCommitment: "processed",
      });

      await connection.confirmTransaction(
        {
          signature: feeSignature,
          ...(await connection.getLatestBlockhash()),
        },
        "finalized"
      );

      const token = await mintNewToken({
        userPublicKeyStr: userPublicKey.toString(),
        metadata,
        feeSignature,
      });

      return {
        mintAddress: token.mintAddress,
        tokenAccountAddress: token.accountAddress,
        signature: token.signature,
        feeSignature,
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
