import FileUpload from '@/components/FileUpload'

export default function Home() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold gradient-text mb-4">
            MP3 to Rhythm Game Generator
          </h1>
          <p className="text-xl text-white/70">
            Transform your song into a shareable rhythm game
          </p>
        </div>

        {/* Upload Box */}
        <div className="mb-12">
          <div className="aspect-[16/9] w-full glass rounded-2xl p-8">
            <FileUpload />
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            {
              icon: '🎵',
              text: 'Upload any MP3 File'
            },
            {
              icon: '🎮',
              text: 'Generate a Game'
            },
            {
              icon: '⌨️',
              text: 'Play with WASD or Arrow Keys'
            },
            {
              icon: '🔗',
              text: 'Share with friends'
            }
          ].map((feature) => (
            <div 
              key={feature.text}
              className="glass flex flex-col items-center p-6 rounded-xl"
            >
              <span className="text-4xl mb-4">{feature.icon}</span>
              <span className="text-lg font-medium text-white/70">{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
