import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">MP3 to MIDI Converter</h1>
      <FileUpload />
    </main>
  )
}
