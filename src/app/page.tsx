import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center">
      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-5xl sm:text-6xl font-bold mb-4">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 
            bg-clip-text text-transparent">
            Rhythm Game Generator
          </span>
        </h1>
        <p className="text-xl text-white/70">
          Transform your music into a rhythm game
        </p>
      </div>
      
      {/* Main Upload Area */}
      <div className="w-[90vw] max-w-4xl aspect-[16/9] relative">
        {/* Glow Effect */}
        <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl 
          blur-xl opacity-25 group-hover:opacity-40 transition duration-1000" />
        
        {/* Content */}
        <div className="relative w-full h-full bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl 
          ring-1 ring-white/10 hover:ring-white/20 transition duration-300">
          <FileUpload />
        </div>
      </div>

      {/* Features */}
      <div className="flex justify-center gap-8 mt-12">
        {[
          {
            icon: '⌨️',
            text: 'WASD or Arrow Keys'
          },
          {
            icon: '🎵',
            text: 'Any MP3 File'
          },
          {
            icon: '🎮',
            text: 'Instant Game'
          }
        ].map((feature) => (
          <div 
            key={feature.text} 
            className="flex flex-col items-center gap-2 px-6 py-3"
          >
            <span className="text-3xl mb-1">{feature.icon}</span>
            <span className="text-sm font-medium text-white/70">{feature.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
