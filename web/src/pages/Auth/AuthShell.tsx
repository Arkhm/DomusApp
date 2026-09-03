import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Monogram from '../../components/luxury/Monogram';

/**
 * Moldura das telas de autenticação fora do login (recuperação de senha).
 *
 * Repete a linguagem visual da coluna direita do Login — monograma, wordmark
 * serifada, fio dourado — mas centralizada, porque estas telas são passagem e
 * não merecem o peso da foto aérea.
 */
export default function AuthShell({
    title,
    highlight,
    subtitle,
    children,
    footer,
}: {
    title: string;
    highlight: string;
    subtitle: string;
    // Opcional: telas de estado final (link inválido) não têm formulário.
    children?: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <div
            style={{
                minHeight: '100vh',
                width: '100%',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
            }}
        >
            <div style={{ width: '100%', maxWidth: 420 }} className="fade-up">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
                    <Monogram size={56} />
                    <div
                        className="serif"
                        style={{
                            fontSize: 28,
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            color: '#181020',
                            lineHeight: 1,
                        }}
                    >
                        Domus
                    </div>
                </div>

                <h1
                    className="serif"
                    style={{
                        fontSize: 34,
                        fontWeight: 400,
                        color: '#181020',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.15,
                        marginBottom: 12,
                    }}
                >
                    {title}{' '}
                    <span className="serif-it" style={{ color: '#B8941F' }}>
                        {highlight}
                    </span>
                </h1>
                <p style={{ fontSize: 14, color: '#5A5160', lineHeight: 1.6 }}>{subtitle}</p>

                <div
                    style={{
                        width: 40,
                        height: 1,
                        background: 'linear-gradient(90deg, #B8941F 0%, transparent 100%)',
                        margin: '32px 0 28px',
                    }}
                />

                {children}

                <div style={{ marginTop: 28, textAlign: 'center' }}>
                    {footer ?? (
                        <Link
                            to="/login"
                            style={{ fontSize: 12, color: '#5A5160', textDecoration: 'none' }}
                        >
                            Voltar para o login
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Input de linha única no mesmo traço dos campos do Login. */
export function AuthField({
    id,
    label,
    type,
    value,
    onChange,
    autoComplete,
    autoFocus,
}: {
    id: string;
    label: string;
    type: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete?: string;
    autoFocus?: boolean;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
                htmlFor={id}
                className="tracking-luxe"
                style={{ fontSize: 10, textTransform: 'uppercase', color: '#5A5160', fontWeight: 500 }}
            >
                {label}
            </label>
            <input
                id={id}
                type={type}
                value={value}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    padding: '10px 0',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #D8CDB6',
                    outline: 'none',
                    fontSize: 15,
                    color: '#181020',
                    fontFamily: 'var(--font-sans)',
                }}
            />
        </div>
    );
}

/** Botão primário dourado, idêntico ao do Login. */
export function AuthButton({
    children,
    disabled,
}: {
    children: ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            type="submit"
            disabled={disabled}
            style={{
                width: '100%',
                padding: '14px 22px',
                background: 'linear-gradient(180deg, #C8A532 0%, #B8941F 100%)',
                color: '#FFFFFF',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                border: '1px solid #B8941F',
                borderRadius: 2,
                cursor: disabled ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                boxShadow: '0 2px 12px rgba(184, 148, 31, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                opacity: disabled ? 0.7 : 1,
            }}
        >
            {children}
        </button>
    );
}
