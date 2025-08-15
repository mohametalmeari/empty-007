"use server";

import bs58 from "bs58";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  Connection,
} from "@solana/web3.js";
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
import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import {
  mplTokenMetadata,
  createMetadataAccountV3,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey as umiPublicKey, none } from "@metaplex-foundation/umi";
import { TokenMetadata } from "@/hooks/use-token-creation";
import { FEE_IN_SOL } from "@/lib/solana-utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const validateFeePayment = async (
  connection: Connection,
  feeSignature: string,
  expectedSenderPublicKey: string
) => {
  const feeTransaction = await connection.getTransaction(feeSignature);
  if (!feeTransaction) {
    throw new Error("Fee transaction not found");
  }

  const feeReceiverPublicKey = process.env.NEXT_PUBLIC_FEE_RECEIVER_PUBLIC_KEY;
  if (!feeReceiverPublicKey) {
    throw new Error("Fee receiver public key not configured");
  }

  if (!feeTransaction.meta || feeTransaction.meta.err) {
    throw new Error("Fee transaction failed");
  }

  if (!feeTransaction.blockTime) {
    throw new Error("Transaction timestamp not available");
  }

  const transactionTime = feeTransaction.blockTime;
  const currentTime = Math.floor(Date.now() / 1000);
  const tenMinutesInSeconds = 10 * 60;

  if (currentTime - transactionTime > tenMinutesInSeconds) {
    throw new Error("Fee payment expired. Please make a new payment.");
  }

  const preBalances = feeTransaction.meta.preBalances;
  const postBalances = feeTransaction.meta.postBalances;
  const accountKeys = feeTransaction.transaction.message.accountKeys;

  const receiverIndex = accountKeys.findIndex(
    (key) => key.toString() === feeReceiverPublicKey
  );

  if (receiverIndex === -1) {
    throw new Error("Invalid fee receiver");
  }

  const senderIndex = accountKeys.findIndex(
    (key) => key.toString() === expectedSenderPublicKey
  );

  if (senderIndex === -1) {
    throw new Error("Fee was not paid by the token creator");
  }

  const amountReceived =
    postBalances[receiverIndex] - preBalances[receiverIndex];
  const requiredAmount = FEE_IN_SOL * LAMPORTS_PER_SOL;

  if (amountReceived < requiredAmount) {
    throw new Error(
      `Insufficient fee payment. Required: ${FEE_IN_SOL} SOL, Received: ${
        amountReceived / LAMPORTS_PER_SOL
      } SOL`
    );
  }
};

const createFeePayer = async () => {
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

export const mintNewToken = async ({
  userPublicKeyStr,
  metadata,
  feeSignature,
}: {
  userPublicKeyStr: string;
  metadata: TokenMetadata;
  feeSignature: string;
}) => {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    await validateFeePayment(connection, feeSignature, userPublicKeyStr);

    const feePayer = await createFeePayer();

    const userPublicKey = new PublicKey(userPublicKeyStr);

    const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata());

    const feePayerUmiKeypair = umi.eddsa.createKeypairFromSecretKey(
      feePayer.secretKey
    );
    const feePayerSigner = createSignerFromKeypair(umi, feePayerUmiKeypair);
    umi.use(signerIdentity(feePayerSigner));

    const mintKeypair = Keypair.generate();
    const tokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      userPublicKey
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
        userPublicKey
      ),
      createAssociatedTokenAccountInstruction(
        feePayer.publicKey,
        tokenAccount,
        userPublicKey,
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

    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );

    await connection.confirmTransaction(
      {
        signature,
        ...(await connection.getLatestBlockhash()),
      },
      "finalized"
    );

    if (metadata.uri) {
      try {
        await createMetadataAccountV3(umi, {
          mint: umiPublicKey(mintKeypair.publicKey.toString()),
          mintAuthority: feePayerSigner,
          payer: feePayerSigner,
          updateAuthority: umiPublicKey(userPublicKey.toString()),
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
      } catch (metadataError) {
        console.error("Metadata creation failed:", metadataError);
      }
    }

    const authorityTransferTransaction = new Transaction().add(
      createSetAuthorityInstruction(
        mintKeypair.publicKey,
        feePayer.publicKey,
        AuthorityType.MintTokens,
        userPublicKey,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    authorityTransferTransaction.feePayer = feePayer.publicKey;
    authorityTransferTransaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    authorityTransferTransaction.partialSign(feePayer);
    const transferSignature = await connection.sendRawTransaction(
      authorityTransferTransaction.serialize()
    );

    await connection.confirmTransaction(
      {
        signature: transferSignature,
        ...(await connection.getLatestBlockhash()),
      },
      "finalized"
    );

    const token = {
      mintAddress: mintKeypair.publicKey.toString(),
      accountAddress: tokenAccount.toString(),
      signature,
    };

    if (!token) {
      throw new Error("Token minting failed");
    }

    return token;
  } catch (error) {
    console.error("Failed to mint token:", error);
    throw error;
  }
};
