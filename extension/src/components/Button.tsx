import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'px-4 py-3.5 rounded-2xl text-sm font-semibold tracking-wide transition-all duration-200 outline-none flex items-center justify-center gap-2 w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const variants = {
    primary: 'bg-[#121214] hover:bg-black text-white border border-white/10 active:scale-[0.98] shadow-lg shadow-black/25',
    secondary: 'bg-white/10 hover:bg-white/15 border border-white/10 text-white backdrop-blur-md active:scale-[0.98]'
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
