"use client";

import { cn } from "@/lib/utils";

// Skeleton loader for cards/panels while data loads
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/40 bg-slate-900/40 p-4", className)}>
      <div className="space-y-2.5">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-800" />
        <div className="h-2 w-full animate-pulse rounded bg-slate-800/70" />
        <div className="h-2 w-3/4 animate-pulse rounded bg-slate-800/50" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="h-12 animate-pulse rounded-md bg-slate-800/60" />
          <div className="h-12 animate-pulse rounded-md bg-slate-800/60" />
          <div className="h-12 animate-pulse rounded-md bg-slate-800/60" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn("h-8 w-full animate-pulse rounded bg-slate-800/50", className)} />;
}

export function SkeletonChart({ height = "h-48" }: { height?: string }) {
  return (
    <div className={cn("flex w-full items-center justify-center", height)}>
      <div className="h-full w-full animate-pulse rounded bg-slate-800/30" />
    </div>
  );
}

// Glassmorphism panel wrapper
export function GlassPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm shadow-lg shadow-black/20",
        className
      )}
    >
      {children}
    </div>
  );
}
