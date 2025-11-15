"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BookingEngineWidget from "@/components/booking-engine/BookingEngineWidget";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/LoginModal";

export default function EmbedPage() {
	const search = useSearchParams();
	const tenantId = search?.get("tenant") || process.env.NEXT_PUBLIC_TENANT_ID || "bLRLXrfr5pRBVcUntxUFlvXewaw1";
	const allowMulti = (search?.get("multi") || "1") === "1";
	const authParam = search?.get("auth"); // "1" or "0"
	const requireAuth = authParam !== "0"; // default require auth
	const { isAuthenticated } = useAuth();
	const [showLogin, setShowLogin] = useState(false);

	// Post height to parent for auto-resize
	useEffect(() => {
		function postHeight() {
			try {
				const height = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
				window.parent?.postMessage({ type: "booking-engine:height", height }, "*");
			} catch {}
		}
		postHeight();
		const ro = new ResizeObserver(() => postHeight());
		ro.observe(document.documentElement);
		window.addEventListener("load", postHeight);
		window.addEventListener("resize", postHeight);
		const id = window.setInterval(postHeight, 1000); // fallback
		return () => {
			ro.disconnect();
			window.removeEventListener("load", postHeight);
			window.removeEventListener("resize", postHeight);
			window.clearInterval(id);
		};
	}, []);

	// Trigger login modal when auth is required and user not logged in
	useEffect(() => {
		if (requireAuth && !isAuthenticated) {
			setShowLogin(true);
		} else {
			setShowLogin(false);
		}
	}, [requireAuth, isAuthenticated]);

	return (
		<div className="bg-white font-sans min-h-screen">
			<main className="px-4 sm:px-6 md:px-8 py-6">
				{(!requireAuth || isAuthenticated) && (
					<BookingEngineWidget tenantId={tenantId} allowMultiResource={allowMulti} requireAuth={requireAuth} source="iframe" />
				)}
				{showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
			</main>
		</div>
	);
}


