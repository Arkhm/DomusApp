interface MonogramProps {
    size?: number;
}

/**
 * Monogram "D" inside an Art-Deco beveled diamond frame with gold gradient.
 * Drop-in replacement for the brand shield.
 */
export default function Monogram({ size = 36 }: MonogramProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            style={{ display: 'block', flexShrink: 0 }}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="domus-mono-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--color-metal-2)" />
                    <stop offset="0.5" stopColor="var(--color-metal-1)" />
                    <stop offset="1" stopColor="var(--color-metal-3)" />
                </linearGradient>
            </defs>
            {/* Outer deco frame — beveled diamond */}
            <path
                d="M24 2 L46 24 L24 46 L2 24 Z"
                fill="none"
                stroke="url(#domus-mono-grad)"
                strokeWidth="0.75"
            />
            <path
                d="M24 6 L42 24 L24 42 L6 24 Z"
                fill="none"
                stroke="url(#domus-mono-grad)"
                strokeWidth="0.4"
                opacity="0.5"
            />
            {/* Corner ticks */}
            <line x1="24" y1="0" x2="24" y2="4" stroke="var(--color-metal-1)" strokeWidth="0.5" />
            <line x1="24" y1="44" x2="24" y2="48" stroke="var(--color-metal-1)" strokeWidth="0.5" />
            <line x1="0" y1="24" x2="4" y2="24" stroke="var(--color-metal-1)" strokeWidth="0.5" />
            <line x1="44" y1="24" x2="48" y2="24" stroke="var(--color-metal-1)" strokeWidth="0.5" />
            {/* Letter D — serif */}
            <text
                x="24"
                y="32"
                textAnchor="middle"
                fontFamily="Cormorant Garamond, serif"
                fontWeight="500"
                fontSize="22"
                fill="url(#domus-mono-grad)"
            >
                D
            </text>
        </svg>
    );
}
