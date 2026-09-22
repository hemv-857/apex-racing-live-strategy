import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a14] text-white px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 text-8xl font-bold font-mono text-[#00d4aa]">404</div>
        <h1 className="text-2xl font-bold mb-3">Strategy Offline</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          This page has been flagged for an emergency pit stop. The strategy you requested isn&apos;t on the pit wall.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-[#00d4aa] px-6 py-3 font-semibold text-black hover:bg-[#00d4aa]/80 transition-colors"
        >
          ← Back to Strategy Board
        </Link>
      </div>
    </div>
  );
}
