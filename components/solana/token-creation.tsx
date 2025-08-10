"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTokenCreation } from "@/hooks/use-token-creation";
import { getSolanaExplorerUrl } from "@/lib/solana-utils";

export default function TokenCreation() {
  const { connected } = useWallet();
  const { createToken, isCreating, error, clearError } = useTokenCreation();

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    decimals: 9,
    initialSupply: 1000000,
  });

  const [result, setResult] = useState<{
    mintAddress: string;
    tokenAccountAddress: string;
    signature: string;
  } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "decimals" || name === "initialSupply"
          ? parseInt(value) || 0
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setResult(null);

    if (!formData.name || !formData.symbol) {
      return;
    }

    const tokenResult = await createToken(formData);
    if (tokenResult) {
      setResult(tokenResult);
      setFormData({
        name: "",
        symbol: "",
        decimals: 9,
        initialSupply: 1000000,
      });
    }
  };

  if (!connected) return;

  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Token Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="My Token"
            required
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Token Symbol
          </label>
          <input
            type="text"
            name="symbol"
            value={formData.symbol}
            onChange={handleInputChange}
            placeholder="MTK"
            required
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Decimals
          </label>
          <input
            type="number"
            name="decimals"
            value={formData.decimals}
            onChange={handleInputChange}
            min="0"
            max="18"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Initial Supply
          </label>
          <input
            type="number"
            name="initialSupply"
            value={formData.initialSupply}
            onChange={handleInputChange}
            min="1"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={isCreating || !formData.name || !formData.symbol}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
            </div>
          ) : (
            "Create Token"
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="text-red-600 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <h3 className="text-green-800 dark:text-green-400 font-semibold mb-3">
            Token Created Successfully!
          </h3>
          <a
            href={getSolanaExplorerUrl(result.mintAddress, "address", "devnet")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-200 whitespace-nowrap"
          >
            View Token
          </a>
        </div>
      )}
    </div>
  );
}
