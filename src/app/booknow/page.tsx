"use client";
import React from "react";
import BookingEngineWidget from "@/components/booking-engine/BookingEngineWidget";

export default function BookNowPage() {
	const tenantId = "bLRLXrfr5pRBVcUntxUFlvXewaw1";
	return (
		<div className="bg-white font-sans min-h-screen flex flex-col">
			<main className="flex-1 pt-24 px-4 sm:px-8 md:px-12 lg:px-20">
				<div className="max-w-6xl mx-auto">
					<div className="text-center mb-8">
						<h1 className="text-4xl sm:text-5xl font-black text-[#181411] mb-4">
							Book Your Event
						</h1>
						<p className="text-lg text-[#897561] max-w-2xl mx-auto mb-4">
							Reserve our venue for your special occasion. Fill out the form below and we&apos;ll get back to you within 24 hours.
						</p>
					</div>
					<BookingEngineWidget tenantId={tenantId} requireAuth />
				</div>
			</main>
		</div>
	);
}


