export type Theme = 'light' | 'dark';

const storageKey = '@domusapp:theme';
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
let preference: Theme | undefined;

function parsePreference(value: string | null): Theme | undefined {
    return value === 'light' || value === 'dark' ? value : undefined;
}

function applyPreference() {
    if (preference) document.documentElement.dataset.theme = preference;
    else delete document.documentElement.dataset.theme;
}

export function initializeTheme() {
    try {
        preference = parsePreference(localStorage.getItem(storageKey));
    } catch {
        preference = undefined;
    }
    applyPreference();
}

export function getTheme(): Theme {
    return preference ?? (systemTheme.matches ? 'dark' : 'light');
}

export function toggleTheme() {
    preference = getTheme() === 'dark' ? 'light' : 'dark';
    applyPreference();
    try {
        localStorage.setItem(storageKey, preference);
    } catch {
        // O botão continua funcionando quando o navegador bloqueia o armazenamento.
    }
    listeners.forEach(listener => listener());
}

export function subscribeToTheme(listener: () => void) {
    listeners.add(listener);
    const onSystemChange = () => {
        if (!preference) listener();
    };
    const onStorage = (event: StorageEvent) => {
        if (event.key !== storageKey && event.key !== null) return;
        preference = parsePreference(event.newValue);
        applyPreference();
        listener();
    };
    systemTheme.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(listener);
        systemTheme.removeEventListener('change', onSystemChange);
        window.removeEventListener('storage', onStorage);
    };
}
