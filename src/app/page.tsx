import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4">
      {/* Hero Section - Smaller and at the top */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 
            bg-clip-text text-transparent">
            Rhythm Game Generator
          </span>
        </h1>
        <p className="text-lg text-gray-300 mt-2">
          Transform your music into an interactive rhythm game
        </p>
      </div>
      
      {/* Main Upload Area - Takes up most of the screen */}
      <div className="w-full max-w-5xl aspect-[4/3] relative">
        {/* Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl 
          blur-lg opacity-25 group-hover:opacity-40 transition duration-1000"></div>
        
        {/* Content */}
        <div className="relative w-full h-full bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl 
          ring-1 ring-white/10 hover:ring-white/20 transition duration-300">
          <FileUpload />
        </div>
      </div>

      {/* Features - Smaller and at the bottom */}
      <div className="grid grid-cols-3 gap-4 mt-8 text-center max-w-4xl">
        {[
          {
            icon: '🎮',
            title: 'Easy to Play',
            description: 'Use arrow keys or tap'
          },
          {
            icon: '🎵',
            title: 'Any Song',
            description: 'Works with any MP3'
          },
          {
            icon: '🎯',
            title: 'Instant Game',
            description: 'Share with friends'
          }
        ].map((feature) => (
          <div key={feature.title} className="p-4 rounded-xl bg-white/5">
            <div className="text-2xl mb-1">{feature.icon}</div>
            <h3 className="text-sm font-semibold">{feature.title}</h3>
            <p className="text-xs text-gray-400">{feature.description}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
