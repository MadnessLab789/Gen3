import { ArrowDown, ArrowUp, DollarSign, Wallet } from 'lucide-react';
import { Header } from './Header';

export default function WalletScreen(props: {
  balance: number;
  onBalanceClick: () => void;
  showAlert: (message: string) => void;
  hideBalance?: boolean;
}) {
  const { balance, onBalanceClick, showAlert, hideBalance = false } = props;

  return (
    <div className="pb-[96px] px-4 pt-6 max-w-md mx-auto relative">
      <Header onBalanceClick={onBalanceClick} hideBalance={hideBalance} />

      <div className="flex items-center gap-2 mb-3 text-neon-gold text-xs font-bold tracking-widest uppercase">
        <Wallet size={12} />
        Wallet
      </div>

      <div className="bg-black/40 rounded-xl p-6 border border-neon-gold/20 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <DollarSign className="w-4 h-4" />
          <span>Total Balance</span>
        </div>
        <div className="text-4xl font-black text-neon-gold font-mono mb-6">
          <span className="font-data">
            {hideBalance
              ? '******'
              : `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => showAlert('Deposit coming soon!')}
            className="py-3 px-4 bg-neon-green/20 border border-neon-green/50 text-neon-green font-bold rounded-lg hover:bg-neon-green/30 transition-all flex items-center justify-center gap-2"
          >
            <ArrowDown className="w-4 h-4" />
            Deposit
          </button>
          <button
            onClick={() => showAlert('Withdraw coming soon!')}
            className="py-3 px-4 bg-transparent border-2 border-white/20 text-white font-bold rounded-lg hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
          >
            <ArrowUp className="w-4 h-4" />
            Withdraw
          </button>
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-md border border-white/10 rounded-xl p-4">
        <div className="text-xs text-gray-400 font-mono mb-2">HISTORY</div>
        <div className="text-sm text-gray-300">
          Bet history will appear here. (Currently mocked inside `WalletModal`.)
        </div>
      </div>
    </div>
  );
}


