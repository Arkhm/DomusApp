import type { CSSProperties, ReactNode } from 'react';

type Tone = 'neutral' | 'gold' | 'purple' | 'ok' | 'warn' | 'err';

interface TagProps {
    children: ReactNode;
    tone?: Tone;
    dot?: boolean;
}

const TONES: Record<Tone, { bg: string; color: string; border: string }> = {
    neutral: {
        bg: 'var(--color-ink-2)',
        color: 'var(--color-bone-dim)',
        border: '1px solid var(--color-line-strong)',
    },
    gold: {
        bg: 'color-mix(in srgb, var(--color-metal-1) 8%, transparent)',
        color: 'var(--color-metal-1)',
        border: '1px solid color-mix(in srgb, var(--color-metal-1) 30%, transparent)',
    },
    purple: {
        bg: 'color-mix(in srgb, var(--color-purple) 10%, transparent)',
        color: 'var(--color-purple)',
        border: '1px solid color-mix(in srgb, var(--color-purple) 25%, transparent)',
    },
    ok: {
        bg: 'color-mix(in srgb, var(--color-ok) 12%, transparent)',
        color: 'var(--color-ok)',
        border: '1px solid color-mix(in srgb, var(--color-ok) 25%, transparent)',
    },
    warn: {
        bg: 'color-mix(in srgb, var(--color-warn) 12%, transparent)',
        color: 'var(--color-warn)',
        border: '1px solid color-mix(in srgb, var(--color-warn) 25%, transparent)',
    },
    err: {
        bg: 'color-mix(in srgb, var(--color-err) 12%, transparent)',
        color: 'var(--color-err)',
        border: '1px solid color-mix(in srgb, var(--color-err) 25%, transparent)',
    },
};

export default function Tag({ children, tone = 'neutral', dot }: TagProps) {
    const t = TONES[tone];
    const style: CSSProperties = { background: t.bg, color: t.color, border: t.border };
    return (
        <span className="tag" style={style}>
            {dot && <span className="status-dot" style={{ background: t.color }} />}
            {children}
        </span>
    );
}
