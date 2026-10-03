import { LoaderCircle, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-105 disabled:bg-raised disabled:text-ink-3",
  secondary: "bg-raised text-ink hover:bg-hover disabled:text-ink-3",
  outline: "border border-line-strong text-ink hover:bg-raised disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-raised hover:text-ink disabled:text-ink-3",
  danger: "bg-danger-soft text-danger hover:bg-danger/20 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
  lg: "h-13 px-5 text-base gap-2 rounded-xl",
};

const iconSize: Record<Size, number> = { sm: 16, md: 18, lg: 20 };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  block = false,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,color,transform,filter] duration-150 active:scale-[0.98] disabled:active:scale-100",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={iconSize[size]} className="animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon size={iconSize[size]} strokeWidth={2} aria-hidden />
      ) : null}
      {children}
      {IconRight && !loading ? <IconRight size={iconSize[size]} strokeWidth={2} aria-hidden /> : null}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: "ghost" | "secondary" | "primary" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const iconButtonSizes = { sm: "size-9", md: "size-11", lg: "size-12" };

export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  loading,
  className,
  type = "button",
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:opacity-40 disabled:active:scale-100",
        variants[variant],
        iconButtonSizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={18} className="animate-spin" aria-hidden />
      ) : (
        <Icon size={size === "sm" ? 17 : 19} strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}
