import { useEffect, useState } from 'react';
import { 
  ArrowDown, 
  ArrowUp, 
  DollarSign, 
  Wallet, 
  Copy, 
  History, 
  CreditCard, 
  MessageSquare,
  Zap,
  X as XIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './Header';
import { supabase } from '../supabaseClient';
import WebApp from '@twa-dev/sdk';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'reward' | 'recharge';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

interface BetRecord {
  id: string;
  match: string;
  type: string;
  status: 'won' | 'lost' | 'pending';
  odds: number;
  stake: number;
  created_at: string;
}

export default function WalletScreen(props: {
  balance: number;
  onBalanceClick: () => void;
  showAlert: (message: string) => void;
  hideBalance?: boolean;
  telegramId?: number;
  supabaseUserUuid?: string;
}) {
  const { balance: initialBalance, onBalanceClick, showAlert, hideBalance = false, telegramId, supabaseUserUuid } = props;

  const [activeTab, setActiveTab] = useState<'transactions' | 'betting'>('transactions');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Detailed financial data
  const [financials, setFinancials] = useState({
    balance: initialBalance,
    bonus: 0,
    available: initialBalance,
    inPlay: 0,
    totalPL: 0,
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [_bets, _setBets] = useState<BetRecord[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    if (!telegramId) return;

    const fetchData = async () => {
      setLoading(true);
      const sb = supabase;
      if (!sb) return;

      try {
        // 1. Fetch user financial details
        const { data: userData } = await sb
          .from('users')
          .select('balance, bonus, vip_end_time')
          .eq('telegram_id', telegramId)
          .maybeSingle();

        if (userData) {
          setFinancials(prev => ({
            ...prev,
            balance: Number(userData.balance ?? 0),
            bonus: Number(userData.bonus ?? 0),
            available: Number(userData.balance ?? 0),
          }));
        }

        // 2. Fetch transactions
        const { data: txData } = await sb
          .from('oddsflow_radar_transactions')
          .select('*')
          .eq('telegram_id', telegramId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (txData) {
          setTransactions(txData.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: Number(tx.amount || 0),
            status: tx.status,
            created_at: tx.created_at
          })));
        }
      } catch (err) {
        console.error('[Wallet] Data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const sb = supabase;
    if (!sb) return;

    // Set up realtime listener for transactions
    const transactionChannel = sb
      .channel(`wallet-updates-${telegramId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'oddsflow_radar_transactions', filter: `telegram_id=eq.${telegramId}` },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    // Set up realtime listener for balance/bonus changes in users table
    const userChannel = sb
      .channel(`user-balance-sync-${telegramId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users',
          filter: `telegram_id=eq.${telegramId}` 
        },
        (payload) => {
          if (payload.new) {
            setFinancials(prev => ({
              ...prev,
              balance: Number(payload.new.balance ?? 0),
              bonus: Number(payload.new.bonus ?? 0),
              available: Number(payload.new.balance ?? 0),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(transactionChannel);
      sb.removeChannel(userChannel);
    };
  }, [telegramId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showAlert('Address copied to clipboard!');
  };

  const handleConfirmTransfer = async () => {
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showAlert('Please enter a valid amount.');
      return;
    }

    if (!supabaseUserUuid) {
      showAlert('User ID not found. Please try again.');
      return;
    }

    setIsSubmitting(true);
    const sb = supabase;
    if (!sb) {
      showAlert('Supabase not initialized.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data, error } = await sb
        .from('oddsflow_radar_transactions')
        .insert({
          user_id: supabaseUserUuid,
          telegram_id: telegramId,
          amount: amountNum,
          status: 'pending',
          type: 'deposit',
          network: 'TRC20'
        })
        .select('id')
        .single();

      if (error) throw error;

      if (data?.id) {
        const url = `https://t.me/oddsflow_manager_bot?start=tx_${data.id}`;
        try {
          WebApp.openTelegramLink(url);
        } catch {
          window.open(url, '_blank');
        }
        setShowDeposit(false);
        setDepositAmount('');
      }
    } catch (err: any) {
      console.error('[Deposit] Error:', err);
      showAlert(`Failed to initiate deposit: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatValue = (val: number) => {
    if (hideBalance) return '***';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="pb-[96px] px-4 pt-6 max-w-md mx-auto relative font-sans">
      <Header onBalanceClick={onBalanceClick} hideBalance={hideBalance} />

      {/* Asset Center Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-widest text-gray-500 font-mono">
          <Wallet size={12} className="text-neon-gold" />
          Quant Trading Center
        </div>

        <div className="premium-card overflow-hidden">
          <div className="premium-card-content !p-6">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span>Total Assets</span>
            </div>
            
            <div className="text-4xl font-black text-neon-gold font-data mb-6 drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
              {hideBalance ? '******' : formatValue(financials.balance)}
            </div>

            <div className="grid grid-cols-3 gap-2 py-4 border-t border-white/5">
              <div className="text-center border-r border-white/5">
                <div className="text-[10px] text-gray-500 uppercase font-mono mb-1">Available</div>
                <div className="text-sm font-data font-bold text-white">
                  {formatValue(financials.available)}
                </div>
              </div>
              <div className="text-center border-r border-white/5">
                <div className="text-[10px] text-gray-500 uppercase font-mono mb-1">In-play</div>
                <div className="text-sm font-data font-bold text-white">
                  {formatValue(financials.inPlay)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase font-mono mb-1">Total P/L</div>
                <div className={`text-sm font-data font-bold flex items-center justify-center gap-1 ${financials.totalPL >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                  {financials.totalPL >= 0 ? '+' : ''}
                  {formatValue(financials.totalPL)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setShowDeposit(true)}
                className="py-3 px-4 bg-neon-gold text-black font-black rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs tracking-widest"
              >
                <ArrowDown className="w-4 h-4" />
                DEPOSIT
              </button>
              <button
                onClick={() => setShowWithdraw(true)}
                className="py-3 px-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs tracking-widest"
              >
                <ArrowUp className="w-4 h-4" />
                WITHDRAW
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Tabs Section */}
      <div className="space-y-4">
        <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition ${
              activeTab === 'transactions' ? 'bg-white/10 text-neon-gold shadow-inner' : 'text-gray-500'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('betting')}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition ${
              activeTab === 'betting' ? 'bg-white/10 text-neon-gold shadow-inner' : 'text-gray-500'
            }`}
          >
            Betting
          </button>
        </div>

        <div className="space-y-2">
          {activeTab === 'transactions' ? (
            transactions.length > 0 ? (
              transactions.map((tx) => (
                <div key={tx.id} className="premium-card group hover:border-white/10 transition">
                  <div className="premium-card-content !p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        tx.type === 'deposit' || tx.type === 'recharge' ? 'bg-neon-green/10 text-neon-green' : 
                        tx.type === 'withdraw' ? 'bg-neon-red/10 text-neon-red' : 'bg-neon-blue/10 text-neon-blue'
                      }`}>
                        {tx.type === 'deposit' || tx.type === 'recharge' ? <ArrowDown size={14} /> : 
                         tx.type === 'withdraw' ? <ArrowUp size={14} /> : <CreditCard size={14} />}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-white">
                          {tx.type.replace('_', ' ')}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {new Date(tx.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-data font-bold ${
                        tx.type === 'deposit' || tx.type === 'recharge' ? 'text-neon-green' : 'text-neon-red'
                      }`}>
                        {tx.type === 'deposit' || tx.type === 'recharge' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </div>
                      <div className={`text-[9px] uppercase font-mono ${
                        tx.status === 'completed' ? 'text-neon-green' : 
                        tx.status === 'pending' ? 'text-neon-gold animate-pulse' : 'text-neon-red'
                      }`}>
                        {tx.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 opacity-30">
                <History className="w-8 h-8 mx-auto mb-2" />
                <div className="text-xs font-mono uppercase tracking-widest">No transaction history</div>
              </div>
            )
          ) : (
            <div className="text-center py-10 opacity-30">
              <Zap className="w-8 h-8 mx-auto mb-2" />
              <div className="text-xs font-mono uppercase tracking-widest">No signal executions found</div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      <AnimatePresence>
        {showDeposit && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-8 sm:items-center sm:pb-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSubmitting) setShowDeposit(false);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-[#121212] border border-neon-gold/30 rounded-2xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-neon-gold/10 rounded-xl text-neon-gold">
                    <ArrowDown className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic">Deposit Assets</h3>
                    <p className="text-[10px] text-gray-500 font-mono tracking-widest">NETWORK: USDT-TRC20</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (!isSubmitting) setShowDeposit(false);
                  }} 
                  className="text-gray-500 hover:text-white transition"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block font-mono">Deposit Amount (USDT)</label>
                  <input 
                    type="number" 
                    placeholder="Enter amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-data text-white focus:outline-none focus:border-neon-gold/50 text-lg"
                  />
                </div>

                <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">USDT-TRC20 Wallet Address</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-sm font-data text-white truncate py-2 bg-black/20 rounded px-2">
                      TXZ7y8W2n5...qX8uH4JkL
                    </div>
                    <button 
                      onClick={() => handleCopy('TXZ7y8W2n5...qX8uH4JkL')}
                      className="p-2 bg-neon-gold/10 hover:bg-neon-gold/20 rounded-lg text-neon-gold transition active:scale-90"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-neon-gold/5 rounded-xl border border-neon-gold/10">
                  <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TXZ7y8W2n5...qX8uH4JkL" alt="QR" className="w-10 h-10" />
                  </div>
                  <div className="text-[10px] text-gray-400 leading-relaxed">
                    Scan the QR code to transfer. Always ensure you use the <span className="text-white">TRC20</span> network. BEP20 or ERC20 transfers will result in permanent loss.
                  </div>
                </div>

                <button 
                  onClick={handleConfirmTransfer}
                  disabled={isSubmitting || !depositAmount}
                  className="w-full py-4 bg-neon-gold text-black font-black uppercase tracking-widest rounded-xl hover:brightness-110 transition active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <MessageSquare size={18} />
                  )}
                  {isSubmitting ? 'Processing...' : 'Confirm Transfer via Bot'}
                </button>

                <p className="text-[9px] text-center text-gray-500 font-mono italic">
                  * Funds are credited after 12 network confirmations (approx. 5 mins).
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdraw && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-8 sm:items-center sm:pb-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWithdraw(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/5 rounded-xl text-white">
                    <ArrowUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic">Withdraw Assets</h3>
                    <p className="text-[10px] text-gray-500 font-mono tracking-wider uppercase">Available: {formatValue(financials.available)}</p>
                  </div>
                </div>
                <button onClick={() => setShowWithdraw(false)} className="text-gray-500 hover:text-white transition">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block font-mono">Withdraw Amount (USDT)</label>
                  <input 
                    type="number" 
                    placeholder="Minimum 20.00"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-data text-white focus:outline-none focus:border-neon-gold/50 text-lg"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block font-mono">TRC20 Receiver Address</label>
                  <input 
                    type="text" 
                    placeholder="T..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-data text-white focus:outline-none focus:border-neon-gold/50"
                  />
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500">Service Fee:</span>
                    <span className="text-white font-data">1.50 USDT</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500">Processing Time:</span>
                    <span className="text-white font-data">2 - 12 Hours</span>
                  </div>
                </div>

                <button 
                  onClick={() => showAlert('Withdrawal request submitted. We will notify you once processed.')}
                  className="w-full py-4 bg-white/10 border border-white/20 text-white font-black uppercase tracking-widest rounded-xl hover:bg-white/20 transition active:scale-[0.98] mt-2"
                >
                  Request Withdrawal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
