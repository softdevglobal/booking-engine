"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/LoginModal";

export default function Page() {
	const router = useRouter();
	const { isAuthenticated } = useAuth();
	const [showLogin, setShowLogin] = useState(false);

	const handleBookNow = () => {
		if (isAuthenticated) {
			router.push("/booknow");
		} else {
			setShowLogin(true);
		}
	};

	return (
		<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf7f2" }}>
			<div style={{ maxWidth: 960, width: "100%", padding: 24 }}>
				<div style={{ textAlign: "center", marginBottom: 24 }}>
					<h1 style={{ fontSize: 48, fontWeight: 900, color: "#181411", margin: 0 }}>Welcome</h1>
					<p style={{ fontSize: 18, color: "#897561", marginTop: 12 }}>
						Plan your event with ease. Check availability, estimate pricing, and request a booking.
					</p>
				</div>
				<div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
					<button
						onClick={handleBookNow}
						style={{
							background: "#e63946",
							color: "#fff",
							padding: "14px 28px",
							borderRadius: 8,
							fontWeight: 800,
							border: 0,
							cursor: "pointer"
						}}
					>
						Book Now
					</button>
				</div>
				{showLogin && (
					<LoginModal
						onClose={() => setShowLogin(false)}
						onSuccess={() => {
							setShowLogin(false);
							router.push("/booknow");
						}}
					/>
				)}
			</div>
		</div>
	);
}


