import type { ReactNode } from 'react';

interface PageBodyProps {
    children: ReactNode;
}

export default function PageBody({ children }: PageBodyProps) {
    return (
        <div style={{ padding: '40px 48px 80px', maxWidth: 1600, margin: '0 auto' }}>
            {children}
        </div>
    );
}
