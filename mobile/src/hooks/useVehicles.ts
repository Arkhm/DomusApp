import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { toApiFailure } from '../services/api';
import { getVehicleParkingSpots, listVehicles } from '../services/vehicleService';
import type { Vehicle } from '../types/vehiclePet';

export function useVehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parkingSpots, setParkingSpots] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadError(null);
    setParkingSpots(null);
    if (user?.role !== 'MORADOR') {
      setVehicles([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    // Sem capacidade disponível, a lista continua útil e a ocupação fica oculta.
    void Promise.all([listVehicles(), getVehicleParkingSpots().catch(() => null)])
      .then(([items, capacity]) => {
        if (!active) return;
        setVehicles(items);
        setParkingSpots(capacity);
      }).catch((error: unknown) => {
        if (active) setLoadError(toApiFailure(error, 'Não foi possível carregar os veículos.').message);
      }).finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [user?.id, user?.role, user?.unitId, revision]));

  return { vehicles, parkingSpots, isLoading, loadError, reload };
}
