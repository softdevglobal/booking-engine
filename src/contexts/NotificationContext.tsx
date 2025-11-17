"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
};

type Ctx = {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotification: (notificationId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
};

const NotificationContext = createContext<Ctx | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    const q = query(collection(db, "notifications"), where("userId", "==", user.id));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          userId: data.userId,
          type: data.type || "info",
          title: data.title || "Notification",
          message: data.message || "",
          data: data.data || {},
          isRead: !!data.isRead,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          readAt: data.readAt?.toDate?.() || undefined
        } as NotificationItem;
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setNotifications(list);
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsub();
  }, [isAuthenticated, user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await updateDoc(doc(db, "notifications", notificationId), { isRead: true, readAt: serverTimestamp() });
    } catch {}
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      await Promise.all(unread.map(n => updateDoc(doc(db, "notifications", n.id), { isRead: true, readAt: serverTimestamp() })));
    } catch {}
  }, [notifications]);

  const clearNotification = useCallback(async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, "notifications", notificationId));
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch {}
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      await Promise.all(notifications.map(n => deleteDoc(doc(db, "notifications", n.id))));
      setNotifications([]);
    } catch {}
  }, [notifications]);

  const value: Ctx = { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, clearNotification, clearAllNotifications };
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}


