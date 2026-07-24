import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { put, del } from '@vercel/blob';

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

    const commandName = formData.get('command') as string || 'camera';

    // Enforce 1-photo limit per command by using the command name as the Document ID
    const photoDocRef = adminDb.collection('users').doc(userId).collection('photos').doc(commandName);
    const existingPhotoSnap = await photoDocRef.get();
    
    // If a photo already exists for this command, delete the old blob from Vercel Blob
    if (existingPhotoSnap.exists) {
      const data = existingPhotoSnap.data();
      if (data?.url) {
        try {
          await del(data.url);
        } catch (e) {
          console.error('Failed to delete old blob', data.url, e);
        }
      }
    }

    const filename = `theft-mode/${userId}/${Date.now()}-${file.name}`;
    
    const blob = await put(filename, file, {
      access: 'public', // Must be public for frontend to view easily without complex signed URLs
    });

    // Save the new photo URL to Firestore under the command name document
    await photoDocRef.set({
      url: blob.url,
      path: blob.pathname,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
