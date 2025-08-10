import WalletInfo from "@/components/solana/wallet-info";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 dark:from-gray-950 dark:via-purple-950 dark:to-slate-950 px-4 py-8 sm:py-16">
      <WalletInfo />
    </div>
  );
}
