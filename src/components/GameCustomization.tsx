'use client';

import { useState, useEffect } from 'react';
import { GameData } from '@/lib/supabase';
import { HexColorPicker } from 'react-colorful';

// Default customization values
const defaultCustomization: NonNullable<GameData['visual_customization']> = {
  background: {
    type: 'color',
    color: '#1a1a2e',
  },
  notes: {
    shape: 'arrow',
    size: 1,
    colors: {
      LEFT: '#ffffff',
      RIGHT: '#ffffff',
      UP: '#ffffff',
      DOWN: '#ffffff',
    },
    opacity: 1,
    glow: true,
  },
  hitEffects: {
    style: 'explosion',
    color: '#ffffff',
    size: 1,
    duration: 0.5,
  },
  missEffects: {
    style: 'shake',
    color: '#ff0000',
  },
  lanes: {
    color: '#ffffff',
    width: 1,
    glow: true,
  },
  ui: {
    theme: 'default',
    fontFamily: 'sans-serif',
  },
};

// Helper function to validate image URLs
function isValidImageUrl(url: string) {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
}

// Helper to check if a URL is CORS-enabled
function checkImageCors(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.crossOrigin = 'anonymous';
    img.src = url;
    // Set a timeout in case the image takes too long to load
    setTimeout(() => resolve(false), 5000);
  });
}

interface GameCustomizationProps {
  onCustomizationChange: (customization: NonNullable<GameData['visual_customization']>) => void;
  onComplete: () => void;
}

