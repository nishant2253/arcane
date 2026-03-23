'use client'
import {
  DAppConnector,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  HederaChainId,
} from '@hashgraph/hedera-wallet-connect'
import { LedgerId } from '@hashgraph/sdk'

let dAppConnector: DAppConnector | null = null

// Initialize once — kept alive across connect/disconnect cycles to avoid
// "WalletConnect Core is already initialized" double-init warnings.
export async function initWalletConnector() {
  if (dAppConnector) return dAppConnector

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  if (!projectId) {
    console.error('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
    throw new Error('WalletConnect Project ID not configured')
  }

  dAppConnector = new DAppConnector(
    {
      name: 'Arcane',
      description: 'AI-Powered Trading Agent Platform on Hedera',
      url: typeof window !== 'undefined' ? window.location.origin : '',
      icons: [`${typeof window !== 'undefined' ? window.location.origin : ''}/arcane-logo.png`],
    },
    LedgerId.TESTNET,
    projectId,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.Testnet]
  )

  await dAppConnector.init({ logger: 'fatal' })
  return dAppConnector
}

// Resolve a signer for a given accountId, retrying up to `maxAttempts` times
// because DAppConnector populates signers asynchronously after session events.
async function waitForSigner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connector: DAppConnector, accountId: string, maxAttempts = 10
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  for (let i = 0; i < maxAttempts; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signer = connector.signers.find((s: any) => s.getAccountId().toString() === accountId)
    if (signer) return signer
    await new Promise(r => setTimeout(r, 300))
  }
  return null
}

export interface ConnectWalletResult {
  accountId: string;
  evmAddress: string;
  walletName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connector: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any;
}

// Silently restore an existing WalletConnect session — never opens a modal.
// Returns null if no valid session or signer can be found.
export async function rehydrateWallet(): Promise<ConnectWalletResult | null> {
  try {
    const connector = await initWalletConnector()
    const existingSessions = connector.walletConnectClient?.session.getAll()
    if (!existingSessions?.length) return null

    const session = existingSessions[0]
    const accountId = session.namespaces.hedera?.accounts[0]?.split(':')[2]
    if (!accountId) return null

    const signer = await waitForSigner(connector, accountId)
    if (!signer) return null

    return {
      accountId,
      evmAddress: accountIdToEvmAddress(accountId),
      walletName: session.peer.metadata.name || 'WalletConnect',
      connector,
      session,
      signer,
    }
  } catch {
    return null
  }
}

// Open the wallet selection modal for a brand-new connection.
export async function connectWallet(): Promise<ConnectWalletResult> {
  const connector = await initWalletConnector()

  // 1. Silently reuse an existing session if one is available
  const existing = await rehydrateWallet()
  if (existing) return existing

  // 2. No existing session — open the WalletConnect modal
  return new Promise<ConnectWalletResult>(async (resolve, reject) => {
    let checkInterval: NodeJS.Timeout
    let isResolving = false

    const checkSession = async (isFinalCheck = false) => {
      if (isResolving) return

      const sessions = connector.walletConnectClient?.session.getAll()
      if (!sessions?.length) {
        if (isFinalCheck) reject(new Error('No wallet session established. User closed modal.'))
        return
      }

      const session = sessions[0]
      const accountId = session.namespaces.hedera?.accounts[0]?.split(':')[2]
      if (!accountId) {
        reject(new Error('No Hedera account in session'))
        return
      }

      // Signers may not be ready yet — wait instead of immediately rejecting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let signer = connector.signers.find((s: any) => s.getAccountId().toString() === accountId)
      if (!signer && isFinalCheck) {
        // Give up to 3s on the final check for signers to populate
        signer = await waitForSigner(connector, accountId)
      }

      if (!signer) {
        // Not ready on intermediate poll — next tick will retry
        return
      }

      isResolving = true
      clearInterval(checkInterval)
      resolve({
        accountId,
        evmAddress: accountIdToEvmAddress(accountId),
        walletName: session.peer.metadata.name || 'WalletConnect',
        connector,
        session,
        signer,
      })
    }

    // Subscribe to modal close to trigger a final check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = connector.walletConnectModal.subscribeModal((state: any) => {
      if (!state.open && !isResolving) {
        clearInterval(checkInterval)
        unsubscribe()
        // Give the SDK 800ms to settle after modal close, then do final check
        setTimeout(() => checkSession(true), 800)
      }
    })

    // Poll while modal is open
    checkInterval = setInterval(() => checkSession(false), 500)

    try {
      await connector.openModal()
    } catch (err) {
      clearInterval(checkInterval)
      unsubscribe()
      reject(err)
    }
  })
}

export async function disconnectWallet() {
  if (!dAppConnector) return
  try {
    await dAppConnector.disconnectAll()
  } catch { /* best-effort */ }
  // Intentionally keep dAppConnector alive — nulling it causes "WalletConnect Core is
  // already initialized" warning on the next init() call because the WC Core singleton
  // persists in localStorage even after disconnectAll().
}

// Convert Hedera account ID to EVM address for contract calls
// 0.0.XXXXX → 0x000000000000000000000000000000000000XXXXX
export function accountIdToEvmAddress(accountId: string): string {
  if (!accountId) return '0x0000000000000000000000000000000000000000'
  const parts = accountId.split('.')
  if (parts.length !== 3) return '0x0000000000000000000000000000000000000000'
  const num = parseInt(parts[2], 10)
  const hex = num.toString(16).padStart(40, '0')
  return `0x${hex}`
}
