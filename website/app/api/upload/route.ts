import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
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
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required.' },
        { status: 400 }
      );
    }

    // Verify user exists in Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Upload to Vercel Blob using the authenticated userId
    const blob = await put(`theft-mode/${userId}/${Date.now()}-${file.name}`, file, {
      access: 'public',
    });

    // Save the photo URL to Firestore so the user can see it on the dashboard
    await adminDb.collection('users').doc(userId).collection('theftPhotos').add({
      url: blob.url,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(blob);
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
