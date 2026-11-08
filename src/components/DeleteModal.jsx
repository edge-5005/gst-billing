import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function DeleteModal({ isOpen, onClose, onConfirm, title = 'Delete Confirmation', message = 'Are you sure you want to delete this item? This action cannot be undone.' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning icon */}
        <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-red-100 mb-4">
          <AlertTriangle className="w-7 h-7 text-red-600" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-sm text-gray-500 text-center mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="btn-danger flex-1"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
