import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCustomerPresenceChannel } from "../services/presenceService";

export default function useCustomerPresence({ listId, userId, userName }) {
  const [rows, setRows] = useState([]);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!listId || !userId) return undefined;

    const controller = createCustomerPresenceChannel({
      listId,
      userId,
      userName,
      onSync: setRows,
    });

    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [listId, userId, userName]);

  const presenceByCustomer = useMemo(() => {
    const result = {};
    rows.forEach((row) => {
      if (!row.customerId) return;
      if (!result[row.customerId]) result[row.customerId] = [];
      result[row.customerId].push(row);
    });
    return result;
  }, [rows]);

  const getOtherUsers = useCallback(
    (customerId) => (presenceByCustomer[customerId] || []).filter((row) => row.userId !== userId),
    [presenceByCustomer, userId],
  );
  const trackCustomer = useCallback((id) => controllerRef.current?.trackCustomer(id), []);
  const setCallState = useCallback((state) => controllerRef.current?.setCallState(state), []);
  const clearCustomer = useCallback(() => controllerRef.current?.clearCustomer(), []);

  return useMemo(() => ({
    rows,
    presenceByCustomer,
    getOtherUsers,
    trackCustomer,
    setCallState,
    clearCustomer,
  }), [rows, presenceByCustomer, getOtherUsers, trackCustomer, setCallState, clearCustomer]);
}
