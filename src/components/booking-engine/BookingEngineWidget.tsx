"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "@/app/components/Calendar";
import { getPublicResources, getPublicPricing, createBooking, getPublicEventTypes, type ResourcesResponse, type ResourceItem, type PricingItem } from "./api";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/LoginModal";

export type BookingEngineWidgetProps = {
	tenantId: string;
	className?: string;
	requireAuth?: boolean;
	allowMultiResource?: boolean;
	source?: string;
};

type Address = {
	line1?: string;
	line2?: string;
	postcode?: string;
	state?: string;
} | string | null | undefined;

function formatAddress(address: Address): string {
	if (!address) return "Address not provided";
	if (typeof address === "string") return address;
	const parts: string[] = [];
	if (address.line1) parts.push(address.line1);
	if (address.line2) parts.push(address.line2);
	if (address.state) parts.push(address.state);
	if (address.postcode) parts.push(address.postcode);
	return parts.length ? parts.join(", ") : "Address not provided";
}

export default function BookingEngineWidget(props: BookingEngineWidgetProps) {
	const {
		tenantId,
		className,
		requireAuth = false,
		allowMultiResource = true,
		source = "website",
	} = props;

	const [resources, setResources] = useState<ResourceItem[]>([]);
	const [pricing, setPricing] = useState<PricingItem[]>([]);
	const [eventTypes, setEventTypes] = useState<string[]>([]);
	const [hallOwner, setHallOwner] = useState<ResourcesResponse["hallOwner"] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [selectedDates, setSelectedDates] = useState<Record<string, {day: number, month: number, year: number} | null>>({});
	const { isAuthenticated, user } = useAuth();
	const [showLoginModal, setShowLoginModal] = useState(false);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		phone: "",
		eventType: "",
		date: "",
		startTime: "",
		endTime: "",
		guests: "",
		resources: [] as string[],
		message: ""
	});

	// Fancy dropdown helpers (resources + event types)
	const [resourceOpen, setResourceOpen] = useState(false);
	const [resourceQuery, setResourceQuery] = useState("");
	const resourceRef = useRef<HTMLDivElement>(null);

	const [eventOpen, setEventOpen] = useState(false);
	const [eventQuery, setEventQuery] = useState("");
	const eventRef = useRef<HTMLDivElement>(null);

	// Prefill user details after login (and on initial load if already logged in)
	useEffect(() => {
		if (isAuthenticated && user) {
			setFormData(prev => ({
				...prev,
				name: prev.name || user.name || "",
				email: prev.email || user.email || "",
				phone: prev.phone || user.phone || ""
			}));
		}
	}, [isAuthenticated, user]);

	useEffect(() => {
		// If login is required for booking, prompt immediately when not authenticated
		if (requireAuth && !isAuthenticated) {
			setShowLoginModal(true);
		}
	}, [requireAuth, isAuthenticated]);

	useEffect(() => {
		let active = true;
		(async () => {
			try {
				setLoading(true);
				setError(null);
				const [resourcesResp, pricingResp, eventTypesResp] = await Promise.all([
					getPublicResources(tenantId),
					getPublicPricing(tenantId).catch(() => [] as PricingItem[]),
					getPublicEventTypes(tenantId).catch(() => [] as string[]),
				]);
				if (!active) return;
				setResources(resourcesResp.resources);
				setHallOwner(resourcesResp.hallOwner);
				setPricing(pricingResp);
				setEventTypes((resourcesResp.hallOwner?.eventTypes && resourcesResp.hallOwner.eventTypes.length > 0)
					? resourcesResp.hallOwner.eventTypes
					: eventTypesResp);
			} catch (e) {
				console.error(e);
				if (active) {
					setError("Failed to load data. Please try again later.");
					setResources([]);
					setPricing([]);
				}
			} finally {
				active && setLoading(false);
			}
		})();
		return () => { active = false; };
	}, [tenantId]);

	const getResourcePricing = (resourceId: string): PricingItem | null => {
		return pricing.find(p => p.resourceId === resourceId) || null;
	};

	const calculateEstimatedCost = (resourceId: string, startTime: string, endTime: string, bookingDate: string): number | null => {
		const resourcePricing = getResourcePricing(resourceId);
		if (!resourcePricing || !startTime || !endTime || !bookingDate) return null;
		const start = new Date(`2000-01-01T${startTime}:00`);
		const end = new Date(`2000-01-01T${endTime}:00`);
		const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
		const bookingDateObj = new Date(bookingDate);
		const isWeekend = bookingDateObj.getDay() === 0 || bookingDateObj.getDay() === 6;
		const rate = isWeekend ? resourcePricing.weekendRate : resourcePricing.weekdayRate;
		if (resourcePricing.rateType === "hourly") return rate * durationHours;
		return durationHours >= 8 ? rate : rate * 0.5;
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFormData(prev => ({ ...prev, [name]: value }));
	};

	const handleResourceChange = (resourceId: string, checked: boolean) => {
		setFormData(prev => {
			if (allowMultiResource) {
				return {
					...prev,
					resources: checked ? [...prev.resources, resourceId] : prev.resources.filter(id => id !== resourceId)
				};
			}
			return {
				...prev,
				resources: checked ? [resourceId] : []
			};
		});
	};

	// Filtered lists for dropdowns
	const filteredResources = useMemo(() => {
		const q = resourceQuery.trim().toLowerCase();
		if (!q) return resources;
		return resources.filter(r =>
			r.name.toLowerCase().includes(q) ||
			(r.type || "").toLowerCase().includes(q) ||
			(r.code || "").toLowerCase().includes(q)
		);
	}, [resources, resourceQuery]);

	const filteredEventTypes = useMemo(() => {
		const q = eventQuery.trim().toLowerCase();
		if (!q) return eventTypes;
		return (eventTypes || []).filter(et => et.toLowerCase().includes(q));
	}, [eventTypes, eventQuery]);

	// Close dropdowns on outside click / Escape
	useEffect(() => {
		function onClick(e: MouseEvent) {
			if (resourceOpen && resourceRef.current && !resourceRef.current.contains(e.target as Node)) {
				setResourceOpen(false);
			}
			if (eventOpen && eventRef.current && !eventRef.current.contains(e.target as Node)) {
				setEventOpen(false);
			}
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setResourceOpen(false);
				setEventOpen(false);
			}
		}
		document.addEventListener("click", onClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("click", onClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [resourceOpen, eventOpen]);

	const totalEstimated = useMemo(() => {
		if (!formData.date || !formData.startTime || !formData.endTime) return 0;
		return formData.resources.reduce((total, resourceId) => {
			const cost = calculateEstimatedCost(resourceId, formData.startTime, formData.endTime, formData.date);
			return total + (cost || 0);
		}, 0);
	}, [formData.date, formData.startTime, formData.endTime, formData.resources]);

	const handleDateSelect = (dateData: { day: number; month: number; year: number; resourceId?: string }) => {
		if (dateData.resourceId) {
			const resourceId = dateData.resourceId;
			setSelectedDates(prev => ({
				...prev,
				[resourceId]: { day: dateData.day, month: dateData.month, year: dateData.year }
			}));
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (requireAuth && !isAuthenticated) {
			setShowLoginModal(true);
			return;
		}
		if (formData.resources.length === 0) {
			alert("Please select at least one resource for your event.");
			return;
		}
		if (!formData.name || !formData.email || !formData.phone || !formData.eventType || !formData.date || !formData.startTime || !formData.endTime) {
			alert("Please fill in all required fields.");
			return;
		}
		setSubmitting(true);
		try {
			const selectedHall = formData.resources[0];
			const estimatedPrice = totalEstimated || calculateEstimatedCost(selectedHall, formData.startTime, formData.endTime, formData.date);
			const payload = {
				customerId: isAuthenticated ? user?.id : undefined,
				customerName: formData.name,
				customerEmail: formData.email,
				customerPhone: formData.phone,
				eventType: formData.eventType,
				selectedHall,
				selectedHalls: formData.resources,
				bookingDate: formData.date,
				startTime: formData.startTime,
				endTime: formData.endTime,
				additionalDescription: formData.message,
				hallOwnerId: tenantId,
				estimatedPrice: estimatedPrice ?? undefined,
				guestCount: formData.guests,
				bookingSource: source || "website",
				customerAvatar: undefined,
			};
			if (isAuthenticated && user?.avatar) (payload as any).customerAvatar = user.avatar;
			const result = await createBooking(payload as any);
			const priceMessage = estimatedPrice ? ` Estimated cost: $${estimatedPrice.toFixed(2)}.` : "";
			const bookingCode = (result as any).bookingCode ? `\nYour booking code: ${(result as any).bookingCode}` : "";
			const sourceInfo = result.bookingSource ? `\nSource: ${result.bookingSource}` : "";
			alert(`Thank you for your booking request!${priceMessage}${bookingCode}${sourceInfo} We'll get back to you soon with confirmation.`);
			setFormData({
				name: "",
				email: "",
				phone: "",
				eventType: "",
				date: "",
				startTime: "",
				endTime: "",
				guests: "",
				resources: [],
				message: ""
			});
		} catch (err: any) {
			alert(`Error submitting booking: ${err?.message || "Unknown error"}`);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className={className}>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
				<div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 order-2 lg:order-1">
					<h2 className="text-2xl font-bold text-[#181411] mb-6">Booking Request</h2>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label htmlFor="name" className="block text-sm font-medium text-[#181411] mb-2">Full Name *</label>
								<input type="text" id="name" name="name" required value={formData.name} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 text-[#181411] bg-white" placeholder="Your full name" />
							</div>
							<div>
								<label htmlFor="email" className="block text-sm font-medium text-[#181411] mb-2">Email Address *</label>
								<input type="email" id="email" name="email" required value={formData.email} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 text-[#181411] bg-white" placeholder="your@email.com" />
							</div>
						</div>
						<div>
							<label htmlFor="phone" className="block text-sm font-medium text-[#181411] mb-2">Phone Number *</label>
							<input type="tel" id="phone" name="phone" required value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 text-[#181411] bg-white" placeholder="Your phone number" />
						</div>
						<div ref={eventRef} className="relative">
							<label className="block text-sm font-medium text-[#181411] mb-2">Event Type *</label>
							<button
								type="button"
								onClick={() => setEventOpen(v => !v)}
								className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors"
								aria-haspopup="listbox"
								aria-expanded={eventOpen}
							>
								<span className={`truncate ${formData.eventType ? "text-[#181411]" : "text-[#897561]"}`}>
									{formData.eventType || "Select event type"}
								</span>
								<svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>
							{eventOpen && (
								<div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
									<div className="p-2 border-b border-gray-200 bg-gray-50">
										<input
											type="text"
											placeholder="Search event types..."
											value={eventQuery}
											onChange={(e) => setEventQuery(e.target.value)}
											className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-300 bg-white"
										/>
									</div>
									<ul role="listbox" className="max-h-60 overflow-auto">
										{filteredEventTypes.length === 0 && (
											<li className="px-4 py-3 text-sm text-[#897561]">No matches</li>
										)}
										{filteredEventTypes.map(et => (
											<li key={et}>
												<button
													type="button"
													onClick={() => { setFormData(prev => ({ ...prev, eventType: et })); setEventOpen(false); }}
													className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${formData.eventType === et ? "bg-blue-50 text-blue-800" : "text-[#181411]"}`}
													role="option"
													aria-selected={formData.eventType === et}
												>
													<span className="inline-flex items-center gap-2">
														<span className="inline-block w-2 h-2 rounded-full bg-[#ec8013]" />
														{et}
													</span>
												</button>
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
						<div ref={resourceRef} className="relative">
							<label className="block text-sm font-medium text-[#181411] mb-2">Select Resource(s) *</label>
							{loading ? (
								<div className="text-center py-4">
									<p className="text-[#897561]">Loading resources...</p>
								</div>
							) : error ? (
								<div className="text-center py-4">
									<p className="text-red-600">{error}</p>
								</div>
							) : (
								<div>
									<button
										type="button"
										onClick={() => setResourceOpen(v => !v)}
										className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors"
										aria-haspopup="listbox"
										aria-expanded={resourceOpen}
									>
										<span className={`truncate ${formData.resources.length > 0 ? "text-[#181411]" : "text-[#897561]"}`}>
											{formData.resources.length === 0 ? (
												"Select one or more resources"
											) : (
												<div className="flex flex-wrap gap-2">
													{formData.resources.map((rid) => {
														const r = resources.find(x => x.id === rid);
														return (
															<span key={rid} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2 py-1">
																<span className="font-medium">{r?.name || rid}</span>
																<button
																	type="button"
																	className="ml-1 text-blue-700 hover:text-blue-900"
																	onClick={(e) => { e.stopPropagation(); handleResourceChange(rid, false); }}
																	aria-label="Remove"
																>
																	×
																</button>
															</span>
														);
													})}
												</div>
											)}
										</span>
										<svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
										</svg>
									</button>
									{resourceOpen && (
										<div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
											<div className="p-2 border-b border-gray-200 bg-gray-50">
												<input
													type="text"
													placeholder="Search resources..."
													value={resourceQuery}
													onChange={(e) => setResourceQuery(e.target.value)}
													className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-300 bg-white"
												/>
											</div>
											<ul role="listbox" className="max-h-72 overflow-auto divide-y divide-gray-100">
												{filteredResources.length === 0 && (
													<li className="px-4 py-3 text-sm text-[#897561]">No matches</li>
												)}
												{filteredResources.map(r => (
													<li key={r.id} className="hover:bg-gray-50 transition-colors">
														<button
															type="button"
															className="w-full text-left px-4 py-3"
															onClick={() => handleResourceChange(r.id, !formData.resources.includes(r.id))}
															role="option"
															aria-selected={formData.resources.includes(r.id)}
														>
															<div className="flex items-center gap-3">
																<div className="w-5 h-5 border rounded-sm flex items-center justify-center">
																	{formData.resources.includes(r.id) && <span className="w-3 h-3 bg-blue-600 inline-block rounded-sm" />}
																</div>
																<div className="min-w-0 flex-1">
																	<div className="flex items-center gap-2">
																		<span className="text-sm font-medium text-[#181411] truncate">{r.name}</span>
																		<span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 capitalize">{r.type}</span>
																	</div>
																	<div className="text-xs text-[#897561] flex gap-3 mt-0.5">
																		{typeof r.capacity === "number" && <span>{r.capacity} ppl</span>}
																		{r.code && <span className="font-mono">#{r.code}</span>}
																	</div>
																</div>
															</div>
														</button>
													</li>
												))}
											</ul>
											<div className="p-2 border-t border-gray-200 bg-gray-50 text-right">
												<button
													type="button"
													onClick={() => setResourceOpen(false)}
													className="inline-flex items-center px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200 text-[#181411]"
												>
													Done
												</button>
											</div>
										</div>
									)}

									{/* Selected resource preview */}
									{formData.resources[0] && (
										(() => {
											const selected = resources.find(r => r.id === formData.resources[0]);
											if (!selected) return null;
											return (
												<div className="mt-3 border border-gray-200 rounded-lg p-3">
													{selected.imageUrl ? (
														<img
															src={selected.imageUrl}
															alt={`${selected.name} image`}
															className="w-full h-48 object-cover rounded-md mb-3"
														/>
													) : (
														<p className="text-sm text-[#897561] mb-2">No image available for this resource.</p>
													)}
													<div className="text-xs text-[#897561] flex flex-wrap gap-4">
														<span>Capacity: {selected.capacity} people</span>
														<span>Type: {selected.type.charAt(0).toUpperCase() + selected.type.slice(1)}</span>
														<span>Code: {selected.code}</span>
													</div>
													{getResourcePricing(selected.id) && (
														<div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
															<div className="text-sm font-medium text-green-800 mb-1">Pricing:</div>
															<div className="text-xs text-green-700">
																<div>Weekday: ${getResourcePricing(selected.id)?.weekdayRate}/{getResourcePricing(selected.id)?.rateType}</div>
																<div>Weekend: ${getResourcePricing(selected.id)?.weekendRate}/{getResourcePricing(selected.id)?.rateType}</div>
															</div>
														</div>
													)}
												</div>
											);
										})()
									)}
								</div>
							)}
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label htmlFor="date" className="block text-sm font-medium text-[#181411] mb-2">Preferred Date *</label>
								<input type="date" id="date" name="date" required value={formData.date} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 text-[#181411] bg-white" />
							</div>
							<div>
								<label htmlFor="guests" className="block text-sm font-medium text-[#181411] mb-2">Number of Guests *</label>
								<input type="number" id="guests" name="guests" required min={1} value={formData.guests} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 text-[#181411] bg-white" placeholder="Expected guests" />
							</div>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label htmlFor="startTime" className="block text-sm font-medium text-[#181411] mb-2">Start Time *</label>
								<input type="time" id="startTime" name="startTime" required value={formData.startTime} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 text-[#181411] bg-white" />
							</div>
							<div>
								<label htmlFor="endTime" className="block text-sm font-medium text-[#181411] mb-2">End Time *</label>
								<input type="time" id="endTime" name="endTime" required value={formData.endTime} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 text-[#181411] bg-white" />
							</div>
						</div>
						{formData.resources.length > 0 && formData.date && formData.startTime && formData.endTime && (
							<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
								<h4 className="text-lg font-semibold text-blue-900 mb-3">Estimated Cost</h4>
								<div className="space-y-2">
									{formData.resources.map((resourceId) => {
										const resource = resources.find(r => r.id === resourceId);
										const estimatedCost = calculateEstimatedCost(resourceId, formData.startTime, formData.endTime, formData.date);
										const resourcePricing = getResourcePricing(resourceId);
										if (!resource || !estimatedCost || !resourcePricing) return null;
										return (
											<div key={resourceId} className="flex justify-between items-center text-sm">
												<span className="text-blue-800">{resource.name}:</span>
												<span className="font-semibold text-blue-900">${estimatedCost.toFixed(2)}</span>
											</div>
										);
									})}
									{formData.resources.length > 1 && (
										<div className="border-t border-blue-300 pt-2 mt-2">
											<div className="flex justify-between items-center font-semibold text-blue-900">
												<span>Total Estimated Cost:</span>
												<span>${totalEstimated.toFixed(2)}</span>
											</div>
										</div>
									)}
								</div>
								<p className="text-xs text-blue-700 mt-2">* This is an estimate. Final pricing may vary based on specific requirements and availability.</p>
							</div>
						)}
						<button type="submit" disabled={submitting} className={`w-full font-bold py-4 px-6 rounded-lg transition-colors text-lg ${submitting ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-[#e63946] text-white hover:bg-[#d62839]"}`}>
							{submitting ? "Submitting..." : "Submit Booking Request"}
						</button>
					</form>
				</div>

				<div className="space-y-6 order-1 lg:order-2">
					<div className="bg-white rounded-2xl shadow-lg p-6">
						<h3 className="text-xl font-bold text-[#181411] mb-4 text-center">Check Availability</h3>
						{formData.resources.length > 0 ? (
							<div className="space-y-6">
								{formData.resources.map((resourceId) => {
									const resource = resources.find(r => r.id === resourceId);
									if (!resource) return null;
									return (
										<div key={resourceId} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
											<div className="flex justify-center">
												<Calendar
													resourceId={resourceId}
													resourceName={resource.name}
													hallOwnerId={tenantId}
													onDateSelect={handleDateSelect}
												/>
											</div>
											{selectedDates[resourceId] && (
												<div className="mt-3 text-center">
													<p className="text-sm text-[#897561]">
														Selected date for {resource.name}: {selectedDates[resourceId]?.day}/{(selectedDates[resourceId]?.month ?? 0) + 1}/{selectedDates[resourceId]?.year}
													</p>
												</div>
											)}
										</div>
									);
								})}
							</div>
						) : (
							<div className="text-center py-8">
								<p className="text-[#897561] mb-4">Select resources above to view their availability calendars</p>
								<div className="flex justify-center">
									<Calendar hallOwnerId={tenantId} />
								</div>
							</div>
						)}
					</div>

					<div className="bg-white rounded-2xl shadow-lg p-6">
						<h3 className="text-xl font-bold text-[#181411] mb-4">Contact Information</h3>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 bg-[#ec8013] rounded-full flex items-center justify-center">
									<svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
										<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
									</svg>
								</div>
								<span className="text-[#181411]">{hallOwner?.phone || ""}</span>
							</div>
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 bg-[#ec8013] rounded-full flex items-center justify-center">
									<svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
										<path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
									</svg>
								</div>
								<span className="text-[#181411]">{hallOwner?.email || ""}</span>
							</div>
							<div className="flex items-start gap-3">
								<div className="w-8 h-8 bg-[#ec8013] rounded-full flex items-center justify-center mt-1">
									<svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
										<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
									</svg>
								</div>
								<span className="text-[#181411]">{formatAddress(hallOwner?.address || null)}</span>
							</div>
						</div>
					</div>

					<div className="bg-white rounded-2xl shadow-lg p-6">
						<h3 className="text-xl font-bold text-[#181411] mb-4">Pricing</h3>
						{pricing.length > 0 ? (
							<div className="space-y-4">
								{pricing.map((price) => {
									const resource = resources.find(r => r.id === price.resourceId);
									if (!resource) return null;
									return (
										<div key={price.id} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
											<h4 className="font-semibold text-[#181411] mb-2">{resource.name}</h4>
											<div className="text-sm text-[#181411] space-y-1">
												<div className="flex justify-between">
													<span>Weekday ({price.rateType}):</span>
													<span className="font-medium">${price.weekdayRate}</span>
												</div>
												<div className="flex justify-between">
													<span>Weekend ({price.rateType}):</span>
													<span className="font-medium">${price.weekendRate}</span>
												</div>
												{price.description && <p className="text-xs text-[#897561] mt-1">{price.description}</p>}
											</div>
										</div>
									);
								})}
								<p className="text-sm text-[#897561] mt-3">* Prices may vary based on event type and requirements. Contact us for custom quotes.</p>
							</div>
						) : (
							<div className="space-y-2 text-[#181411]">
								<p className="text-sm text-[#897561] mt-3">Pricing will appear here once configured.</p>
							</div>
						)}
					</div>
				</div>
				{showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} onSuccess={() => setShowLoginModal(false)} />}
			</div>
		</div>
	);
}


