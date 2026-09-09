import type { ReactNode } from 'react';

// Input com label flutuante estilo material, usado nas telas de autenticação
// (login, esqueci minha senha, redefinir senha). Extraído do Login.tsx pra
// não duplicar o mesmo bloco de estilo em cada tela nova.
interface FloatingFieldProps {
    id: string;
    label: string;
    type: string;
    value: string;
    onChange: (v: string) => void;
    focused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    autoComplete?: string;
    trailing?: ReactNode;
}

export default function FloatingField({
    id,
    label,
    type,
    value,
    onChange,
    focused,
    onFocus,
    onBlur,
    autoComplete,
    trailing,
}: FloatingFieldProps) {
    const filled = value && value.length > 0;
    const elevated = focused || filled;
    return (
        <div style={{ position: 'relative', paddingTop: 6 }}>
            <label
                htmlFor={id}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: elevated ? 0 : 22,
                    fontSize: elevated ? 10 : 14,
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: elevated ? '0.16em' : '0',
                    textTransform: elevated ? 'uppercase' : 'none',
                    color: focused ? '#B8941F' : '#5A5160',
                    fontWeight: 500,
                    pointerEvents: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {label}
            </label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                autoComplete={autoComplete}
                style={{
                    width: '100%',
                    padding: '12px 0 10px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: focused ? '1.5px solid #B8941F' : '1px solid #D8CDB6',
                    outline: 'none',
                    fontSize: 15,
                    color: '#181020',
                    fontFamily: 'var(--font-sans)',
                    transition: 'border-color 0.2s ease',
                }}
            />
            {trailing}
        </div>
    );
}
