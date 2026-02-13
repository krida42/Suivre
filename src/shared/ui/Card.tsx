import type { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`rounded-2xl glass-panel text-slate-100 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
