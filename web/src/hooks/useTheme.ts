import { useSyncExternalStore } from 'react';
import { getTheme, subscribeToTheme, toggleTheme } from '../lib/theme';

export function useTheme() {
    const theme = useSyncExternalStore(subscribeToTheme, getTheme);
    return { theme, toggleTheme };
}
