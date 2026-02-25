## Packages
leaflet | Core mapping library
react-leaflet | React bindings for Leaflet maps
react-leaflet-cluster | Marker clustering for dense photo maps
@types/leaflet | TypeScript definitions for Leaflet
exifr | For extracting GPS and Date metadata from uploaded images

## Notes
- Leaflet CSS is imported in index.css
- The app uses `exifr` to extract location data client-side before uploading
- Images are uploaded as Base64 strings to keep the MVP simple
- Assuming Replit Auth is correctly wired, `/api/auth/user` provides user state
