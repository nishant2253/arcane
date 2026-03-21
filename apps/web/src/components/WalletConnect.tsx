'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWalletStore } from '@/stores/walletStore'
import { connectWallet, disconnectWallet } from '@/lib/wallet'
import { Loader2 } from 'lucide-react'

export function WalletConnectButton() {
  const router = useRouter()
  const { isConnected, accountId, hbarBalance, walletName, setWallet, setBalance, disconnect } = useWalletStore()
  const [loading, setLoading] = useState(false)

  // Fetch balance automatically on mount or when account changes
  useEffect(() => {
    if (isConnected && accountId) {
      const fetchBal = async () => {
        try {
          const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet'
          const res = await fetch(`https://${network}.mirrornode.hedera.com/api/v1/accounts/${accountId}`)
          const data = await res.json()
          if (data?.balance?.balance !== undefined) {
             setBalance(data.balance.balance / 100_000_000)
          }
        } catch (e) {
          console.warn('Failed to fetch balance', e)
        }
      }
      fetchBal()
    }
  }, [isConnected, accountId, setBalance])

  async function handleConnect() {
    setLoading(true)
    try {
      const { accountId, evmAddress, walletName, connector } = await connectWallet()
      setWallet(accountId, evmAddress, walletName, connector)

      // Balance relies on the useEffect we just added to fetch globally
      // Redirect to the wallet dashboard automatically
      router.push('/wallet')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err?.message?.includes('User closed modal')) {
        console.log('Wallet connection cancelled by user')
      } else {
        console.error('Wallet connect failed:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    try {
      setLoading(true)
      await disconnectWallet()
      disconnect()
    } catch (err) {
      console.error('Wallet disconnect failed:', err)
    } finally {
      setLoading(false)
    }
  }

  if (isConnected && accountId) {
    const shortId = `${accountId.slice(0, 5)}...${accountId.slice(-3)}`
    return (
      <div className="flex items-center gap-3">
        {walletName && (
          <span className="hidden lg:inline-flex text-xs text-[#00A9BA] font-mono bg-[#0D2137] px-2 py-1 rounded">
            {walletName}
          </span>
        )}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'rgba(0,169,186,0.1)', border: '1px solid rgba(0,169,186,0.25)' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
          <span style={{ color: '#00A9BA', fontFamily: 'monospace' }}>{shortId}</span>
          <span style={{ color: '#64748B' }}>·</span>
          <span style={{ color: '#E2E8F0' }}>{hbarBalance.toFixed(1)} ℏ</span>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:text-red-400 hover:border-red-500/50"
          style={{ color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 bg-[#00A9BA] hover:bg-[#007A8A] text-white flex items-center justify-center ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
      style={{ boxShadow: '0 0 20px rgba(0,169,186,0.3)' }}
    >
      {loading ? (
        <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Connecting...</>
      ) : (
        'Connect Wallet'
      )}
    </button>
  )
}
