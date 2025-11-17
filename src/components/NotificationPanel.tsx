"use client";

import React, { useState } from "react";
import { useNotifications } from "@/contexts/NotificationContext";

export default function NotificationPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, clearNotification, clearAllNotifications } = useNotifications();
  const [marking, setMarking] = useState(false);

  if (!isOpen) return null;

  const formatTimeAgo = (d: Date) => {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "Just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && <span className="bg-[#e63946] text-white text-xs font-bold px-2 py-1 rounded-full">{unreadCount}</span>}
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button onClick={clearAllNotifications} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete All</button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={async () => { setMarking(true); await markAllAsRead(); setMarking(false); }}
                disabled={marking}
                className="text-sm text-[#e63946] hover:text-[#d62839] font-medium disabled:opacity-50"
              >
                {marking ? "Marking..." : "Mark all read"}
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e63946]" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6zM4 5h6V1H4v4zM15 1h5v6h-5V1z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h4>
              <p className="text-gray-500 text-sm">You&apos;ll see booking updates and messages here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map(n => (
                <div key={n.id} className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!n.isRead ? "bg-blue-50 border-l-4 border-l-[#e63946]" : ""}`} onClick={() => !n.isRead && markAsRead(n.id)}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm font-medium ${!n.isRead ? "text-gray-900" : "text-gray-700"}`}>{n.title}</h4>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); clearNotification(n.id); }} className="w-5 h-5 rounded-full hover:bg-red-100 flex items-center justify-center transition-colors" title="Delete notification">
                            <svg className="w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          {!n.isRead && <span className="w-2 h-2 bg-[#e63946] rounded-full" />}
                        </div>
                      </div>
                      <p className={`text-sm mt-1 ${!n.isRead ? "text-gray-800" : "text-gray-600"}`}>{n.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{formatTimeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}


