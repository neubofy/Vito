import { NextResponse } from 'next/server';
import { adminDb, adminAuth, adminStorage } from '@/lib/firebaseAdmin';

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

    // Enforce 2-photo limit per user
    const photosRef = adminDb.collection('users').doc(userId).collection('theftPhotos');
    const existingPhotosSnap = await photosRef.orderBy('timestamp', 'desc').get();
    
    // If they already have 2 or more photos, delete the oldest ones until they have 1 left
    if (existingPhotosSnap.size >= 2) {
      const docsToDelete = existingPhotosSnap.docs.slice(1); // keep only the newest 1
      for (const doc of docsToDelete) {
        const data = doc.data();
        if (data.path) {
          try {
            await adminStorage.bucket().file(data.path).delete();
          } catch (e) {
            console.error('Failed to delete storage file', data.path, e);
          }
        }
        await doc.ref.delete(); // delete from Firestore
      }
    }

    // Upload to Firebase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const bucket = adminStorage.bucket();
    const filename = `theft-mode/${userId}/${Date.now()}-${file.name}`;
    const fileRef = bucket.file(filename);

    await fileRef.save(buffer, {
      metadata: { contentType: file.type },
      public: false // private to the user
    });

    // Save the photo path to Firestore so the user can see it on the dashboard
    await photosRef.add({
      path: filename,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true, path: filename });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
