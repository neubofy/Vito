import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { del } from '@vercel/blob';

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
    const body = await req.json();
    const { commandName, all } = body;

    const userRef = adminDb.collection('users').doc(userId);

    // Delete a specific command's data
    if (commandName && !all) {
      // 1. Delete result
      await userRef.collection('results').doc(commandName).delete();
      
      // 2. Delete photo if exists
      const photoDoc = await userRef.collection('photos').doc(commandName).get();
      if (photoDoc.exists) {
        const data = photoDoc.data();
        if (data?.url) {
          try {
            await del(data.url);
          } catch (e) {
            console.error('Failed to delete blob', data.url, e);
          }
        }
        await photoDoc.ref.delete();
      }
      return NextResponse.json({ success: true, message: `Deleted data for ${commandName}` });
    }

    // Delete ALL data
    if (all) {
      const resultsSnap = await userRef.collection('results').get();
      const photosSnap = await userRef.collection('photos').get();

      const batch = adminDb.batch();

      // Clear results
      resultsSnap.forEach((doc: any) => {
        batch.delete(doc.ref);
      });

      // Clear photos and blobs
      const deletePromises = [];
      for (const doc of photosSnap.docs) {
        const data = doc.data();
        if (data?.url) {
          deletePromises.push(
            del(data.url).catch(e => console.error('Failed to delete blob', data.url, e))
          );
        }
        batch.delete(doc.ref);
      }
      await Promise.all(deletePromises);

      await batch.commit();
      return NextResponse.json({ success: true, message: 'All telemetry and photos deleted.' });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error: any) {
    console.error('Error deleting data:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
