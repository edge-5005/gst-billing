import React from 'react';

export default function StatusBadge({ status, statusMap }) {
  const config = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
