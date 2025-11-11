import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isAdminConfigured } from '@/lib/firebaseAdmin';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

type PricingItem = {
	id: string;
	resourceId: string;
	resourceName: string;
	rateType: string;
	weekdayRate: number;
	weekendRate: number;
	description: string;
	hallOwnerId: string;
	createdAt: string | null;
	updatedAt: string | null;
};

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ hallOwnerId: string }> }
) {
	try {
		const { hallOwnerId } = await context.params;

		if (isAdminConfigured) {
			const userDoc = await adminDb.collection('users').doc(hallOwnerId).get();
			if (!userDoc.exists || (userDoc.data() as any)?.role !== 'hall_owner') {
				return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
			}

			const pricingSnapshot = await adminDb
				.collection('pricing')
				.where('hallOwnerId', '==', hallOwnerId)
				.get();

			const pricing: PricingItem[] = pricingSnapshot.docs.map((d) => {
				const data: any = d.data();
				return {
					id: d.id as string,
					resourceId: data.resourceId || '',
					resourceName: data.resourceName || '',
					rateType: data.rateType || 'hourly',
					weekdayRate: data.weekdayRate || 0,
					weekendRate: data.weekendRate || 0,
					description: data.description || '',
					hallOwnerId: data.hallOwnerId,
					createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
					updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
				};
			}).sort((a, b) => a.resourceName.localeCompare(b.resourceName));

			return NextResponse.json(pricing);
		} else {
			// Fallback to client SDK
			const userDocRef = doc(db, 'users', hallOwnerId);
			const userDoc = await getDoc(userDocRef);
			if (!userDoc.exists() || (userDoc.data() as any)?.role !== 'hall_owner') {
				return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
			}
			const pricingQuery = query(
				collection(db, 'pricing'),
				where('hallOwnerId', '==', hallOwnerId)
			);
			const pricingSnapshot = await getDocs(pricingQuery);
			const pricing: PricingItem[] = pricingSnapshot.docs.map((d) => {
				const data: any = d.data();
				return {
					id: d.id,
					resourceId: data.resourceId || '',
					resourceName: data.resourceName || '',
					rateType: data.rateType || 'hourly',
					weekdayRate: data.weekdayRate || 0,
					weekendRate: data.weekendRate || 0,
					description: data.description || '',
					hallOwnerId: data.hallOwnerId,
					createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
					updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
				};
			}).sort((a, b) => a.resourceName.localeCompare(b.resourceName));
			return NextResponse.json(pricing);
		}
	} catch (error: unknown) {
		return NextResponse.json({ message: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
	}
}


