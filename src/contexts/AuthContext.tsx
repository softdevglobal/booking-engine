"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

type User = {
	id: string;
	name: string;
	email: string;
	phone?: string;
	avatar?: string;
};

type AuthContextType = {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (email: string, password: string) => Promise<boolean>;
	register: (name: string, email: string, password: string, phone?: string) => Promise<boolean>;
	logout: () => Promise<void>;
	updateProfile: (userData: Partial<User>) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, tenantId }: { children: React.ReactNode; tenantId: string }) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const unsub = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
			if (fbUser) {
				try {
					const ref = doc(db, "customers", fbUser.uid);
					const snap = await getDoc(ref);
					const data = snap.data() as any;
					// Note: Do not force sign-out on tenant mismatch; server validates on booking submit.
					const u: User = {
						id: fbUser.uid,
						name: data?.name || fbUser.displayName || (fbUser.email?.split("@")[0] ?? "User"),
						email: fbUser.email || "",
						phone: data?.phone || "",
						avatar:
							data?.avatar ||
							`https://ui-avatars.com/api/?name=${encodeURIComponent(
								data?.name || fbUser.email?.split("@")[0] || "User"
							)}&background=e63946&color=fff`
					};
					setUser(u);
					localStorage.setItem("booking_engine_user", JSON.stringify(u));
				} catch {
					setUser(null);
					localStorage.removeItem("booking_engine_user");
				}
			} else {
				setUser(null);
				localStorage.removeItem("booking_engine_user");
			}
			setIsLoading(false);
		});
		return () => unsub();
	}, [tenantId]);

	const login = async (email: string, password: string): Promise<boolean> => {
		setIsLoading(true);
		try {
			await signInWithEmailAndPassword(auth, email, password);
			return true;
		} catch {
			return false;
		} finally {
			setIsLoading(false);
		}
	};

	const register = async (name: string, email: string, password: string, phone?: string): Promise<boolean> => {
		setIsLoading(true);
		try {
			const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
			const payload = {
				customerId: fbUser.uid,
				tenantId,
				name,
				email,
				phone: phone || "",
				avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e63946&color=fff`,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				role: "customer",
				status: "active",
				source: "booking-engine"
			};
			await setDoc(doc(db, "customers", fbUser.uid), payload);
			return true;
		} catch {
			return false;
		} finally {
			setIsLoading(false);
		}
	};

	const logout = async () => {
		try {
			await signOut(auth);
		} finally {
			setUser(null);
			localStorage.removeItem("booking_engine_user");
		}
	};

	const updateProfile = async (userData: Partial<User>): Promise<boolean> => {
		if (!user) return false;
		setIsLoading(true);
		try {
			const updatePayload = {
				...userData,
				customerId: user.id,
				updatedAt: new Date().toISOString()
			};
			await updateDoc(doc(db, "customers", user.id), updatePayload);
			const merged = { ...user, ...userData };
			setUser(merged as User);
			localStorage.setItem("booking_engine_user", JSON.stringify(merged));
			return true;
		} catch {
			return false;
		} finally {
			setIsLoading(false);
		}
	};

	const value: AuthContextType = {
		user,
		isAuthenticated: !!user,
		isLoading,
		login,
		register,
		logout,
		updateProfile
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
	return ctx;
}


