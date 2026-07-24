import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    
    // Read the user document directly from adminDb (bypassing Firestore client security rules)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    // Read the user's latest photos
    const photosSnap = await adminDb.collection('users').doc(userId).collection('theftPhotos').orderBy('timestamp', 'desc').limit(2).get();
    const photos = photosSnap.docs.map((doc: any) => doc.data());
    
    if (!userDoc.exists) {
      return NextResponse.json({ data: null, photos: photos });
    }

    return NextResponse.json({ data: userDoc.data(), photos: photos });
  } catch (error: any) {
    console.error('Error fetching user data:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
