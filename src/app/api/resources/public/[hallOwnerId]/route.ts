import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isAdminConfigured } from '@/lib/firebaseAdmin';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

type ResourceItem = {
	id: string;
	name: string;
	type: string;
	capacity: number;
	code: string;
	description: string;
	hallOwnerId: string;
	imageUrl?: string;
	createdAt: string | null;
	updatedAt: string | null;
};

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ hallOwnerId: string }> }
) {
	try {
		const { hallOwnerId } = await context.params;
		// Use Admin SDK only when configured; otherwise go straight to client SDK
		if (isAdminConfigured) {
			const userDoc = await adminDb.collection('users').doc(hallOwnerId).get();
			if (!userDoc.exists || (userDoc.data() as any)?.role !== 'hall_owner') {
				return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
			}

			const resourcesSnapshot = await adminDb
				.collection('resources')
				.where('hallOwnerId', '==', hallOwnerId)
				.get();

			const resources: ResourceItem[] = resourcesSnapshot.docs.map((d) => {
				const data: any = d.data();
				return {
					id: d.id as string,
					name: data.name || '',
					type: data.type || 'hall',
					capacity: data.capacity || 0,
					code: data.code || '',
					description: data.description || '',
					hallOwnerId: data.hallOwnerId,
					imageUrl: data.imageUrl || undefined,
					createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
					updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
				};
			}).sort((a, b) => a.name.localeCompare(b.name));

			const userData = userDoc.data() as any;
			const hallOwner = {
				name: userData.name || userData.businessName || 'Hall Owner',
				address: userData.address || 'Address not provided',
				phone: userData.phone || userData.contactNumber || 'Phone not provided',
				email: userData.email || 'Email not provided',
				businessName: userData.businessName || userData.name || 'Business Name',
				eventTypes: Array.isArray(userData.eventTypes) ? userData.eventTypes : []
			};

			return NextResponse.json({ resources, hallOwner });
		} else {
			// Fallback to client SDK (uses Firestore security rules)
			const userDocRef = doc(db, 'users', hallOwnerId);
			const userDoc = await getDoc(userDocRef);
			if (!userDoc.exists() || (userDoc.data() as any)?.role !== 'hall_owner') {
				return NextResponse.json({ message: 'Hall owner not found' }, { status: 404 });
			}
			const resourcesQuery = query(
				collection(db, 'resources'),
				where('hallOwnerId', '==', hallOwnerId)
			);
			const resourcesSnapshot = await getDocs(resourcesQuery);
			const resources: ResourceItem[] = resourcesSnapshot.docs.map((d) => {
				const data: any = d.data();
				return {
					id: d.id,
					name: data.name || '',
					type: data.type || 'hall',
					capacity: data.capacity || 0,
					code: data.code || '',
					description: data.description || '',
					hallOwnerId: data.hallOwnerId,
					imageUrl: data.imageUrl || undefined,
					createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
					updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
				};
			}).sort((a, b) => a.name.localeCompare(b.name));
			const userData = userDoc.data() as any;
			const hallOwner = {
				name: userData.name || userData.businessName || 'Hall Owner',
				address: userData.address || 'Address not provided',
				phone: userData.phone || userData.contactNumber || 'Phone not provided',
				email: userData.email || 'Email not provided',
				businessName: userData.businessName || userData.name || 'Business Name',
				eventTypes: Array.isArray(userData.eventTypes) ? userData.eventTypes : []
			};
			return NextResponse.json({ resources, hallOwner });
		}
	} catch (error: unknown) {
		return NextResponse.json({ message: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
	}
}


