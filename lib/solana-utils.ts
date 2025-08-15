import { PublicKey } from "@solana/web3.js";

export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";

export const getSolanaExplorerUrl = (
  address: string,
  type: "address" | "tx" | "block" = "address",
  cluster: SolanaCluster = "devnet"
): string => {
  const baseUrl = "https://explorer.solana.com";
  const clusterParam = cluster !== "mainnet-beta" ? `?cluster=${cluster}` : "";

  return `${baseUrl}/${type}/${address}${clusterParam}`;
};

export const openInExplorer = (
  address: string,
  type: "address" | "tx" | "block" = "address",
  cluster: SolanaCluster = "devnet"
): void => {
  const url = getSolanaExplorerUrl(address, type, cluster);
  window.open(url, "_blank", "noopener,noreferrer");
};

export const truncateAddress = (address: string, chars: number = 4): string => {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export const createFeeReceiver = () => {
  const feeReceiverPublicKey = process.env.NEXT_PUBLIC_FEE_RECEIVER_PUBLIC_KEY;
  if (!feeReceiverPublicKey) {
    throw new Error(
      "Fee receiver public key not configured. Contact administrator to add NEXT_PUBLIC_FEE_RECEIVER_PUBLIC_KEY to environment variables."
    );
  }

  return { publicKey: new PublicKey(feeReceiverPublicKey) };
};

export const FEE_IN_SOL = (() => {
  const feeInSol = process.env.NEXT_PUBLIC_FEE_AMOUNT;
  if (isNaN(Number(feeInSol)) || Number(feeInSol) <= 0) {
    return 0.099;
  }
  return Number(feeInSol);
})();
