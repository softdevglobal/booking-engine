export type ResourceItem = {
	id: string;
	name: string;
	type: string;
	capacity: number;
	code: string;
	description?: string;
	hallOwnerId: string;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export type PricingItem = {
	id: string;
	resourceId: string;
	resourceName: string;
	rateType: 'hourly' | 'daily';
	weekdayRate: number;
	weekendRate: number;
	description?: string;
	hallOwnerId: string;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export type UnavailableEntry = {
	bookingId: string;
	startTime: string;
	endTime: string;
	customerName: string;
	eventType: string;
	status: string;
};

export type UnavailableDatesResponse = {
	unavailableDates: Record<string, Record<string, UnavailableEntry[]>>;
	totalBookings: number;
	message: string;
};

export type ResourcesResponse = {
	resources: ResourceItem[];
	hallOwner: {
		name: string;
		address: unknown;
		phone: string;
		email: string;
		businessName: string;
	};
};

export type CreateBookingRequest = {
	customerId?: string | null;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	eventType: string;
	selectedHall: string;
	bookingDate: string;
	startTime: string;
	endTime: string;
	additionalDescription?: string;
	hallOwnerId: string;
	estimatedPrice?: number | null;
	customerAvatar?: string | null;
	guestCount?: string | number | null;
	bookingSource?: string;
};

export type CreateBookingResponse = {
	message: string;
	bookingId: string;
	bookingCode?: string;
	bookingSource?: string;
	calculatedPrice?: number;
	status: string;
};

async function handleJson<T>(res: Response): Promise<T> {
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = (data as any)?.message || (data as any)?.error || `${res.status} ${res.statusText}`;
		throw new Error(typeof msg === 'string' ? msg : 'Request failed');
	}
	return data as T;
}

export async function getPublicResources(tenantId: string): Promise<ResourcesResponse> {
	const res = await fetch(`/api/resources/public/${tenantId}`, { method: 'GET' });
	return handleJson<ResourcesResponse>(res);
}

export async function getPublicPricing(tenantId: string): Promise<PricingItem[]> {
	const res = await fetch(`/api/pricing/public/${tenantId}`, { method: 'GET' });
	return handleJson<PricingItem[]>(res);
}

export async function getUnavailableDates(tenantId: string, params?: { resourceId?: string; startDate?: string; endDate?: string; }): Promise<UnavailableDatesResponse> {
	const usp = new URLSearchParams();
	if (params?.resourceId) usp.set('resourceId', String(params.resourceId));
	if (params?.startDate) usp.set('startDate', String(params.startDate));
	if (params?.endDate) usp.set('endDate', String(params.endDate));
	const q = usp.toString();
	const res = await fetch(`/api/bookings/unavailable-dates/${tenantId}${q ? `?${q}` : ''}`, { method: 'GET' });
	return handleJson<UnavailableDatesResponse>(res);
}

export async function createBooking(payload: CreateBookingRequest): Promise<CreateBookingResponse> {
	const res = await fetch('/api/bookings', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return handleJson<CreateBookingResponse>(res);
}


