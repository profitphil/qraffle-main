import { atom, useAtom } from "jotai";
import { useMemo } from "react";
import { useCallback } from "react";
import type { Participation } from "@/utils/participationStorage";

// Define a type for the monitoring task
type MonitoringTask = {
  createdAt?: number;
  targetTick: number;
  checker: () => Promise<boolean>;
  onSuccess: () => Promise<void>;
  onFailure: () => Promise<void>;
  txHash?: string;
  canRecoverFromMoneyFlewFalse?: boolean;
  timeoutMs?: number;
  fastTrack?: boolean;
  participationMetadata?: {
    publicKey: string;
    participation: Participation;
  };
};

// Global state for active monitoring tasks
export const monitoringTasksAtom = atom<Record<string, MonitoringTask>>({});
export const isMonitoringAtom = atom<boolean>(false);
export const resultAtom = atom<boolean | undefined>(undefined);
export const monitorStrategyAtom = atom<"v1" | "v2" | "v3">("v3");

export const useTxMonitor = () => {
  const [, setMonitoringTasks] = useAtom(monitoringTasksAtom);
  const [isMonitoring, setIsMonitoring] = useAtom(isMonitoringAtom);
  const [result, setResult] = useAtom(resultAtom);
  const [, setMonitorStrategy] = useAtom(monitorStrategyAtom);

  // Memoize functions to prevent unnecessary rerenders
  const startMonitoring = useCallback(
    (taskId: string, task: MonitoringTask, monitorStrategy: "v1" | "v2" | "v3" = "v3") => {
      setMonitoringTasks((prev) => ({ ...prev, [taskId]: { ...task, createdAt: Date.now() } }));
      setIsMonitoring(true);
      setResult(undefined);
      setMonitorStrategy(monitorStrategy);
    },
    [setMonitoringTasks, setIsMonitoring, setResult, setMonitorStrategy],
  );

  const stopMonitoring = useCallback(
    (taskId: string) => {
      setMonitoringTasks((prev) => {
        const newTasks = { ...prev };
        delete newTasks[taskId];
        setIsMonitoring(Object.keys(newTasks).length > 0);
        return newTasks;
      });
    },
    [setMonitoringTasks, setIsMonitoring],
  );

  const resetState = useCallback(() => {
    setMonitoringTasks({});
    setIsMonitoring(false);
    setResult(undefined);
  }, [setMonitoringTasks, setIsMonitoring, setResult]);

  // Return memoized object to prevent unnecessary rerenders
  return useMemo(
    () => ({
      isMonitoring,
      result,
      startMonitoring,
      stopMonitoring,
      resetState,
    }),
    [isMonitoring, result, startMonitoring, stopMonitoring, resetState],
  );
};
