import { useEffect, useState } from 'react';

interface GeoCity {
    city: string;
    region?: string;
    country?: string;
    /** 'precise' = browser GPS + reverse-geocode; 'ip' = approximate via public IP */
    source: 'precise' | 'ip';
}

const CACHE_KEY = 'domus:geo-city';
const DENIED_KEY = 'domus:geo-denied';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — coordinates rarely change for the same user

interface CachedEntry {
    value: GeoCity;
    ts: number;
}

function readCache(): GeoCity | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedEntry;
        if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
        return parsed.value;
    } catch {
        return null;
    }
}

function writeCache(value: GeoCity) {
    try {
        const entry: CachedEntry = { value, ts: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // Storage unavailable (private mode / quota) — silently ignore.
    }
}

function isDenied(): boolean {
    try {
        return localStorage.getItem(DENIED_KEY) === '1';
    } catch {
        return false;
    }
}

function markDenied() {
    try {
        localStorage.setItem(DENIED_KEY, '1');
    } catch {
        /* ignore */
    }
}

/** Promise wrapper around the callback-based geolocation API. */
function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject(new Error('Geolocation API not supported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: CACHE_TTL_MS,
        });
    });
}

/** Reverse-geocode lat/lon to a city via BigDataCloud's free client-side API (no key). */
async function reverseGeocode(lat: number, lon: number, signal: AbortSignal): Promise<GeoCity | null> {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`;
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    const data = (await r.json()) as {
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryName?: string;
    };
    const city = data.city || data.locality;
    if (!city) return null;
    return {
        city,
        region: data.principalSubdivision,
        country: data.countryName,
        source: 'precise',
    };
}

/** IP-based fallback used when the user denies geolocation or it fails. */
async function ipFallback(signal: AbortSignal): Promise<GeoCity | null> {
    const r = await fetch('https://ipapi.co/json/', { signal });
    if (!r.ok) return null;
    const data = (await r.json()) as { city?: string; region?: string; country_name?: string };
    if (!data?.city) return null;
    return {
        city: data.city,
        region: data.region,
        country: data.country_name,
        source: 'ip',
    };
}

/**
 * Resolves the user's city.
 *
 * Strategy:
 *   1. Serve from localStorage cache (24h TTL) if present.
 *   2. If the user previously denied the permission, skip the prompt and fall back to IP.
 *   3. Otherwise request browser geolocation (one-time prompt) and reverse-geocode via
 *      BigDataCloud's free CORS client endpoint.
 *   4. On any failure (denied / timeout / network), fall back to ipapi.co.
 *
 * Returns `null` while loading. Callers should provide a fallback label.
 */
export function useGeoCity(): GeoCity | null {
    const [geo, setGeo] = useState<GeoCity | null>(() => readCache());

    useEffect(() => {
        if (geo) return; // cached hit — skip everything

        let cancelled = false;
        const controller = new AbortController();

        const resolveCity = async () => {
            // If the user already said no, don't prompt again — go straight to IP.
            if (isDenied()) {
                const ip = await ipFallback(controller.signal).catch(() => null);
                if (!cancelled && ip) {
                    setGeo(ip);
                    writeCache(ip);
                }
                return;
            }

            try {
                const pos = await getCurrentPosition();
                const precise = await reverseGeocode(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    controller.signal,
                );
                if (!cancelled && precise) {
                    setGeo(precise);
                    writeCache(precise);
                    return;
                }
            } catch (err: unknown) {
                // PERMISSION_DENIED = 1 — remember so we don't re-prompt next time.
                if (
                    typeof err === 'object' &&
                    err !== null &&
                    'code' in err &&
                    (err as GeolocationPositionError).code === 1
                ) {
                    markDenied();
                }
            }

            // Either the precise path failed or returned no city — try IP.
            const ip = await ipFallback(controller.signal).catch(() => null);
            if (!cancelled && ip) {
                setGeo(ip);
                writeCache(ip);
            }
        };

        resolveCity();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [geo]);

    return geo;
}
