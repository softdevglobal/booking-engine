import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isAdminConfigured } from '@/lib/firebaseAdmin';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ hallOwnerId: string }> }
) {
	try {
		const { hallOwnerId } = await context.params;
		const { searchParams } = new URL(request.url);
		const resourceId = searchParams.get('resourceId');
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');

		if (isAdminConfigured) {
			const userDoc = await adminDb.collection('users').doc(hallOwnerId).get();
			if (!userDoc.exists || (userDoc.data() as any)?.role !== 'hall_owner') {
				return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
			}

			const bookingsSnapshot = await adminDb
				.collection('bookings')
				.where('hallOwnerId', '==', hallOwnerId)
				.get();

			const filteredBookings = bookingsSnapshot.docs.filter((d: any) => {
				const b: any = d.data();
				if (!['pending', 'confirmed'].includes(b.status)) return false;
				if (resourceId) {
					const bResources = Array.isArray(b.selectedHalls) && b.selectedHalls.length > 0
						? (b.selectedHalls as string[]).map(String)
						: [b.selectedHall].filter(Boolean).map(String);
					if (!bResources.includes(String(resourceId))) return false;
				}
				if (startDate && b.bookingDate < startDate) return false;
				if (endDate && b.bookingDate > endDate) return false;
				return true;
			});

			const unavailableDates: Record<string, Record<string, any[]>> = {};
			filteredBookings.forEach((d) => {
				const b: any = d.data();
				const bookingDate = b.bookingDate;
				const resources = (Array.isArray(b.selectedHalls) && b.selectedHalls.length > 0
					? (b.selectedHalls as string[]).map(String)
					: [b.selectedHall].filter(Boolean).map(String));
				if (!bookingDate || resources.length === 0) return;
				if (!unavailableDates[bookingDate]) unavailableDates[bookingDate] = {};
				for (const resId of resources) {
					if (!unavailableDates[bookingDate][resId]) unavailableDates[bookingDate][resId] = [];
					unavailableDates[bookingDate][resId].push({
						bookingId: d.id as string,
						startTime: b.startTime || 'N/A',
						endTime: b.endTime || 'N/A',
						customerName: b.customerName || 'Unknown',
						eventType: b.eventType || 'Unknown',
						status: b.status || 'Unknown',
					});
				}
			});

			return NextResponse.json({
				unavailableDates,
				totalBookings: filteredBookings.length,
				message: 'Successfully fetched unavailable dates'
			});
		} else {
			// Fallback to client SDK
			const userDocRef = doc(db, 'users', hallOwnerId);
			const userDoc = await getDoc(userDocRef);
			if (!userDoc.exists() || (userDoc.data() as any)?.role !== 'hall_owner') {
				return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
			}
			const bookingsQuery = query(
				collection(db, 'bookings'),
				where('hallOwnerId', '==', hallOwnerId)
			);
			const bookingsSnapshot = await getDocs(bookingsQuery);
			const filteredBookings = bookingsSnapshot.docs.filter((d) => {
				const b: any = d.data();
				if (!['pending', 'confirmed'].includes(b.status)) return false;
				if (resourceId) {
					const bResources = Array.isArray(b.selectedHalls) && b.selectedHalls.length > 0
						? (b.selectedHalls as string[]).map(String)
						: [b.selectedHall].filter(Boolean).map(String);
					if (!bResources.includes(String(resourceId))) return false;
				}
				if (startDate && b.bookingDate < startDate) return false;
				if (endDate && b.bookingDate > endDate) return false;
				return true;
			});
			const unavailableDates: Record<string, Record<string, any[]>> = {};
			filteredBookings.forEach((docSnap) => {
				const b: any = docSnap.data();
				const bookingDate = b.bookingDate;
				const resources = (Array.isArray(b.selectedHalls) && b.selectedHalls.length > 0
					? (b.selectedHalls as string[]).map(String)
					: [b.selectedHall].filter(Boolean).map(String));
				if (!bookingDate || resources.length === 0) return;
				if (!unavailableDates[bookingDate]) unavailableDates[bookingDate] = {};
				for (const resId of resources) {
					if (!unavailableDates[bookingDate][resId]) unavailableDates[bookingDate][resId] = [];
					unavailableDates[bookingDate][resId].push({
						bookingId: docSnap.id,
						startTime: b.startTime || 'N/A',
						endTime: b.endTime || 'N/A',
						customerName: b.customerName || 'Unknown',
						eventType: b.eventType || 'Unknown',
						status: b.status || 'Unknown',
					});
				}
			});
			return NextResponse.json({
				unavailableDates,
				totalBookings: filteredBookings.length,
				message: 'Successfully fetched unavailable dates'
			});
		}
	} catch (error: unknown) {
		return NextResponse.json({ message: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
	}
}


