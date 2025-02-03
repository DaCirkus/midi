import { NextResponse } from 'next/server';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST() {
  try {
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `uploads/${Date.now()}.mp3`,
      Conditions: [
        ['content-length-range', 0, 30 * 1024 * 1024], // up to 30MB
        ['starts-with', '$Content-Type', 'audio/'],
      ],
      Expires: 600, // 10 minutes
    });

    return NextResponse.json({ url, fields });
  } catch (error) {
    console.error('Error creating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to create upload URL' },
      { status: 500 }
    );
  }
} 