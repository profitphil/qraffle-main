import { toast } from "sonner";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";

import { monitoringTasksAtom, monitorStrategyAtom, useTxMonitor, resultAtom } from "@/store/txMonitor";
import { latestTickAtom } from "@/store/rpc";
import { fetchLatestTick, fetchTxStatus, fetchTickTxs } from "@/services/rpc.service";
import { fetchTickEvents } from "@/services/rpc.service";
import { decodeQraffleLog } from "@/services/log.service";
import { addParticipation } from "@/utils/participationStorage";
import type { TickEvents } from "@/types";

function useResultHandlers(setResult: (val: boolean) => void) {
  return {
    onSuccess: async () => {
      setResult(true);
    },
    onFailure: async () => {
      setResult(false);
    },
  };
}

const useGlobalTxMonitor = () => {
  const [monitoringTasks] = useAtom(monitoringTasksAtom);
  const [monitorStrategy] = useAtom(monitorStrategyAtom);
  const { isMonitoring, stopMonitoring } = useTxMonitor();
  const [latestTick, setLatestTick] = useAtom(latestTickAtom);
  const [result, setResult] = useAtom(resultAtom);

  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const monitoringToastIdRef = useRef<string | number | null>(null);
  const v2CooldownUntilRef = useRef<Record<string, number>>({});
  const v2NotFoundCountRef = useRef<Record<string, number>>({});
  const v2TimeoutInFlightRef = useRef<Set<string>>(new Set());
  const v2TimeoutTickCheckAfterRef = useRef<Record<string, number>>({});
  const [visibilityWakeToken, setVisibilityWakeToken] = useState(0);

  const resultHandlers = useResultHandlers(setResult);
  const MONITOR_TIMEOUT_MS = 120000;
  const FAST_TRACK_MIN_AGE_MS = 1500;
  const FAST_TRACK_INITIAL_COOLDOWN_MS = 600;
  const FAST_TRACK_PENDING_COOLDOWN_MS = 800;
  const FAST_TRACK_RECOVERABLE_BACKOFF_MS = 1200;
  const FAST_TRACK_ERROR_BACKOFF_MS = 1500;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const isTransientRpcError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return /429|rate limit|network error|access-control-allow-origin|err_network/i.test(message);
  };
  const getHttpStatusCode = (error: unknown): number | null => {
    if (!error || typeof error !== "object") return null;
    const responseStatus = (error as { response?: { status?: unknown } }).response?.status;
    if (typeof responseStatus === "number") return responseStatus;
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
    return null;
  };
  const isTxStatusNotFoundError = (error: unknown): boolean => {
    const statusCode = getHttpStatusCode(error);
    if (statusCode === 404) return true;
    const message = error instanceof Error ? error.message : String(error);
    return /404/.test(message);
  };
  const getMoneyFlew = (status: unknown): boolean | null => {
    if (!status || typeof status !== "object") return null;
    const rawMoneyFlew = (status as { moneyFlew?: unknown }).moneyFlew;
    return typeof rawMoneyFlew === "boolean" ? rawMoneyFlew : null;
  };
  const getTickTransactionMoneyFlew = async (txHash: string, targetTick: number): Promise<boolean | null> => {
    try {
      const tickTxs = await fetchTickTxs(targetTick);
      const normalizedTxHash = txHash.toLowerCase();
      const match = tickTxs.find((tx) => tx.transaction?.txId?.toLowerCase() === normalizedTxHash);
      if (!match) return null;
      return typeof match.moneyFlew === "boolean" ? match.moneyFlew : null;
    } catch (error) {
      // 400 = archiver hasn't processed the target tick yet (tick still in the
      // future); 404 = tx not indexed yet. Both are pending states, not errors.
      const statusCode = getHttpStatusCode(error);
      if (statusCode !== 400 && !isTransientRpcError(error) && !isTxStatusNotFoundError(error)) {
        console.error("V2 Monitoring: failed to fetch tick transactions", error);
      }
      return null;
    }
  };
  const hasDefinitiveFailureSignal = (status: unknown): boolean => {
    if (!status || typeof status !== "object") return false;
    const parsed = status as Record<string, unknown>;
    if (parsed.success === false || parsed.executed === false || parsed.approved === false) return true;
    const textSignals = [parsed.status, parsed.result, parsed.error, parsed.reason, parsed.message];
    return textSignals.some(
      (value) => typeof value === "string" && /(fail|failed|reject|rejected|invalid|error)/i.test(value),
    );
  };

  // Wake the monitor when the tab returns to foreground (mobile browsers
  // throttle / suspend setInterval while a wallet app is open for signing).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!isMonitoring) return;
      // Reset any in-flight backoffs so the next cycle polls immediately.
      v2CooldownUntilRef.current = {};
      // Refresh the cached latest tick (used by v1/v3) right away.
      fetchLatestTick()
        .then((tick) => setLatestTick(tick))
        .catch((error) => console.warn("visibility wake: failed to fetch latest tick", error));
      // Bump a state token so v2/v3 effects re-run a poll cycle now.
      setVisibilityWakeToken((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [isMonitoring, setLatestTick]);

  useEffect(() => {
    if (!isMonitoring) {
      v2CooldownUntilRef.current = {};
      v2NotFoundCountRef.current = {};
      v2TimeoutTickCheckAfterRef.current = {};
      return;
    }

    const activeTaskIds = new Set(Object.keys(monitoringTasks));
    Object.keys(v2CooldownUntilRef.current).forEach((taskId) => {
      if (!activeTaskIds.has(taskId)) {
        delete v2CooldownUntilRef.current[taskId];
        delete v2NotFoundCountRef.current[taskId];
        delete v2TimeoutTickCheckAfterRef.current[taskId];
      }
    });
  }, [isMonitoring, monitoringTasks]);

  useEffect(() => {
    // If monitoring starts, set up the interval
    if (isMonitoring && monitorStrategy !== "v2") {
      fetchLatestTick()
        .then((tick) => {
          setLatestTick(tick);
        })
        .catch((error) => {
          console.error("Failed to fetch latest tick", error);
        });

      intervalIdRef.current = setInterval(() => {
        fetchLatestTick()
          .then((tick) => {
            setLatestTick(tick);
          })
          .catch((error) => {
            console.error("Failed to fetch latest tick", error);
          });
      }, 2000);
    } else {
      // If monitoring stops, clear the interval
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    }

    // Cleanup on unmount or when isMonitoring changes
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [isMonitoring, monitorStrategy, setLatestTick]);

  /**
   * v1 is original version, and it is too difficult to implement all checker functions
   * v2, v3 is much easier than v1, and good result
   * but TransferShareRight is not procedue of QRaffle contract, so it is not available by v3
   * so we remain v1, v2 for this procedure
   */

  /**
   * v1: only using http endpoint
   * pros: no need to archiver
   * cons: need to write custom check function
   */
  useEffect(() => {
    if (!isMonitoring) return;

    if (monitorStrategy === "v1") {
      Object.entries(monitoringTasks).forEach(async ([taskId, task]) => {
        // wrap/override with resultHandlers
        const onSuccess = async () => {
          await task.onSuccess?.();
          await resultHandlers.onSuccess();
        };
        const onFailure = async () => {
          await task.onFailure?.();
          await resultHandlers.onFailure();
        };

        const { checker } = task;

        if (!latestTick) return;

        if (task.txHash) {
          try {
            const status = await fetchTxStatus(task.txHash);
            const moneyFlew = getMoneyFlew(status);
            const definitiveFailure = hasDefinitiveFailureSignal(status);
            if (moneyFlew === false || definitiveFailure) {
              console.error("V1 Monitoring: transaction reported failed by tx-status");
              stopMonitoring(taskId);
              await onFailure();
              return;
            }
          } catch (txStatusError) {
            if (!isTransientRpcError(txStatusError)) {
              console.error("V1 Monitoring: tx-status precheck failed", txStatusError);
            }
          }
        }

        const TIMEOUT_TICKS = 10;
        if (latestTick > task.targetTick + TIMEOUT_TICKS) {
          stopMonitoring(taskId);
          await onFailure();
          return;
        }

        if (latestTick > task.targetTick) {
          checker().then(async (success) => {
            if (success) {
              stopMonitoring(taskId);
              await onSuccess();
            } else {
              return;
            }
          });
        }
      });
    }
  }, [latestTick, isMonitoring, monitoringTasks, monitorStrategy, stopMonitoring, resultHandlers]);

  /**
   * v2: using archiver approved-transaction endpoint
   * pros: no need to write custom check function
   * cons: cant check why tx is failed
   */
  useEffect(() => {
    if (!isMonitoring) return;
    const timeoutIntervalId = setInterval(() => {
      Object.entries(monitoringTasks).forEach(async ([taskId, task]) => {
        if (!task.createdAt) return;
        const taskTimeoutMs =
          typeof task.timeoutMs === "number" && Number.isFinite(task.timeoutMs) && task.timeoutMs > 0
            ? task.timeoutMs
            : MONITOR_TIMEOUT_MS;
        if (Date.now() - task.createdAt > taskTimeoutMs) {
          // Guard against the 1s interval re-entering while a previous timeout
          // handler for this task is still awaiting checker retries.
          if (v2TimeoutInFlightRef.current.has(taskId)) return;
          v2TimeoutInFlightRef.current.add(taskId);
          try {
            // Don't declare timeout while the chain hasn't passed the target
            // tick yet — slow ticks (esp. near epoch transition) can outlast
            // the wall-clock timeout even though the tx still has a chance.
            const hardCapMs = Math.max(taskTimeoutMs * 4, MONITOR_TIMEOUT_MS);
            if (Date.now() - task.createdAt < hardCapMs) {
              // Throttle the tick probe to avoid hammering the rate-limited RPC
              // from this 1s interval while the task is overdue.
              const nextTickCheckAfter = v2TimeoutTickCheckAfterRef.current[taskId] ?? 0;
              if (Date.now() < nextTickCheckAfter) return;
              try {
                const currentTick = await fetchLatestTick();
                if (currentTick <= task.targetTick + 2) {
                  v2TimeoutTickCheckAfterRef.current[taskId] = Date.now() + 4000;
                  return; // tx outcome not decided on-chain yet; keep monitoring
                }
                delete v2TimeoutTickCheckAfterRef.current[taskId];
              } catch {
                v2TimeoutTickCheckAfterRef.current[taskId] = Date.now() + 4000;
                return; // RPC hiccup; re-evaluate after the backoff
              }
            }

            console.error(`Monitoring timeout for task ${taskId}`);

            if (monitorStrategy === "v2" && task.canRecoverFromMoneyFlewFalse) {
              let checkerSuccess = false;
              let tickMoneyFlew: boolean | null = null;
              try {
                const checkerRetryAttempts = 3;
                for (let attempt = 1; attempt <= checkerRetryAttempts; attempt++) {
                  checkerSuccess = await task.checker();
                  if (checkerSuccess) break;
                  if (attempt < checkerRetryAttempts) {
                    await sleep(1500);
                  }
                }
              } catch (checkerError) {
                console.error("V2 Monitoring: checker failed on timeout fallback", checkerError);
              }

              if (!checkerSuccess && task.txHash) {
                tickMoneyFlew = await getTickTransactionMoneyFlew(task.txHash, task.targetTick);
              }

              stopMonitoring(taskId);
              delete v2CooldownUntilRef.current[taskId];
              delete v2NotFoundCountRef.current[taskId];

              if (checkerSuccess || tickMoneyFlew === true) {
                await task.onSuccess?.();
                await resultHandlers.onSuccess();
                return;
              }

              await task.onFailure?.();
              await resultHandlers.onFailure();
              return;
            }

            stopMonitoring(taskId);
            delete v2CooldownUntilRef.current[taskId];
            delete v2NotFoundCountRef.current[taskId];
            await task.onFailure?.();
            await resultHandlers.onFailure();
          } finally {
            v2TimeoutInFlightRef.current.delete(taskId);
          }
        }
      });
    }, 1000);

    return () => clearInterval(timeoutIntervalId);
  }, [isMonitoring, monitoringTasks, monitorStrategy, stopMonitoring, resultHandlers, visibilityWakeToken]);

  useEffect(() => {
    if (!isMonitoring) return;

    if (monitorStrategy === "v2") {
      const processV2Monitoring = async () => {
        for (const [taskId, task] of Object.entries(monitoringTasks)) {
          // wrap/override with resultHandlers
          const onSuccess = async () => {
            await task.onSuccess?.();
            await resultHandlers.onSuccess();
          };
          const onFailure = async () => {
            await task.onFailure?.();
            await resultHandlers.onFailure();
          };

          if (!task.txHash) continue;

          try {
            const cooldownUntil = v2CooldownUntilRef.current[taskId] ?? 0;
            if (Date.now() < cooldownUntil) continue;

            const isFastTrack = task.fastTrack === true;

            if (task.canRecoverFromMoneyFlewFalse) {
              let checkerSuccess = false;
              try {
                checkerSuccess = await task.checker();
              } catch (checkerError) {
                console.error("V2 Monitoring: checker failed before tx-status fetch", checkerError);
              }

              if (checkerSuccess) {
                console.log("V2 Monitoring: checker confirmed success before tx-status fetch");
                stopMonitoring(taskId);
                delete v2CooldownUntilRef.current[taskId];
                delete v2NotFoundCountRef.current[taskId];
                await onSuccess();
                continue;
              }

              const taskAgeMs = Date.now() - (task.createdAt ?? Date.now());
              const minAgeBeforeStatusCheckMs = isFastTrack ? FAST_TRACK_MIN_AGE_MS : 6000;
              if (taskAgeMs < minAgeBeforeStatusCheckMs) {
                const warmupCooldownMs = isFastTrack ? FAST_TRACK_INITIAL_COOLDOWN_MS : 2000;
                v2CooldownUntilRef.current[taskId] = Date.now() + warmupCooldownMs;
                continue;
              }
            }

            const status = await fetchTxStatus(task.txHash);
            delete v2NotFoundCountRef.current[taskId];
            const moneyFlew = getMoneyFlew(status);
            const definitiveFailure = hasDefinitiveFailureSignal(status);

            if (moneyFlew === false || definitiveFailure) {
              if (!task.canRecoverFromMoneyFlewFalse || definitiveFailure) {
                console.error("V2 Monitoring: transaction reported failed by tx-status");
                stopMonitoring(taskId);
                delete v2CooldownUntilRef.current[taskId];
                delete v2NotFoundCountRef.current[taskId];
                await onFailure();
                continue;
              }

              // Some SC calls can have moneyFlew=false but still succeed via state changes.
              // Use the task checker as authoritative fallback when available.
              let checkerSuccess = false;
              try {
                const checkerRetryAttempts = isFastTrack ? 3 : 6;
                for (let attempt = 1; attempt <= checkerRetryAttempts; attempt++) {
                  checkerSuccess = await task.checker();
                  if (checkerSuccess) {
                    break;
                  }
                  if (attempt < checkerRetryAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, isFastTrack ? 500 : 1000));
                  }
                }
              } catch (checkerError) {
                console.error("V2 Monitoring: checker failed after moneyFlew=false", checkerError);
              }

              if (checkerSuccess) {
                console.log("V2 Monitoring: moneyFlew=false but checker confirmed success");
                stopMonitoring(taskId);
                delete v2CooldownUntilRef.current[taskId];
                delete v2NotFoundCountRef.current[taskId];
                await onSuccess();
              } else {
                // Do not fail immediately for recoverable tasks.
                // Some state transitions can lag tx-status by several seconds.
                v2CooldownUntilRef.current[taskId] =
                  Date.now() + (isFastTrack ? FAST_TRACK_RECOVERABLE_BACKOFF_MS : 3000);
                console.warn("V2 Monitoring: moneyFlew=false and checker not yet positive, continuing to monitor");
              }
            } else if (moneyFlew === true) {
              console.log("V2 Monitoring: Transaction executed successfully (moneyFlew: true)");
              stopMonitoring(taskId);
              delete v2CooldownUntilRef.current[taskId];
              delete v2NotFoundCountRef.current[taskId];
              await onSuccess();
            } else {
              // tx-status can return pending/null before execution; use checker as quick success fallback.
              let checkerSuccess = false;
              try {
                checkerSuccess = await task.checker();
              } catch (checkerError) {
                console.error("V2 Monitoring: checker failed while tx-status is pending", checkerError);
              }

              if (checkerSuccess) {
                console.log("V2 Monitoring: checker confirmed success while tx-status pending");
                stopMonitoring(taskId);
                delete v2CooldownUntilRef.current[taskId];
                delete v2NotFoundCountRef.current[taskId];
                await onSuccess();
              } else {
                // keep monitoring with light polling to avoid RPC pressure
                v2CooldownUntilRef.current[taskId] = Date.now() + (isFastTrack ? FAST_TRACK_PENDING_COOLDOWN_MS : 2500);
              }
            }
          } catch (error) {
            if (isTxStatusNotFoundError(error)) {
              if (task.canRecoverFromMoneyFlewFalse) {
                let checkerSuccess = false;
                try {
                  const checkerRetryAttempts = 2;
                  for (let attempt = 1; attempt <= checkerRetryAttempts; attempt++) {
                    checkerSuccess = await task.checker();
                    if (checkerSuccess) break;
                    if (attempt < checkerRetryAttempts) {
                      await sleep(1000);
                    }
                  }
                } catch (checkerError) {
                  console.error("V2 Monitoring: checker failed after tx-status 404", checkerError);
                }

                if (checkerSuccess) {
                  console.log("V2 Monitoring: checker confirmed success after tx-status 404");
                  stopMonitoring(taskId);
                  delete v2CooldownUntilRef.current[taskId];
                  delete v2NotFoundCountRef.current[taskId];
                  await onSuccess();
                  continue;
                }
              }

              if (task.txHash) {
                const tickMoneyFlew = await getTickTransactionMoneyFlew(task.txHash, task.targetTick);
                if (tickMoneyFlew === true) {
                  console.log("V2 Monitoring: tick transaction confirmed success after tx-status 404");
                  stopMonitoring(taskId);
                  delete v2CooldownUntilRef.current[taskId];
                  delete v2NotFoundCountRef.current[taskId];
                  await onSuccess();
                  continue;
                }

                if (tickMoneyFlew === false && !task.canRecoverFromMoneyFlewFalse) {
                  console.error("V2 Monitoring: tick transaction reported failed after tx-status 404");
                  stopMonitoring(taskId);
                  delete v2CooldownUntilRef.current[taskId];
                  delete v2NotFoundCountRef.current[taskId];
                  await onFailure();
                  continue;
                }
              }

              const isOldEnoughToFail = Date.now() - (task.createdAt ?? Date.now()) > 30000;
              if (isOldEnoughToFail && !task.canRecoverFromMoneyFlewFalse) {
                console.error("V2 Monitoring: tx-status 404 and tx is stale by age, failing task");
                stopMonitoring(taskId);
                delete v2CooldownUntilRef.current[taskId];
                delete v2NotFoundCountRef.current[taskId];
                await onFailure();
                continue;
              }

              try {
                const currentTick = await fetchLatestTick();
                const hasPassedTargetTick = currentTick > task.targetTick + 1;
                if (hasPassedTargetTick) {
                  if (task.canRecoverFromMoneyFlewFalse) {
                    const notFoundCount = (v2NotFoundCountRef.current[taskId] ?? 0) + 1;
                    v2NotFoundCountRef.current[taskId] = notFoundCount;
                    const backoffMs = task.fastTrack
                      ? FAST_TRACK_RECOVERABLE_BACKOFF_MS
                      : Math.min(12000, 4000 + (notFoundCount - 1) * 2000);
                    v2CooldownUntilRef.current[taskId] = Date.now() + backoffMs;
                    continue;
                  }

                  console.error(
                    `V2 Monitoring: tx-status 404 and tx is stale (currentTick=${currentTick}, targetTick=${task.targetTick}), failing task`,
                  );
                  stopMonitoring(taskId);
                  delete v2CooldownUntilRef.current[taskId];
                  delete v2NotFoundCountRef.current[taskId];
                  await onFailure();
                  continue;
                }
              } catch (latestTickError) {
                console.error("V2 Monitoring: failed to fetch latest tick during tx-status 404 handling", latestTickError);
              }

              const notFoundCount = (v2NotFoundCountRef.current[taskId] ?? 0) + 1;
              v2NotFoundCountRef.current[taskId] = notFoundCount;
              const backoffMs = task.canRecoverFromMoneyFlewFalse
                ? task.fastTrack
                  ? FAST_TRACK_PENDING_COOLDOWN_MS
                  : Math.min(12000, 3000 + (notFoundCount - 1) * 2000)
                : 1500;
              v2CooldownUntilRef.current[taskId] = Date.now() + backoffMs;
              continue;
            }

            const backoffMs = task.fastTrack
              ? FAST_TRACK_ERROR_BACKOFF_MS
              : isTransientRpcError(error)
                ? 6000
                : 3000;
            v2CooldownUntilRef.current[taskId] = Date.now() + backoffMs;
            console.error(`V2 Monitoring: Error fetching tx status, backing off for ${backoffMs}ms`, error);
            // Do not fail immediately on transient RPC errors; timeout effect will handle final failure.
          }
        }
      };
      processV2Monitoring();
      const v2IntervalId = setInterval(() => {
        processV2Monitoring();
      }, 1500);
      return () => clearInterval(v2IntervalId);
    }
  }, [isMonitoring, monitoringTasks, monitorStrategy, stopMonitoring, resultHandlers, visibilityWakeToken]);

  /**
   * v3: using log - best choice
   * pros: can check why tx is failed
   * cons: need implementation of SC side logging code
   */
  useEffect(() => {
    if (!isMonitoring) return;
    if (monitorStrategy === "v3") {
      const processMonitoring = async () => {
        for (const [taskId, task] of Object.entries(monitoringTasks)) {
          // wrap/override with resultHandlers
          const onSuccess = async () => {
            console.log("Transaction success handler called");
            await task.onSuccess?.();
            await resultHandlers.onSuccess();
          };
          const onFailure = async () => {
            console.log("Transaction failure handler called");
            await task.onFailure?.();
            await resultHandlers.onFailure();
          };

          try {
            if (!latestTick) continue;

            if (task.txHash) {
              try {
                const status = await fetchTxStatus(task.txHash);
                const moneyFlew = getMoneyFlew(status);
                const definitiveFailure = hasDefinitiveFailureSignal(status);
                if (moneyFlew === false || definitiveFailure) {
                  console.error("V3 Monitoring: transaction reported failed by tx-status");
                  stopMonitoring(taskId);
                  await onFailure();
                  continue;
                }
              } catch (txStatusError) {
                if (!isTransientRpcError(txStatusError)) {
                  console.error("V3 Monitoring: tx-status precheck failed", txStatusError);
                }
              }
            }

            if (latestTick > task.targetTick + 2) {
              let tickEvents: TickEvents | null = null;
              let attempts = 0;
              const maxAttempts = 10;
              while (attempts < maxAttempts) {
                try {
                  tickEvents = await fetchTickEvents(task.targetTick);
                  if (tickEvents) break;
                } catch (error) {
                  console.error(`Failed to fetch tick events (attempt ${attempts + 1}/${maxAttempts})`, error);
                }
                attempts++;
              }

              if (!tickEvents) {
                console.log("No tick events found, calling onFailure");
                stopMonitoring(taskId);
                await onFailure();
                continue;
              }

              const logs = await decodeQraffleLog(tickEvents);
              const lastLogType = logs[logs.length - 1]?.logType;
              console.log("Last log type:", lastLogType);

              stopMonitoring(taskId);
              if (
                lastLogType === "SUCCESS" ||
                lastLogType === "QU_RAFFLE_DEPOSITED" ||
                lastLogType === "TOKEN_RAFFLE_DEPOSITED" ||
                lastLogType === "PROPOSAL_SUBMITTED" ||
                lastLogType === "PROPOSAL_VOTED"
              ) {
                await onSuccess();
              } else {
                // Check if error is ALREADY_REGISTERED and save participation if metadata exists
                if (lastLogType === "ALREADY_REGISTERED" && task.participationMetadata) {
                  const { publicKey, participation } = task.participationMetadata;
                  addParticipation(publicKey, participation);
                  // Show info toast and update UI state without showing error
                  toast.info("You have already participated in this raffle");
                  // Update result state to trigger UI refresh (button disable)
                  console.log("Setting result to true for ALREADY_REGISTERED");
                  setResult(true);
                  // Don't call onFailure to avoid showing error toast
                } else {
                  if (logs.length > 0) toast.error(lastLogType);
                  await onFailure();
                }
              }
            }
          } catch (error) {
            console.error("V3 monitoring task failed", error);
            stopMonitoring(taskId);
            await onFailure();
          }
        }
      };

      processMonitoring().catch((error) => {
        console.error("Error in monitoring process:", error);
      });
    }
  }, [isMonitoring, monitoringTasks, latestTick, monitorStrategy, stopMonitoring, resultHandlers, setResult, visibilityWakeToken]);

  useEffect(() => {
    if (!isMonitoring) return;
    const toastId = toast.loading("Monitoring transaction...", {
      position: "bottom-right",
    });
    monitoringToastIdRef.current = toastId;
    return () => {
      toast.dismiss(toastId);
      if (monitoringToastIdRef.current === toastId) monitoringToastIdRef.current = null;
    };
  }, [isMonitoring]);

  useEffect(() => {
    if (result === undefined) return;
    if (monitoringToastIdRef.current !== null) {
      toast.dismiss(monitoringToastIdRef.current);
      monitoringToastIdRef.current = null;
    }
  }, [result]);

  return null;
};

export default useGlobalTxMonitor;
