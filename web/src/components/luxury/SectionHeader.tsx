import type { ReactNode } from 'react';

interface SectionHeaderProps {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    action?: ReactNode;
    inset?: boolean;
}

export default function SectionHeader({ eyebrow, title, subtitle, action, inset }: SectionHeaderProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 24,
                marginBottom: inset ? 24 : 32,
            }}
        >
            <div>
                {eyebrow && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        {!inset && <span style={{ width: 24, height: 1, background: 'var(--color-metal-1)' }} />}
                        <div className="tracking-luxe" style={{ fontSize: 9, color: 'var(--color-metal-1)' }}>
                            {eyebrow}
                        </div>
                    </div>
                )}
                <h3
                    className="serif"
                    style={{
                        fontSize: inset ? 26 : 36,
                        fontWeight: 400,
                        letterSpacing: '-0.01em',
                        color: 'var(--color-bone)',
                        lineHeight: 1.1,
                    }}
                >
                    {title}
                </h3>
                {subtitle && (
                    <p style={{ fontSize: 13, color: 'var(--color-bone-dim)', marginTop: 8 }}>{subtitle}</p>
                )}
            </div>
            {action}
        </div>
    );
}
