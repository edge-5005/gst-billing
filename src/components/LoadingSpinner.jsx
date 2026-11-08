import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      <p className="mt-3 text-sm text-gray-500">{message}</p>
    </div>
  );
}
