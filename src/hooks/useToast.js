import { useEffect, useState } from "react";

export default function useToast(duration = 2200) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => {
      setMessage("");
    }, duration);

    return () => window.clearTimeout(timer);
  }, [message, duration]);

  return {
    message,
    showToast: setMessage,
    clearToast: () => setMessage(""),
  };
}
