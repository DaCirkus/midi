# Automate turning mp3 files into midi files

## Instructions

# I want to make a system that let's you turn mp3 files into midi files. 

#I have a ryhym game made that will automaically create it's when files are intput. I have everything working and the last step I need to figure out is how to generate midi files and then upload them to pinata. 

#1.Have a place where people can drag, drop, or upload mp3 files.
#2 Take the mp3 file and split the tracks into separate files. (Possible through Spleeter but I'm open to other suggestions)
#3 Take the separate files and generate midi files. (Drum tracks will prob have the best results)
#4 There should be 4 midi files total representing(up,down,left,right) in the rhythm game. 
#5 Provide download links for the midi files.

## Game Integration

#6 Add "Generate Game" button next to MIDI download
#7 Create dedicated game page at /game
#8 Implement storage solution with Supabase:
   - Set up Supabase project and storage bucket
   - Store MP3 and MIDI files in Supabase Storage
   - Use Supabase database for game metadata (IDs, file URLs)
   - Create simple API endpoints using Supabase client

#9 Game Generation:
   - Pass MP3 + MIDI to game engine
   - Generate rhythm patterns based on MIDI data
   - Create unique game ID and store in Supabase

#10 Sharing System:
    - Generate shareable URLs (/game?id=xyz)
    - Fetch game data from Supabase
    - Add copy link functionality for sharing 