import React from "react";

export const Badge = ({ children, variant = "default", className = "" }: any) => {
  const styles: any = {
    default: "bg-slate-100 text-slate-900 hover:bg-slate-100/80",
    premium: "bg-amber-100 text-amber-800 border border-amber-200",
    free: "bg-green-100 text-green-800 border border-green-200",
  };
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${styles[variant]} ${className}`}>
      {children}
    </div>
  );
};

