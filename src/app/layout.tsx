"use client";
import React from "react";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
	const search = useSearchParams();
	const searchTenant = search?.get("tenant");
	const tenantId = searchTenant || process.env.NEXT_PUBLIC_TENANT_ID || "REPLACE_WITH_DEFAULT_HALL_OWNER_ID";
	return (
		<html lang="en">
			<body>
				<AuthProvider tenantId={tenantId}>
					{children}
				</AuthProvider>
			</body>
		</html>
	);
}


