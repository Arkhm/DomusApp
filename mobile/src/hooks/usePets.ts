import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { toApiFailure } from '../services/api';
import { listPets } from '../services/petService';
import type { Pet } from '../types/vehiclePet';

export function usePets() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadError(null);
    if (user?.role !== 'MORADOR') {
      setPets([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void listPets().then((items) => {
      if (active) setPets(items);
    }).catch((error: unknown) => {
      if (active) setLoadError(toApiFailure(error, 'Não foi possível carregar os pets.').message);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, user?.role, revision]));

  return { pets, isLoading, loadError, reload };
}
