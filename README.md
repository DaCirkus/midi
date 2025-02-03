# MP3 to MIDI Converter

A web application that converts MP3 files into MIDI tracks using AI-powered audio separation and transcription.

## Features

- Drag and drop MP3 file upload
- Automatic track separation (drums, bass, vocals, other)
- MIDI conversion for each separated track
- Download links for generated MIDI files

## Setup

1. Clone the repository:
```bash
git clone https://github.com/DaCirkus/midi.git
cd midi
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with your AWS credentials:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_BUCKET_NAME=your_bucket_name_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## AWS Setup

1. Create an S3 bucket for file storage
2. Create an IAM user with S3 access
3. Configure CORS on your S3 bucket:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

## Deployment

1. Push your changes to GitHub
2. Create a new project on Vercel
3. Connect to your GitHub repository
4. Add environment variables in Vercel dashboard
5. Deploy!
