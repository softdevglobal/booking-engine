"use client";
import React, { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import AuthFab from "@/components/AuthFab";

function TenantAuth({ children }: { children: React.ReactNode }) {
	const search = useSearchParams();
	const searchTenant = search?.get("tenant");
	const isEmbed = (search?.get("embed") === "1") || (search?.get("embed") === "true");
	const tenantId = searchTenant || process.env.NEXT_PUBLIC_TENANT_ID || "REPLACE_WITH_DEFAULT_HALL_OWNER_ID";
	return (
		<AuthProvider tenantId={tenantId}>
			{children}
			{!isEmbed && <AuthFab />}
		</AuthProvider>
	);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<Suspense fallback={null}>
					<TenantAuth>
						{children}
					</TenantAuth>
				</Suspense>
			</body>
		</html>
	);
}


