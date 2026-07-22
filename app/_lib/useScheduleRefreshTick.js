import { useEffect, useState } from "react";
import { AppState } from "react-native";

export const useScheduleRefreshTick = (intervalMs = 30000) => {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTick(Date.now());
    }, intervalMs);

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setTick(Date.now());
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [intervalMs]);

  return tick;
};
