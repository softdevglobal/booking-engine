"use client";

import React, { useState } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";
import NotificationPanel from "@/components/NotificationPanel";

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-24 z-40 w-12 h-12 rounded-full bg-[#181411] text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        title="Notifications"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22a2 2 0 002-2H10a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#e63946] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>
      <NotificationPanel isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}


