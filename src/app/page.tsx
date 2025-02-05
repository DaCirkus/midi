import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-8">
      {/* Hero Section - Smaller and at the top */}
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-3">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 
            bg-clip-text text-transparent">
            Rhythm Game Generator
          </span>
        </h1>
        <p className="text-lg text-white/70">
          Drop your MP3 and watch it transform into a rhythm game
        </p>
      </div>
      
      {/* Main Upload Area - Takes up most of the screen */}
      <div className="w-full max-w-3xl relative">
        {/* Glow Effect */}
        <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl 
          blur-xl opacity-25 group-hover:opacity-40 transition duration-1000" />
        
        {/* Content */}
        <div className="relative w-full min-h-[400px] bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl 
          ring-1 ring-white/10 hover:ring-white/20 transition duration-300">
          <FileUpload />
        </div>
      </div>

      {/* Features - Smaller and at the bottom */}
      <div className="flex flex-wrap justify-center gap-6 mt-8 text-center max-w-3xl mx-auto">
        {[
          {
            icon: '🎮',
            text: 'Use arrow keys or WASD'
          },
          {
            icon: '🎵',
            text: 'Works with any MP3'
          },
          {
            icon: '🎯',
            text: 'Share with friends'
          }
        ].map((feature) => (
          <div 
            key={feature.text} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-sm 
              border border-white/10 hover:bg-white/10 transition-colors duration-300"
          >
            <span className="text-2xl">{feature.icon}</span>
            <span className="text-sm text-white/70">{feature.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
