'use client';

interface StatusBadgeProps {
  label: string;
  colorClass: string;
}

export default function StatusBadge({ label, colorClass }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
