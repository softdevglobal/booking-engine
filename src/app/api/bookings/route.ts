import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emailService } from '@/lib/emailService';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const {
			customerId,
			customerName,
			customerEmail,
			customerPhone,
			eventType,
			selectedHall,
			bookingDate,
			startTime,
			endTime,
			additionalDescription,
			hallOwnerId,
			estimatedPrice,
			customerAvatar,
			guestCount,
			bookingSource = 'website',
		} = body;

		if (!customerName || !customerEmail || !customerPhone || !eventType || !selectedHall || !bookingDate || !startTime || !endTime || !hallOwnerId) {
			return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
		}
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(customerEmail)) return NextResponse.json({ message: 'Invalid email format' }, { status: 400 });

		const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
		const cleanedPhone = String(customerPhone).replace(/[\s\-\(\)]/g, '');
		if (!phoneRegex.test(cleanedPhone)) return NextResponse.json({ message: 'Invalid phone number format' }, { status: 400 });

		const bookingDateObj = new Date(bookingDate);
		const today = new Date(); today.setHours(0,0,0,0);
		if (isNaN(bookingDateObj.getTime())) return NextResponse.json({ message: 'Invalid booking date format' }, { status: 400 });
		if (bookingDateObj < today) return NextResponse.json({ message: 'Booking date cannot be in the past' }, { status: 400 });

		const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
		if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return NextResponse.json({ message: 'Invalid time format' }, { status: 400 });
		const startTimeObj = new Date(`2000-01-01T${startTime}:00`);
		const endTimeObj = new Date(`2000-01-01T${endTime}:00`);
		if (startTimeObj >= endTimeObj) return NextResponse.json({ message: 'Start time must be before end time' }, { status: 400 });

		const hallOwnerDocRef = doc(db, 'users', hallOwnerId);
		const hallOwnerDoc = await getDoc(hallOwnerDocRef);
		if (!hallOwnerDoc.exists() || hallOwnerDoc.data().role !== 'hall_owner') {
			return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
		}

		const hallDocRef = doc(db, 'resources', selectedHall);
		const hallDoc = await getDoc(hallDocRef);
		if (!hallDoc.exists()) return NextResponse.json({ message: 'Selected hall not found' }, { status: 404 });
		const hallData = hallDoc.data();
		if (hallData.hallOwnerId !== hallOwnerId) return NextResponse.json({ message: 'Selected hall does not belong to the specified hall owner' }, { status: 400 });

		const conflictingBookingsQuery = query(
			collection(db, 'bookings'),
			where('hallOwnerId', '==', hallOwnerId),
			where('selectedHall', '==', selectedHall),
			where('bookingDate', '==', bookingDate)
		);
		const conflictingBookingsSnapshot = await getDocs(conflictingBookingsQuery);
		for (const bookingDoc of conflictingBookingsSnapshot.docs) {
			const booking = bookingDoc.data() as any;
			if (!['pending', 'confirmed'].includes(booking.status)) continue;
			const existingStart = new Date(`2000-01-01T${booking.startTime}:00`);
			const existingEnd = new Date(`2000-01-01T${booking.endTime}:00`);
			if (startTimeObj < existingEnd && endTimeObj > existingStart) {
				return NextResponse.json({
					message: 'Time slot is already booked. Please choose a different time.',
					conflictingBooking: {
						bookingId: bookingDoc.id,
						startTime: booking.startTime,
						endTime: booking.endTime,
						customerName: booking.customerName,
						status: booking.status,
					},
					debug: {
						requestedTime: `${startTime} - ${endTime}`,
						bookedTime: `${booking.startTime} - ${booking.endTime}`,
						date: bookingDate,
						resource: hallData.name,
					},
				}, { status: 409 });
			}
		}

		let calculatedPrice = 0;
		let priceDetails: any = null;
		try {
			const pricingQuery = query(
				collection(db, 'pricing'),
				where('hallOwnerId', '==', hallOwnerId),
				where('resourceId', '==', selectedHall)
			);
			const pricingSnapshot = await getDocs(pricingQuery);
			if (!pricingSnapshot.empty) {
				const pricingData: any = pricingSnapshot.docs[0].data();
				const durationHours = (endTimeObj.getTime() - startTimeObj.getTime()) / (1000 * 60 * 60);
				const isWeekend = bookingDateObj.getDay() === 0 || bookingDateObj.getDay() === 6;
				const rate = isWeekend ? pricingData.weekendRate : pricingData.weekdayRate;
				calculatedPrice = pricingData.rateType === 'hourly' ? rate * durationHours : (durationHours >= 8 ? rate : rate * 0.5);
				priceDetails = {
					rateType: pricingData.rateType,
					weekdayRate: pricingData.weekdayRate,
					weekendRate: pricingData.weekendRate,
					appliedRate: rate,
					durationHours,
					isWeekend,
					calculationMethod: pricingData.rateType === 'hourly' ? 'hourly' : 'daily',
					frontendEstimatedPrice: estimatedPrice || null,
				};
			} else {
				calculatedPrice = estimatedPrice || 0;
			}
		} catch {
			calculatedPrice = estimatedPrice || 0;
		}

		const ymd = String(bookingDate).replace(/-/g, '');
		const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		function randomSuffix(len = 5) { let s = ''; for (let i = 0; i < len; i++) s += alphabet.charAt(Math.floor(Math.random() * alphabet.length)); return s; }
		async function createUniqueBookingCode(): Promise<string> {
			for (let i = 0; i < 12; i++) {
				const candidate = `BK-${ymd}-${randomSuffix(5)}`;
				const checkQ = query(collection(db, 'bookings'), where('bookingCode', '==', candidate));
				const check = await getDocs(checkQ);
				if (check.empty) return candidate;
			}
			throw new Error('Could not allocate a unique booking code');
		}
		let bookingCode: string | null = null;
		try { bookingCode = await createUniqueBookingCode(); } catch {}

		const preCreatedRef = doc(collection(db, 'bookings'));
		if (!bookingCode) bookingCode = `BK-${ymd}-${preCreatedRef.id.slice(-6).toUpperCase()}`;

		const bookingData = {
			customerId: customerId || null,
			customerName: String(customerName).trim(),
			customerEmail: String(customerEmail).toLowerCase().trim(),
			customerPhone: cleanedPhone,
			customerAvatar: customerAvatar || null,
			eventType,
			selectedHall,
			hallName: hallData.name,
			bookingDate,
			startTime,
			endTime,
			guestCount: guestCount || null,
			additionalDescription: additionalDescription || '',
			hallOwnerId,
			calculatedPrice,
			priceDetails,
			status: 'pending',
			bookingSource: bookingSource || 'website',
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
			bookingCode
		};

		await setDoc(preCreatedRef, bookingData);
		const docRef = preCreatedRef;

		try {
			await addDoc(collection(db, 'notifications'), {
				userId: hallOwnerId,
				type: 'new_booking',
				title: 'New Booking Request',
				message: `New booking request from ${customerName} for ${bookingDate}`,
				data: {
					bookingId: docRef.id,
					bookingCode,
					customerName,
					bookingDate,
					hallName: hallData.name,
				},
				isRead: false,
				createdAt: serverTimestamp(),
			});
		} catch {}

		try {
			await emailService.sendBookingConfirmationToCustomer({
				bookingId: docRef.id,
				bookingCode: bookingCode || undefined,
				customerName,
				customerEmail,
				eventType,
				hallName: hallData.name,
				bookingDate,
				startTime,
				endTime,
				guestCount,
				calculatedPrice,
			});
			const hallOwnerEmail = hallOwnerDoc.data()?.email;
			if (hallOwnerEmail) {
				await emailService.sendBookingNotificationToHallOwner({
					bookingId: docRef.id,
					bookingCode: bookingCode || undefined,
					customerName,
					customerEmail,
					customerPhone: cleanedPhone,
					eventType,
					hallName: hallData.name,
					bookingDate,
					startTime,
					endTime,
					guestCount,
					calculatedPrice,
					hallOwnerEmail
				});
			}
		} catch {}

		return NextResponse.json({
			message: 'Booking created successfully',
			bookingId: docRef.id,
			bookingCode,
			bookingSource: bookingSource || 'website',
			calculatedPrice,
			status: 'pending',
		});
	} catch (error: unknown) {
		return NextResponse.json({ message: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
	}
}


