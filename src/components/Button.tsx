import React from "react";
import { Loader2 } from "lucide-react";

export const Button = ({ children, variant = "primary", className = "", onClick, disabled, isLoading }: any) => {
  const baseStyle =
    "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 h-10 px-6 py-2 active:scale-95";
  
  const variants: any = {
    primary: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 border border-indigo-400/20",
    secondary: "bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/10",
    outline: "border border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:border-white/40",
    ghost: "hover:bg-white/10 text-slate-200",
    destructive: "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25 hover:from-red-500 hover:to-rose-500",
    accent: "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white hover:from-fuchsia-500 hover:to-pink-500 shadow-lg shadow-fuchsia-500/25",
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled || isLoading}>
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

