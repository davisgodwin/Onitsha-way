ONITSHA WAY — YOUR OWN CLUB MUSIC (optional)

The clubs play the game's own original mixes. You can add more music here, as long as you have the right to use it
(your own productions, tracks you licensed for this, or music under a licence that allows it, e.g. CC0/CC BY).
Commercial songs and DJ mixes you only bought or stream to listen to are NOT licensed for a game: don't add them.

1. Copy the files into this folder (mp3, ogg, m4a or wav; simple file names: letters, numbers, spaces, - _ . ( ) & ').
2. Create playlist.json in this folder, for example:
   [
     { "file": "my-afro-set.mp3", "name": "My Afro Set", "genre": "Afrobeats", "bpm": 104 },
     { "file": "piano-night.mp3", "name": "Piano Night", "genre": "Amapiano" }
   ]
3. Rebuild (npm run build) or restart npm run dev. The DJ's request list shows your tracks after the game's own.
Up to 60 tracks. Long files stream, so phones don't run out of memory.
