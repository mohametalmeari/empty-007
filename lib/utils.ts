import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PublicKey } from "@solana/web3.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatAddress = (address: PublicKey) => {
  const addressStr = address.toBase58();
  return `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;
};
