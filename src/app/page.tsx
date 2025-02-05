import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 
            bg-clip-text text-transparent">
            MP3 to Rhythm Game
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Upload your MP3 file and we'll turn it into an interactive rhythm game. 
            Use arrow keys or tap to hit the notes in time with the music!
          </p>
        </div>
        
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-8 shadow-2xl 
          border border-white/10">
          <FileUpload />
        </div>
      </div>
    </main>
  )
}
