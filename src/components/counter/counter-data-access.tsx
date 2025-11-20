'use client'

import { getCounterProgram, getCounterProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey } from '@solana/web3.js'
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
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getCounterProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getCounterProgram(provider, programId), [provider, programId])

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
      return program.methods
        .createJournalEntry(title, message)
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
      console.error('Error creating entry:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Error creating entry: ${errorMessage}`);
    },
  });

  return {
    program,
    accounts,
    getProgramAccount,
    createEntry,
    programId,
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
