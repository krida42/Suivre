import React from "react";

export const Card = ({ children, className = "" }: any) => (
  <div className={`rounded-2xl glass-panel text-slate-100 ${className}`}>{children}</div>
);

export const CardContent = ({ children, className = "" }: any) => <div className={`p-6 ${className}`}>{children}</div>;

