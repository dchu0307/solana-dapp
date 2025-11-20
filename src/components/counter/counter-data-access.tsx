'use client'

import { getCounterProgram, getCounterProgramId } from '@project/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'

interface CreateEntryArgs {
  title: string;
  message: string;
  owner: PublicKey;
}

export function useCounterProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const { publicKey } = useWallet()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getCounterProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getCounterProgram(provider, programId), [provider, programId])
  
  // Check wallet balance
  const walletBalance = useQuery({
    queryKey: ['wallet-balance', { endpoint: connection.rpcEndpoint, publicKey }],
    queryFn: () => publicKey ? connection.getBalance(publicKey) : 0,
    enabled: !!publicKey,
  })

  const accounts = useQuery({
    queryKey: ['counter', 'all', { cluster }],
    queryFn: () => program.account.journalEntryState.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const createEntry = useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ['journalEntry', 'create', {cluster }],
    // get this information from the front end
    mutationFn: async ({ title, message, owner}) => {
      // Check balance before attempting transaction
      // Estimate: ~0.002 SOL for rent (account space ~1100 bytes) + transaction fee
      const MINIMUM_BALANCE = 0.003 * LAMPORTS_PER_SOL; // 0.003 SOL
      const balance = walletBalance.data ?? 0;
      
      if (balance < MINIMUM_BALANCE) {
        const solNeeded = (MINIMUM_BALANCE - balance) / LAMPORTS_PER_SOL;
        throw new Error(`Insufficient funds. You need at least ${solNeeded.toFixed(4)} more SOL for account creation and transaction fees.`);
      }
      
      try {
        return await program.methods
          .createJournalEntry(title, message)
          .accounts({
            owner: owner,
          })
          .rpc();
      } catch (error: unknown) {
        console.error('Transaction failed:', error);
        // Log detailed error information
        if (error && typeof error === 'object' && 'logs' in error) {
          console.error('Transaction logs:', (error as { logs?: string[] }).logs);
        }
        if (error && typeof error === 'object' && 'error' in error) {
          console.error('Error details:', (error as { error?: unknown }).error);
        }
        throw error;
      }
    },

    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch();
      walletBalance.refetch();
    },

    onError: (error) => {
      console.error('Error creating entry:', error);
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide more helpful error messages
      if (errorMessage.includes('Insufficient funds')) {
        // Keep the detailed message we already set
      } else if (errorMessage.includes('0x1') || errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds. You need SOL for rent (account creation) and transaction fees. Minimum ~0.003 SOL recommended.';
      } else if (errorMessage.includes('0x0') || errorMessage.includes('already in use')) {
        errorMessage = 'An entry with this title already exists for your wallet. Please choose a different title.';
      } else if (errorMessage.includes('reverted') || errorMessage.includes('simulation')) {
        errorMessage = 'Transaction simulation failed. This usually means insufficient funds or an account already exists. Check console for details.';
      } else if (errorMessage.includes('Program')) {
        errorMessage = `Program error: ${errorMessage}. Check browser console for more details.`;
      }
      
      toast.error(`Error creating entry: ${errorMessage}`);
    },
  });

  return {
    program,
    accounts,
    getProgramAccount,
    createEntry,
    programId,
    walletBalance,
  };

}

export function useCounterProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, accounts } = useCounterProgram()

  const accountQuery = useQuery({
    queryKey: ['counter', 'fetch', { cluster, account }],
    queryFn: () => program.account.journalEntryState.fetch(account),
  })

  const updateEntry = useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ['journalEntry', 'update', {cluster }],
    // get this information from the front end
    mutationFn: async ({ title, message, owner }) => {
      return program.methods
        .updateJournalEntry(title, message)
        .accounts({
          owner: owner,
        })
        .rpc();
    },

    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch();
    },

    onError: (error) => {
      console.error('Error updating entry:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Error updating entry: ${errorMessage}`);
    },
  });

  const deleteEntry = useMutation({
    mutationKey: ['journalEntry', 'delete', {cluster }],
    // get this information from the front end
    mutationFn: (title: string) => {
      return program.methods.deleteJournalEntry(title).rpc();
    },

    onSuccess: (signature) => {
      transactionToast(signature);
      accounts.refetch();
    },
  });

  return {
    accountQuery,
    updateEntry,
    deleteEntry,
  };
}
