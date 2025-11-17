import React from 'react';
import './Button.css';

export default function Button({ children, variant = 'primary', size = 'md', disabled, ...props }) {
    return (
        <button
            {...props}
            disabled={disabled}
            className={`btn btn-${variant} btn-${size} ${disabled ? 'btn-disabled' : ''}`}
            onMouseDown={(e) => {
                if (!disabled && !e.currentTarget.classList.contains('btn-pressed')) {
                    e.currentTarget.classList.add('btn-pressed');
                }
            }}
            onMouseUp={(e) => {
                e.currentTarget.classList.remove('btn-pressed');
            }}
            onMouseLeave={(e) => {
                e.currentTarget.classList.remove('btn-pressed');
            }}
        >
            {children}
        </button>
    );
}