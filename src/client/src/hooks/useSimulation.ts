import { useCallback } from 'react';
import { useNomad } from '../contexts/NomadContext';

/**
 * Convenience hook that exposes simulation controls and state
 * from the NomadContext.
 */
export function useSimulation() {
  const {
    simulationState,
    itinerary,
    currentDayIndex,
    toggleSim,
    setSimSpeed,
    toggleAutoCheckIn,
  } = useNomad();

  const currentDay = itinerary?.plan[currentDayIndex] ?? null;
  const stops = currentDay?.stops ?? [];

  const completedCount = stops.filter(s => s.status === 'completed').length;
  const totalCount = stops.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const speedOptions = [1, 2, 5, 10, 20] as const;

  const cycleSpeed = useCallback(() => {
    const idx = speedOptions.indexOf(simulationState.speed as (typeof speedOptions)[number]);
    const next = speedOptions[(idx + 1) % speedOptions.length];
    setSimSpeed(next);
  }, [simulationState.speed, setSimSpeed]);

  return {
    isRunning: simulationState.isRunning,
    speed: simulationState.speed,
    autoCheckIn: simulationState.autoCheckIn,
    userPosition: simulationState.userPosition,
    simulationTime: simulationState.simulationTime,
    completedCount,
    totalCount,
    progressPct,
    speedOptions,
    toggleSim,
    setSimSpeed,
    cycleSpeed,
    toggleAutoCheckIn,
  };
}
