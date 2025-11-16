import React from 'react';

export default function Button({ children, variant = 'primary', size = 'md', ...props }) {
    const base = {
        border: 'none',
        outline: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 500,
        padding: size === 'sm' ? '6px 10px' : '8px 14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease',
    };

    const variants = {
        primary: {
            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
            color: '#f9fafb',
            boxShadow: '0 10px 24px rgba(37, 99, 235, 0.35)',
        },
        secondary: {
            background: 'rgba(31, 41, 55, 0.85)',
            color: '#e5e7eb',
            border: '1px solid rgba(55, 65, 81, 0.9)',
        },
        ghost: {
            background: 'transparent',
            color: '#9ca3af',
        },
    };

    const style = { ...base, ...variants[variant] };

    return (
        <button
            {...props}
            style={style}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
            {children}
        </button>
    );
}