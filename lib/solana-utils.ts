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
