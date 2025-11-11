import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

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

		const userDocRef = doc(db, 'users', hallOwnerId);
		const userDoc = await getDoc(userDocRef);
		if (!userDoc.exists() || userDoc.data()?.role !== 'hall_owner') {
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
			if (resourceId && b.selectedHall !== resourceId) return false;
			if (startDate && b.bookingDate < startDate) return false;
			if (endDate && b.bookingDate > endDate) return false;
			return true;
		});

		const unavailableDates: Record<string, Record<string, any[]>> = {};
		filteredBookings.forEach((d) => {
			const b: any = d.data();
			const bookingDate = b.bookingDate;
			const selectedHall = b.selectedHall;
			if (!bookingDate || !selectedHall) return;
			if (!unavailableDates[bookingDate]) unavailableDates[bookingDate] = {};
			if (!unavailableDates[bookingDate][selectedHall]) unavailableDates[bookingDate][selectedHall] = [];
			unavailableDates[bookingDate][selectedHall].push({
				bookingId: d.id,
				startTime: b.startTime || 'N/A',
				endTime: b.endTime || 'N/A',
				customerName: b.customerName || 'Unknown',
				eventType: b.eventType || 'Unknown',
				status: b.status || 'Unknown',
			});
		});

		return NextResponse.json({
			unavailableDates,
			totalBookings: filteredBookings.length,
			message: 'Successfully fetched unavailable dates'
		});
	} catch (error: unknown) {
		return NextResponse.json({ message: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
	}
}


