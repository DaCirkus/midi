import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 
              bg-clip-text text-transparent">
              Rhythm Game
            </span>
            <br />
            <span className="text-3xl md:text-4xl text-gray-400">
              Generator
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Transform your favorite music into an interactive rhythm game. 
            Upload an MP3, and we'll create a custom game that syncs perfectly with your beats.
          </p>
        </div>
        
        {/* Upload Container */}
        <div className="relative">
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl 
            blur-lg opacity-25 group-hover:opacity-40 transition duration-1000"></div>
          
          {/* Content */}
          <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-xl p-8 shadow-2xl 
            ring-1 ring-white/10 hover:ring-white/20 transition duration-300">
            <FileUpload />
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          {[
            {
              icon: '🎮',
              title: 'Easy to Play',
              description: 'Use arrow keys or tap to hit the notes in time with the music'
            },
            {
              icon: '🎵',
              title: 'Any Song',
              description: 'Works with any MP3 file, automatically detecting the best note patterns'
            },
            {
              icon: '🎯',
              title: 'Instant Game',
              description: 'Share your custom rhythm game with friends using a unique link'
            }
          ].map((feature) => (
            <div key={feature.title} className="space-y-2 p-6 rounded-xl bg-white/5 hover:bg-white/10 
              transition duration-300">
              <div className="text-4xl">{feature.icon}</div>
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
