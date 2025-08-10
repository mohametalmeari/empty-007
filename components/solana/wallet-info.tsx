"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useState } from "react";

import { useWalletDropdownFix } from "@/hooks/use-wallet-dropdown-fix";

export default function WalletInfo() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useWalletDropdownFix();

  useEffect(() => {
    if (!connection || !publicKey) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        setLoading(true);
        const walletBalance = await connection.getBalance(publicKey);
        setBalance(walletBalance / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setBalance(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();

    const interval = setInterval(fetchBalance, 10000);

    return () => clearInterval(interval);
  }, [connection, publicKey]);

  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-900 dark:to-purple-950 border border-purple-200 dark:border-purple-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center space-y-6">
      <WalletMultiButton className="mx-auto !w-full !bg-gradient-to-r !from-purple-600 !to-indigo-600 hover:!from-purple-700 hover:!to-indigo-700 !border-none !rounded-xl !h-12 !text-white !font-semibold !transition-all !duration-300 !shadow-lg hover:!shadow-xl" />

      {connected && publicKey && (
        <div className="w-full bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 flex justify-center">
          {loading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
          ) : balance !== null ? (
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {balance.toFixed(4)}
              <span className="text-lg font-medium text-purple-600 ml-2">
                SOL
              </span>
            </div>
          ) : (
            <div className="text-red-500 text-sm font-medium">
              Failed to load balance
            </div>
          )}
        </div>
      )}
    </div>
  );
}
