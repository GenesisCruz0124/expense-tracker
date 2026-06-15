import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  createBill as createBillQuery,
  deleteBill as deleteBillQuery,
  listBills,
  markBillPaid as markBillPaidQuery,
  markBillUnpaid as markBillUnpaidQuery,
  updateBill as updateBillQuery,
  type BillInput,
  type BillWithDetails,
} from '../db/queries/bills';

export function useBills() {
  const { db, refreshSignal, notifyDataChanged } = useDatabase();
  const [bills, setBills] = useState<BillWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBills(await listBills(db));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, refreshSignal]),
  );

  const addBill = useCallback(
    async (input: BillInput) => {
      await createBillQuery(db, input);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const editBill = useCallback(
    async (id: number, input: BillInput) => {
      await updateBillQuery(db, id, input);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const removeBill = useCallback(
    async (id: number) => {
      await deleteBillQuery(db, id);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const payBill = useCallback(
    async (id: number, occurredAt: string) => {
      await markBillPaidQuery(db, id, occurredAt);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const unpayBill = useCallback(
    async (id: number) => {
      await markBillUnpaidQuery(db, id);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  return { bills, loading, refresh, addBill, editBill, removeBill, payBill, unpayBill };
}
