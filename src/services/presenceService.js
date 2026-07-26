import { isSupabaseConfigured, supabase } from "../lib/supabase";

const flatten = (state) => Object.values(state || {}).flat();

export function createCustomerPresenceChannel({ listId, userId, userName, onSync }) {
  if (!isSupabaseConfigured || !supabase || !listId || !userId) {
    return {
      trackCustomer: async () => {},
      setCallState: async () => {},
      clearCustomer: async () => {},
      destroy: async () => {},
    };
  }

  let customerId = null;
  let callState = "idle";

  const channel = supabase.channel(`dialix:list:${listId}`, {
    config: { presence: { key: userId } },
  });

  const publish = () =>
    channel.track({
      userId,
      userName,
      customerId,
      callState,
      onlineAt: new Date().toISOString(),
    });

  const sync = () => onSync(flatten(channel.presenceState()));

  channel
    .on("presence", { event: "sync" }, sync)
    .on("presence", { event: "join" }, sync)
    .on("presence", { event: "leave" }, sync)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await publish();
    });

  return {
    async trackCustomer(nextCustomerId) {
      customerId = nextCustomerId;
      callState = "room";
      await publish();
    },
    async setCallState(nextState) {
      callState = nextState;
      await publish();
    },
    async clearCustomer() {
      customerId = null;
      callState = "idle";
      await publish();
    },
    async destroy() {
      await channel.untrack();
      await supabase.removeChannel(channel);
    },
  };
}
