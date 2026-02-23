'use client';

import React, { ReactNode } from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      loading = false,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      primary:
        'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-lg hover:shadow-primary-500/30 hover:scale-105',
      secondary:
        'bg-dark-800 text-dark-50 hover:bg-dark-700 border border-dark-700',
      outline:
        'border-2 border-primary-500 text-primary-500 hover:bg-primary-500/10',
      ghost: 'text-dark-200 hover:text-primary-400 hover:bg-dark-800/50',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {icon && !loading && icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

interface CardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  interactive = false,
}) => (
  <div
    className={clsx(
      'glass p-6 rounded-xl',
      interactive && 'card-hover cursor-pointer',
      className
    )}
  >
    {children}
  </div>
);

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  change?: number;
  subtext?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  change,
  subtext,
}) => (
  <Card className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-dark-400 text-sm font-medium">{label}</p>
      {icon && <div className="text-primary-500">{icon}</div>}
    </div>
    <div className="space-y-1">
      <p className="text-2xl font-bold gradient-text">{value}</p>
      {subtext && <p className="text-dark-400 text-xs">{subtext}</p>}
    </div>
    {change !== undefined && (
      <p
        className={clsx(
          'text-xs font-semibold',
          change >= 0 ? 'text-green-500' : 'text-red-500'
        )}
      >
        {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
      </p>
    )}
  </Card>
);

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
}) => {
  const variantClasses = {
    success: 'bg-green-500/20 text-green-400 border border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    default: 'bg-dark-700 text-dark-300 border border-dark-600',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-dark-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <div className="absolute left-3 top-3 text-dark-500">{icon}</div>}
        <input
          ref={ref}
          className={clsx(
            'w-full px-4 py-2.5 rounded-lg glass border border-dark-700',
            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none',
            'text-dark-50 placeholder-dark-500 transition-all duration-200',
            icon && 'pl-10',
            error && 'border-red-500/50 focus:ring-red-500',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
);

Input.displayName = 'Input';

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-dark-300 mb-2">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={clsx(
          'w-full px-4 py-2.5 rounded-lg glass border border-dark-700',
          'focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none',
          'text-dark-50 transition-all duration-200 bg-dark-800',
          error && 'border-red-500/50 focus:ring-red-500',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-dark-900">
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
);

Select.displayName = 'Select';

interface LoadingSkeletonProps {
  count?: number;
  height?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 1,
  height = 'h-12',
}) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`${height} bg-gradient-to-r from-dark-800 to-dark-700 rounded-lg animate-pulse`}
      />
    ))}
  </>
);

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    {icon && <div className="mb-4 text-4xl opacity-50">{icon}</div>}
    <h3 className="text-xl font-semibold text-dark-200 mb-2">{title}</h3>
    <p className="text-dark-400 mb-6 max-w-sm">{description}</p>
    {action && action}
  </div>
);
