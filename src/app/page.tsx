import { FileUpload } from '@/components/FileUpload';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">
          MP3 to MIDI Converter
        </h1>
        <FileUpload />
      </div>
    </main>
  );
}