export default function GameCustomization({
  onCustomizationChange,
  onComplete,
}: GameCustomizationProps) {
  const [customization, setCustomization] = useState<NonNullable<GameData['visual_customization']>>(defaultCustomization);
  const [activeTab, setActiveTab] = useState<'background' | 'notes' | 'effects'>('background');
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Notify parent component of changes when customization changes
  useEffect(() => {
    onCustomizationChange(customization);
  }, [customization, onCustomizationChange]);

  // Validate image URL when it changes
  useEffect(() => {
    if (customization.background.type === 'image' && customization.background.imageUrl) {
      if (!isValidImageUrl(customization.background.imageUrl)) {
        setImageError(true);
        console.warn('Invalid image URL format:', customization.background.imageUrl);
        return;
      }
      
      // Test if image can be loaded
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Try with CORS enabled
      img.onload = () => {
        console.log('Image loaded successfully:', customization.background.imageUrl);
        setImageError(false);
      };
      img.onerror = (e) => {
        console.error('Image load error:', e);
        setImageError(true);
      };
      img.src = customization.background.imageUrl;
    } else {
      setImageError(false);
    }
  }, [customization.background.imageUrl, customization.background.type]);

  // Handle customization changes
  const handleChange = <T extends keyof NonNullable<GameData['visual_customization']>>(
    section: T,
    field: keyof NonNullable<GameData['visual_customization']>[T],
    value: any
  ) => {
    setCustomization((prev) => {
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      };
    });
  };

  // Handle nested changes (for colors, etc.)
  const handleNestedChange = <
    T extends keyof NonNullable<GameData['visual_customization']>,
    U extends keyof NonNullable<GameData['visual_customization']>[T]
  >(
    section: T,
    field: U,
    nestedField: string,
    value: any
  ) => {
    setCustomization((prev) => {
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: {
            ...(prev[section][field] as any),
            [nestedField]: value,
          },
        },
      };
    });
  };

  // Preview component
  const GamePreview = () => {
    const bgStyle = (() => {
      const bg = customization.background;
      if (bg.type === 'color') {
        return { backgroundColor: bg.color };
      } else if (bg.type === 'gradient' && bg.gradientColors?.length) {
        const direction = bg.gradientDirection || 'to bottom';
        if (direction === 'radial') {
          return {
            background: `radial-gradient(circle, ${bg.gradientColors.join(', ')})`
          };
        }
        return {
          background: `linear-gradient(${direction}, ${bg.gradientColors.join(', ')})`
        };
      } else if (bg.type === 'pattern') {
        const patternColor = bg.patternColor || '#ffffff';
        const baseColor = bg.color || '#1a1a2e';
        
        // Create different pattern backgrounds based on the selected pattern
        if (bg.pattern === 'dots') {
          return {
            backgroundColor: baseColor,
            backgroundImage: `radial-gradient(${patternColor} 2px, transparent 2px)`,
            backgroundSize: '20px 20px'
          };
        } else if (bg.pattern === 'stripes') {
          return {
            backgroundColor: baseColor,
            backgroundImage: `linear-gradient(45deg, ${patternColor} 25%, transparent 25%, transparent 50%, ${patternColor} 50%, ${patternColor} 75%, transparent 75%, transparent)`,
            backgroundSize: '20px 20px'
          };
        } else if (bg.pattern === 'grid') {
          return {
            backgroundColor: baseColor,
            backgroundImage: `linear-gradient(${patternColor} 1px, transparent 1px), linear-gradient(to right, ${patternColor} 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          };
        } else if (bg.pattern === 'waves') {
          return {
            backgroundColor: baseColor,
            backgroundImage: `repeating-radial-gradient(circle at 0 0, transparent 0, ${baseColor} 10px), repeating-linear-gradient(${patternColor}55, ${patternColor})`
          };
        } else if (bg.pattern === 'circuit') {
          return {
            backgroundColor: baseColor,
            backgroundImage: `linear-gradient(${patternColor}50 1px, transparent 1px), linear-gradient(90deg, ${patternColor}50 1px, transparent 1px), linear-gradient(${patternColor}25 1px, transparent 1px), linear-gradient(90deg, ${patternColor}25 1px, transparent 1px)`,
            backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
            backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px'
          };
        }
        return { backgroundColor: baseColor };
      } else if (bg.type === 'image' && bg.imageUrl) {
        return {
          backgroundImage: `url(${bg.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
      }
      return { backgroundColor: '#1a1a2e' };
    })();

    return (
      <div className="w-full h-32 rounded overflow-hidden relative" style={bgStyle}>
        {/* Lane */}
        <div 
          className="absolute left-1/2 top-0 h-full transform -translate-x-1/2" 
          style={{ 
            width: `${20 * customization.lanes.width}px`, 
            backgroundColor: customization.lanes.color,
            opacity: 0.3,
            boxShadow: customization.lanes.glow ? `0 0 10px ${customization.lanes.color}` : 'none',
          }}
        />
        
        {/* Sample notes */}
        {['LEFT', 'RIGHT', 'UP', 'DOWN'].map((direction, index) => {
          const color = customization.notes.colors[direction as keyof typeof customization.notes.colors];
          const size = 20;
          const top = 20 + index * 25;
          
          return (
            <div 
              key={direction}
              className="absolute left-1/2 transform -translate-x-1/2"
              style={{ 
                top: `${top}px`,
                width: `${size}px`, 
                height: `${size}px`,
                backgroundColor: color,
                opacity: customization.notes.opacity,
                boxShadow: customization.notes.glow ? `0 0 5px ${color}` : 'none',
                borderRadius: customization.notes.shape === 'circle' ? '50%' : '0',
                clipPath: customization.notes.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 
                          customization.notes.shape === 'diamond' ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' :
                          customization.notes.shape === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 
                          customization.notes.shape === 'arrow' ? 
                            direction === 'UP' ? 'polygon(50% 0%, 100% 100%, 0% 100%)' :
                            direction === 'DOWN' ? 'polygon(0% 0%, 100% 0%, 50% 100%)' :
                            direction === 'LEFT' ? 'polygon(0% 50%, 100% 0%, 100% 100%)' :
                            'polygon(0% 0%, 0% 100%, 100% 50%)' : // RIGHT
                          'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {customization.notes.shape !== 'arrow' && (
                <div className="text-white text-xs">
                  {direction === 'LEFT' ? '←' : 
                   direction === 'RIGHT' ? '→' : 
                   direction === 'UP' ? '↑' : '↓'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full">
      <h2 className="text-sm font-medium mb-2">Step 3: Customize Your Game</h2>
      
      {/* Preview */}
      <div className="mb-3">
        <h3 className="text-xs font-medium mb-1 text-gray-300">Preview</h3>
        <GamePreview />
      </div>
      
      {/* Tabs */}
      <div className="flex mb-3 border-b border-gray-700">
        <button
          className={`px-2 py-1 text-xs ${activeTab === 'background' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
          onClick={() => setActiveTab('background')}
        >
          Background
        </button>
        <button
          className={`px-2 py-1 text-xs ${activeTab === 'notes' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
          onClick={() => setActiveTab('notes')}
        >
          Notes
        </button>
        <button
          className={`px-2 py-1 text-xs ${activeTab === 'effects' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
          onClick={() => setActiveTab('effects')}
        >
          Effects
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="mb-4">
        {/* Background Tab */}
        {activeTab === 'background' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Background Type</label>
              <select
                className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600"
                value={customization.background.type}
                onChange={(e) => handleChange('background', 'type', e.target.value as any)}
              >
                <option value="color">Solid Color</option>
                <option value="gradient">Gradient</option>
                <option value="pattern">Pattern</option>
                <option value="image">Image (URL)</option>
              </select>
            </div>

            {customization.background.type === 'color' && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Background Color</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border border-gray-600"
                      style={{ backgroundColor: customization.background.color }}
                    />
                    <span className="text-xs text-gray-300">{customization.background.color}</span>
                  </div>
                  <div className="mt-2">
                    <HexColorPicker
                      color={customization.background.color}
                      onChange={(color) => handleChange('background', 'color', color)}
                      className="w-full max-w-[200px]"
                    />
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-300 mb-1">Or enter hex code manually:</label>
                    <input
                      type="text"
                      className="bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600 w-full max-w-[200px]"
                      value={customization.background.color}
                      onChange={(e) => handleChange('background', 'color', e.target.value)}
                      placeholder="#RRGGBB"
                    />
                  </div>
                </div>
              </div>
            )}

            {customization.background.type === 'gradient' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Gradient Type</label>
                  <select
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600"
                    value={customization.background.gradientDirection || 'to bottom'}
                    onChange={(e) => handleChange('background', 'gradientDirection', e.target.value)}
                  >
                    <option value="to bottom">Top to Bottom</option>
                    <option value="to right">Left to Right</option>
                    <option value="to bottom right">Diagonal (↘)</option>
                    <option value="to bottom left">Diagonal (↙)</option>
                    <option value="radial">Radial</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Gradient Colors</label>
                  <div className="space-y-2">
                    {(customization.background.gradientColors || ['#1a1a2e', '#4a4a8a']).map((color, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border border-gray-600"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-gray-300">Color {index + 1}</span>
                        <div className="ml-auto">
                          <HexColorPicker
                            color={color}
                            onChange={(newColor) => {
                              const newColors = [...(customization.background.gradientColors || ['#1a1a2e', '#4a4a8a'])];
                              newColors[index] = newColor;
                              handleChange('background', 'gradientColors', newColors);
                            }}
                            className="w-full max-w-[150px]"
                          />
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex gap-2 mt-2">
                      <button
                        className="px-2 py-1 bg-gray-700 text-white rounded text-xs"
                        onClick={() => {
                          const newColors = [...(customization.background.gradientColors || ['#1a1a2e', '#4a4a8a']), '#ffffff'];
                          handleChange('background', 'gradientColors', newColors);
                        }}
                        disabled={(customization.background.gradientColors || []).length >= 4}
                      >
                        Add Color
                      </button>
                      <button
                        className="px-2 py-1 bg-gray-700 text-white rounded text-xs"
                        onClick={() => {
                          const newColors = [...(customization.background.gradientColors || ['#1a1a2e', '#4a4a8a'])];
                          if (newColors.length > 2) {
                            newColors.pop();
                            handleChange('background', 'gradientColors', newColors);
                          }
                        }}
                        disabled={(customization.background.gradientColors || []).length <= 2}
                      >
                        Remove Color
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {customization.background.type === 'pattern' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Pattern Style</label>
                  <select
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600"
                    value={customization.background.pattern || 'dots'}
                    onChange={(e) => handleChange('background', 'pattern', e.target.value)}
                  >
                    <option value="dots">Dots</option>
                    <option value="stripes">Stripes</option>
                    <option value="grid">Grid</option>
                    <option value="waves">Waves</option>
                    <option value="circuit">Circuit</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Pattern Color</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-gray-600"
                        style={{ backgroundColor: customization.background.patternColor || '#ffffff' }}
                      />
                      <span className="text-xs text-gray-300">{customization.background.patternColor || '#ffffff'}</span>
                    </div>
                    <div className="mt-2">
                      <HexColorPicker
                        color={customization.background.patternColor || '#ffffff'}
                        onChange={(color) => handleChange('background', 'patternColor', color)}
                        className="w-full max-w-[150px]"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Background Color</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-gray-600"
                        style={{ backgroundColor: customization.background.color }}
                      />
                      <span className="text-xs text-gray-300">{customization.background.color}</span>
                    </div>
                    <div className="mt-2">
                      <HexColorPicker
                        color={customization.background.color}
                        onChange={(color) => handleChange('background', 'color', color)}
                        className="w-full max-w-[150px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {customization.background.type === 'image' && (
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  type="text"
                  className={`w-full px-3 py-2 bg-gray-800 border ${imageError ? 'border-red-500' : 'border-gray-700'} rounded text-sm`}
                  placeholder="https://example.com/image.jpg"
                  value={customization.background.imageUrl || ''}
                  onChange={(e) => handleChange('background', 'imageUrl', e.target.value)}
                />
                {imageError && (
                  <div className="mt-1 text-red-500 text-xs">
                    Image URL is invalid or the image cannot be loaded. Make sure the URL is correct and the image supports CORS.
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-400">
                  Use HTTPS URLs for images that support cross-origin sharing (CORS).
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Note Shape</label>
              <select
                className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600"
                value={customization.notes.shape}
                onChange={(e) => handleChange('notes', 'shape', e.target.value as any)}
              >
                <option value="arrow">Arrows</option>
                <option value="circle">Circles</option>
                <option value="square">Squares</option>
                <option value="triangle">Triangles</option>
                <option value="diamond">Diamonds</option>
                <option value="star">Stars</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Note Colors</label>
              {(Object.keys(customization.notes.colors) as Array<keyof typeof customization.notes.colors>).map((direction) => (
                <div key={direction} className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-4 h-4 rounded border border-gray-600"
                      style={{ backgroundColor: customization.notes.colors[direction] }}
                    />
                    <span className="text-xs text-gray-300">{direction}: {customization.notes.colors[direction]}</span>
                  </div>
                  <div className="mb-1">
                    <HexColorPicker
                      color={customization.notes.colors[direction]}
                      onChange={(color) => handleNestedChange('notes', 'colors', direction, color)}
                      className="w-full max-w-[150px]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600 w-full max-w-[150px]"
                      value={customization.notes.colors[direction]}
                      onChange={(e) => handleNestedChange('notes', 'colors', direction, e.target.value)}
                      placeholder="#RRGGBB"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Effects Tab */}
        {activeTab === 'effects' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Hit Effect Style</label>
              <select
                className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600"
                value={customization.hitEffects.style}
                onChange={(e) => handleChange('hitEffects', 'style', e.target.value as any)}
              >
                <option value="explosion">Explosion</option>
                <option value="ripple">Ripple</option>
                <option value="flash">Flash</option>
                <option value="particles">Particles</option>
                <option value="starburst">Starburst</option>
                <option value="pulse">Pulse</option>
                <option value="glow">Glow</option>
                <option value="none">None</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Hit Effect Color</label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border border-gray-600"
                    style={{ backgroundColor: customization.hitEffects.color }}
                  />
                  <span className="text-xs text-gray-300">{customization.hitEffects.color}</span>
                </div>
                <div className="mb-1">
                  <HexColorPicker
                    color={customization.hitEffects.color}
                    onChange={(color) => handleChange('hitEffects', 'color', color)}
                    className="w-full max-w-[150px]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600 w-full max-w-[150px]"
                    value={customization.hitEffects.color}
                    onChange={(e) => handleChange('hitEffects', 'color', e.target.value)}
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Miss Effect Style</label>
              <select
                className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600"
                value={customization.missEffects.style}
                onChange={(e) => handleChange('missEffects', 'style', e.target.value as any)}
              >
                <option value="shake">Shake</option>
                <option value="fade">Fade</option>
                <option value="flash">Flash</option>
                <option value="blur">Blur</option>
                <option value="shatter">Shatter</option>
                <option value="shrink">Shrink</option>
                <option value="none">None</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Miss Effect Color</label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border border-gray-600"
                    style={{ backgroundColor: customization.missEffects.color }}
                  />
                  <span className="text-xs text-gray-300">{customization.missEffects.color}</span>
                </div>
                <div className="mb-1">
                  <HexColorPicker
                    color={customization.missEffects.color}
                    onChange={(color) => handleChange('missEffects', 'color', color)}
                    className="w-full max-w-[150px]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600 w-full max-w-[150px]"
                    value={customization.missEffects.color}
                    onChange={(e) => handleChange('missEffects', 'color', e.target.value)}
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="noteGlow"
                checked={customization.notes.glow}
                onChange={(e) => handleChange('notes', 'glow', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="noteGlow" className="text-xs text-gray-300">Enable glow effects</label>
            </div>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex justify-end">
        <button
          className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
          onClick={onComplete}
          disabled={customization.background.type === 'image' && imageError}
        >
          Create Game
        </button>
      </div>
    </div>
  );
} 