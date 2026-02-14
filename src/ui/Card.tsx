import type { HTMLAttributes, PropsWithChildren } from "react";
import DropCard from "./GoutteFeed/DropCard";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <DropCard
      mode="panel"
      interactiveTilt={false}
      disableEntryAnimation
      showCloseButton={false}
      className={`rounded-2xl glass-panel text-slate-900 ${className}`}
      {...props}
    >
      {children}
    </DropCard>
  );
}

export function CardContent({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
