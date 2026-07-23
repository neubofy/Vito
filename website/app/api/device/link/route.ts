import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, fcmToken } = body;

    if (!userId || !fcmToken) {
      return NextResponse.json({ error: 'Missing userId or fcmToken' }, { status: 400 });
    }

    // Save the device's FCM token directly to the user's Firestore document
    // We use the admin SDK here so it bypasses Firestore Security Rules
    // This allows the Android app to register itself without needing full Google Sign-In inside Android.
    await adminDb.collection('users').doc(userId).set({
      fcmToken: fcmToken,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error linking device:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
