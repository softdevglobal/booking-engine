"use client";
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/LoginModal";

export default function AuthFab() {
	const { isAuthenticated, user, logout } = useAuth();
	const [open, setOpen] = useState(false);
	const [showLogin, setShowLogin] = useState(false);

	return (
		<>
			<div className="fixed bottom-6 right-6 z-50">
				{isAuthenticated ? (
					<div className="relative">
						<button
							onClick={() => setOpen((v) => !v)}
							className="w-12 h-12 rounded-full shadow-lg ring-2 ring-white overflow-hidden border border-gray-200 bg-white hover:shadow-xl transition-shadow"
							title={user?.name || "Account"}
						>
							<img
								src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=e63946&color=fff`}
								alt="profile"
								className="w-full h-full object-cover"
							/>
						</button>
						{open && (
							<div className="absolute bottom-14 right-0 bg-white rounded-xl shadow-xl border border-gray-200 w-56 overflow-hidden">
								<div className="p-3 border-b border-gray-100">
									<p className="text-sm font-semibold text-[#181411] truncate">{user?.name}</p>
									<p className="text-xs text-[#897561] truncate">{user?.email}</p>
								</div>
								<button
									onClick={async () => { setOpen(false); await logout(); }}
									className="w-full text-left px-4 py-3 text-[#181411] hover:bg-gray-50 text-sm"
								>
									Logout
								</button>
							</div>
						)}
					</div>
				) : (
					<button
						onClick={() => setShowLogin(true)}
						className="px-4 h-12 rounded-full shadow-lg border border-gray-200 bg-[#e63946] text-white font-semibold hover:bg-[#d62839] transition-colors"
					>
						Login / Register
					</button>
				)}
			</div>
			{showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
		</>
	);
}


