import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue, isAdminConfigured } from '@/lib/firebaseAdmin';
import { emailService } from '@/lib/emailService';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	const body = await request.json().catch(() => null);
	if (!body) return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });

	const {
		customerId,
		customerName,
		customerEmail,
		customerPhone,
		eventType,
		selectedHall,
		selectedHalls: selectedHallsInput,
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

	// Normalize resources
	let selectedHalls: string[] = [];
	if (Array.isArray(selectedHallsInput) && selectedHallsInput.length > 0) {
		selectedHalls = selectedHallsInput.filter(Boolean).map(String);
	} else if (selectedHall) {
		selectedHalls = [String(selectedHall)];
	}

	// Basic validation (shared)
	if (!customerName || !customerEmail || !customerPhone || !eventType || selectedHalls.length === 0 || !bookingDate || !startTime || !endTime || !hallOwnerId) {
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

	// Prefer Admin SDK when configured; otherwise use client SDK fallback
	if (isAdminConfigured) {
		try {
			// Admin SDK path
			// If authenticated customer provided, enforce tenant match
			if (customerId) {
				const custSnap = await adminDb.collection('customers').doc(String(customerId)).get();
				if (!custSnap.exists || (custSnap.data() as any)?.tenantId !== hallOwnerId) {
					return NextResponse.json(
						{ message: 'Account does not belong to this hall. Please login/register for this venue.' },
						{ status: 403 }
					);
				}
			}

			const hallOwnerDoc = await adminDb.collection('users').doc(hallOwnerId).get();
			if (!hallOwnerDoc.exists || (hallOwnerDoc.data() as any).role !== 'hall_owner') {
				return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
			}

			// Verify all selected resources
			const hallNames: string[] = [];
			for (const resId of selectedHalls) {
				const hDoc = await adminDb.collection('resources').doc(resId).get();
				if (!hDoc.exists) return NextResponse.json({ message: `Selected resource not found: ${resId}` }, { status: 404 });
				const hData = hDoc.data() as any;
				if (hData.hallOwnerId !== hallOwnerId) return NextResponse.json({ message: `Selected resource does not belong to the specified hall owner: ${resId}` }, { status: 400 });
				hallNames.push(hData.name || resId);
			}

			const conflictingBookingsSnapshot = await adminDb
				.collection('bookings')
				.where('hallOwnerId', '==', hallOwnerId)
				.where('bookingDate', '==', bookingDate)
				.get();
			for (const bookingDoc of conflictingBookingsSnapshot.docs) {
				const booking = bookingDoc.data() as any;
				if (!['pending', 'confirmed'].includes(booking.status)) continue;
				const existingStart = new Date(`2000-01-01T${booking.startTime}:00`);
				const existingEnd = new Date(`2000-01-01T${booking.endTime}:00`);
				const bookingResources = Array.isArray(booking.selectedHalls) && booking.selectedHalls.length > 0
					? (booking.selectedHalls as string[]).map(String)
					: [booking.selectedHall].filter(Boolean).map(String);
				const intersects = bookingResources.some(r => selectedHalls.includes(r));
				if (intersects && startTimeObj < existingEnd && endTimeObj > existingStart) {
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
							resource: 'one or more selected resources',
						},
					}, { status: 409 });
				}
			}

			let calculatedPrice = 0;
			let priceDetails: any = null;
			try {
				const durationHours = (endTimeObj.getTime() - startTimeObj.getTime()) / (1000 * 60 * 60);
				const isWeekend = bookingDateObj.getDay() === 0 || bookingDateObj.getDay() === 6;
				const breakdown: any[] = [];
				for (const resId of selectedHalls) {
					const pricingSnapshot = await adminDb
						.collection('pricing')
						.where('hallOwnerId', '==', hallOwnerId)
						.where('resourceId', '==', resId)
						.get();
					if (!pricingSnapshot.empty) {
						const pricingData: any = pricingSnapshot.docs[0].data();
						const rate = isWeekend ? pricingData.weekendRate : pricingData.weekdayRate;
						const resPrice = pricingData.rateType === 'hourly' ? rate * durationHours : (durationHours >= 8 ? rate : rate * 0.5);
						calculatedPrice += Number(resPrice || 0);
						breakdown.push({
							resourceId: resId,
							weekdayRate: pricingData.weekdayRate,
							weekendRate: pricingData.weekendRate,
							rateType: pricingData.rateType,
							appliedRate: rate,
							durationHours,
							isWeekend,
							calculatedPrice: resPrice
						});
					}
				}
				if (breakdown.length > 0) {
					priceDetails = {
						multiResource: true,
						breakdown,
						total: calculatedPrice,
						calculationMethod: 'sum_per_resource',
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
					const check = await adminDb.collection('bookings').where('bookingCode', '==', candidate).get();
					if (check.empty) return candidate;
				}
				throw new Error('Could not allocate a unique booking code');
			}
			let bookingCode: string | null = null;
			try { bookingCode = await createUniqueBookingCode(); } catch {}

			const preCreatedRef = adminDb.collection('bookings').doc();
			if (!bookingCode) bookingCode = `BK-${ymd}-${preCreatedRef.id.slice(-6).toUpperCase()}`;

			const bookingData = {
				customerId: customerId || null,
				customerName: String(customerName).trim(),
				customerEmail: String(customerEmail).toLowerCase().trim(),
				customerPhone: cleanedPhone,
				customerAvatar: customerAvatar || null,
				eventType,
				selectedHall: selectedHalls[0],
				hallName: hallNames[0],
				selectedHalls,
				hallNames,
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
				createdAt: FieldValue.serverTimestamp(),
				updatedAt: FieldValue.serverTimestamp(),
				bookingCode
			};

			await preCreatedRef.set(bookingData);
			const docRef = preCreatedRef;

			try {
				await adminDb.collection('notifications').add({
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
					createdAt: FieldValue.serverTimestamp(),
				});
			} catch {}

			try {
				await emailService.sendBookingConfirmationToCustomer({
					bookingId: docRef.id,
					bookingCode: bookingCode || undefined,
					customerName,
					customerEmail,
					eventType,
					hallName: hallNames[0],
					bookingDate,
					startTime,
					endTime,
					guestCount,
					calculatedPrice,
				});
				const hallOwnerEmail = (hallOwnerDoc.data() as any)?.email;
				if (hallOwnerEmail) {
					await emailService.sendBookingNotificationToHallOwner({
						bookingId: docRef.id,
						bookingCode: bookingCode || undefined,
						customerName,
						customerEmail,
						customerPhone: cleanedPhone,
						eventType,
						hallName: hallNames[0],
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
		} catch {
			// If Admin path fails, fall through to client SDK path
		}
	}

	// Fallback to client SDK path (no Admin SDK or admin failed)
	try {
		// Validate hall owner and hall via client SDK
		const hallOwnerDocRef = doc(db, 'users', hallOwnerId);
		const hallOwnerDoc = await getDoc(hallOwnerDocRef);
		if (!hallOwnerDoc.exists() || (hallOwnerDoc.data() as any).role !== 'hall_owner') {
			return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
		}

		// Verify all selected resources
		const hallNames: string[] = [];
		for (const resId of selectedHalls) {
			const hRef = doc(db, 'resources', resId);
			const hDoc = await getDoc(hRef);
			if (!hDoc.exists()) return NextResponse.json({ message: `Selected resource not found: ${resId}` }, { status: 404 });
			const hData = hDoc.data() as any;
			if (hData.hallOwnerId !== hallOwnerId) return NextResponse.json({ message: `Selected resource does not belong to the specified hall owner: ${resId}` }, { status: 400 });
			hallNames.push(hData.name || resId);
		}

		// Conflict check across any selected resource
		const conflictingBookingsQuery = query(
			collection(db, 'bookings'),
			where('hallOwnerId', '==', hallOwnerId),
			where('bookingDate', '==', bookingDate)
		);
		const conflictingBookingsSnapshot = await getDocs(conflictingBookingsQuery);
		for (const bookingDoc of conflictingBookingsSnapshot.docs) {
			const booking = bookingDoc.data() as any;
			if (!['pending', 'confirmed'].includes(booking.status)) continue;
			const existingStart = new Date(`2000-01-01T${booking.startTime}:00`);
			const existingEnd = new Date(`2000-01-01T${booking.endTime}:00`);
			const bookingResources = Array.isArray(booking.selectedHalls) && booking.selectedHalls.length > 0
				? (booking.selectedHalls as string[]).map(String)
				: [booking.selectedHall].filter(Boolean).map(String);
			const intersects = bookingResources.some(r => selectedHalls.includes(r));
			if (intersects && startTimeObj < existingEnd && endTimeObj > existingStart) {
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
						resource: 'one or more selected resources',
					},
				}, { status: 409 });
			}
		}

		let calculatedPrice = 0;
		try {
			const durationHours = (endTimeObj.getTime() - startTimeObj.getTime()) / (1000 * 60 * 60);
			const isWeekend = bookingDateObj.getDay() === 0 || bookingDateObj.getDay() === 6;
			for (const resId of selectedHalls) {
				const pricingQuery = query(
					collection(db, 'pricing'),
					where('hallOwnerId', '==', hallOwnerId),
					where('resourceId', '==', resId)
				);
				const pricingSnapshot = await getDocs(pricingQuery);
				if (!pricingSnapshot.empty) {
					const pricingData: any = pricingSnapshot.docs[0].data();
					const rate = isWeekend ? pricingData.weekendRate : pricingData.weekdayRate;
					const resPrice = pricingData.rateType === 'hourly' ? rate * durationHours : (durationHours >= 8 ? rate : rate * 0.5);
					calculatedPrice += Number(resPrice || 0);
				}
			}
			if (calculatedPrice === 0) {
				calculatedPrice = estimatedPrice || 0;
			}
		} catch {
			calculatedPrice = estimatedPrice || 0;
		}

		const ymd = String(bookingDate).replace(/-/g, '');
		const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		function randomSuffix(len = 5) { let s = ''; for (let i = 0; i < len; i++) s += alphabet.charAt(Math.floor(Math.random() * alphabet.length)); return s; }

		// Create a doc first to use its id for fallback booking code
		const preCreatedRef = doc(collection(db, 'bookings'));
		let bookingCode: string | null = `BK-${ymd}-${preCreatedRef.id.slice(-6).toUpperCase()}`;

		const bookingData = {
			customerId: customerId || null,
			customerName: String(customerName).trim(),
			customerEmail: String(customerEmail).toLowerCase().trim(),
			customerPhone: cleanedPhone,
			customerAvatar: customerAvatar || null,
			eventType,
			selectedHall: selectedHalls[0],
			hallName: hallNames[0],
			selectedHalls,
			hallNames,
			bookingDate,
			startTime,
			endTime,
			guestCount: guestCount || null,
			additionalDescription: additionalDescription || '',
			hallOwnerId,
			calculatedPrice,
			priceDetails: null,
			status: 'pending',
			bookingSource: bookingSource || 'website',
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
			bookingCode
		};

		await setDoc(preCreatedRef, bookingData);

		try {
			await addDoc(collection(db, 'notifications'), {
				userId: hallOwnerId,
				type: 'new_booking',
				title: 'New Booking Request',
				message: `New booking request from ${customerName} for ${bookingDate}`,
				data: {
					bookingId: preCreatedRef.id,
					bookingCode,
					customerName,
					bookingDate,
					hallName: hallNames[0],
				},
				isRead: false,
				createdAt: serverTimestamp(),
			});
		} catch {}

		try {
			await emailService.sendBookingConfirmationToCustomer({
				bookingId: preCreatedRef.id,
				bookingCode: bookingCode || undefined,
				customerName,
				customerEmail,
				eventType,
				hallName: hallNames[0],
				bookingDate,
				startTime,
				endTime,
				guestCount,
				calculatedPrice,
			});
			const hallOwnerEmail = (hallOwnerDoc.data() as any)?.email;
			if (hallOwnerEmail) {
				await emailService.sendBookingNotificationToHallOwner({
					bookingId: preCreatedRef.id,
					bookingCode: bookingCode || undefined,
					customerName,
					customerEmail,
					customerPhone: cleanedPhone,
					eventType,
					hallName: hallNames[0],
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
			bookingId: preCreatedRef.id,
			bookingCode,
			bookingSource: bookingSource || 'website',
			calculatedPrice,
			status: 'pending',
		});
	} catch (err) {
		return NextResponse.json({ message: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
	}
}


