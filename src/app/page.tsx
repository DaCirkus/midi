import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center">
        {/* Hero Section */}
        <div className="text-center mb-12 max-w-2xl relative">
          {/* Glow effect */}
          <div className="absolute -inset-40 bg-purple-500/20 blur-[100px] -z-10" />
          
          <h1 className="text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 
              bg-clip-text text-transparent">
              Rhythm Game Generator
            </span>
          </h1>
          <p className="text-xl text-white/70">
            Transform your music into an interactive rhythm game experience
          </p>
        </div>
        
        {/* Main Upload Area */}
        <div className="w-full max-w-4xl mb-12 relative">
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl 
            blur-lg opacity-25 group-hover:opacity-40 transition duration-1000" />
          
          {/* Content */}
          <div className="relative w-full bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl 
            ring-1 ring-white/10 hover:ring-white/20 transition duration-300">
            <FileUpload />
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {[
            {
              icon: '🎮',
              title: 'Easy to Play',
              description: 'Simple arrow key controls for an intuitive gaming experience'
            },
            {
              icon: '🎵',
              title: 'Any Song',
              description: 'Upload your favorite MP3 and watch it transform'
            },
            {
              icon: '🎯',
              title: 'Instant Game',
              description: 'Share your creation with friends instantly'
            }
          ].map((feature) => (
            <div 
              key={feature.title} 
              className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10
                hover:bg-white/10 transition-colors duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4
                group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">{feature.icon}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-white/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
