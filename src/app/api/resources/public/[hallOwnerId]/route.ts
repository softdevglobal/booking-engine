import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

type ResourceItem = {
	id: string;
	name: string;
	type: string;
	capacity: number;
	code: string;
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
		const userDocRef = doc(db, 'users', hallOwnerId);
		const userDoc = await getDoc(userDocRef);
		if (!userDoc.exists() || userDoc.data()?.role !== 'hall_owner') {
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
				createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
				updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
			};
		}).sort((a, b) => a.name.localeCompare(b.name));

		const userData = userDoc.data() as any;
		const hallOwner = {
			name: userData.name || userData.businessName || 'Hall Owner',
			address: userData.address || 'Address not provided',
			phone: userData.phone || userData.contactNumber || 'Phone not provided',
			email: userData.email || 'Email not provided',
			businessName: userData.businessName || userData.name || 'Business Name',
		};

		return NextResponse.json({ resources, hallOwner });
	} catch (error: unknown) {
		return NextResponse.json({ message: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
	}
}


