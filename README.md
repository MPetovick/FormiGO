![FormiGo Logo](logo_FormiGO.png)

> Social trail mapping inspired by ant colony behavior

## About

FormiGo is a progressive web application that allows users to track, save, and share their routes - creating a collective network of trails similar to how ants communicate paths to food sources. The application uses geolocation technology to record your movements and visualizes them on an interactive map.

**Current Status: Alpha Release**
> This is an early alpha version. Features may be incomplete, and you may encounter bugs. We appreciate your feedback and patience as we continue development.

## Features

- 📍 Real-time GPS tracking with accuracy filtering
- 🗺️ Multiple map styles (Standard, Satellite, Terrain)
- 💾 Local storage of your trails
- 📤 Import/Export functionality for sharing trails
- ⚙️ Customizable settings (units, accuracy, auto-save)
- 📱 Responsive PWA design - works on mobile and desktop
- 🎨 Minimalist, intuitive interface

## Getting Started

### Prerequisites

- Modern browser with geolocation support
- GPS enabled device
- HTTPS connection (required for geolocation API)

### Installation

No installation required! Simply visit [[FormiGO](https://mpetovick.github.io/FormiGO/)] (update with actual URL) to start using FormiGo.

For offline use:
1. Open the app in your browser
2. Use "Add to Home Screen" functionality on mobile devices
3. The app will work without internet connection for basic tracking

### Usage

1. **Allow location permissions** when prompted
2. Click "Start" to begin tracking your route
3. Move around to create your trail
4. Click "Stop" when finished
5. Name and save your trail
6. Access "My Trails" to view, share, or export your saved routes

#### Keyboard Shortcuts
- `Space`: Start/Stop tracking
- `Escape`: Close modals

## Technology Stack

- Vanilla JavaScript (ES6+)
- Leaflet.js for mapping
- HTML5 Geolocation API
- CSS3 with Flexbox/Grid
- Progressive Web App (PWA) capabilities
- LocalStorage for data persistence

## Development

### Project Structure
```
formigo/
├── index.html      # Main application page
├── style.css       # Styles and responsive layout
├── app.js          # Application logic and functionality
├── logo_FormiGO.png # Application logo
└── manifest.json   # PWA configuration
```

### Browser Support

- Chrome/Edge 79+
- Firefox 72+
- Safari 13.1+
- Mobile browsers with geolocation support

## Contributing

As an alpha release, we welcome feedback and bug reports. Please submit issues for:

- Functional bugs
- UI/UX suggestions
- Feature requests
- Performance issues

## Known Issues (Alpha)

- GPS accuracy may vary by device
- Battery usage may be high during extended tracking
- Import/export functionality may fail with very large trails
- Some mobile browsers may restrict background geolocation

## Roadmap

### Alpha Phase Focus
- Core tracking functionality stabilization
- Basic import/export reliability
- Performance optimization

### Planned Features
- Social sharing capabilities
- Trail difficulty ratings
- Collaborative trail editing
- Advanced statistics and analytics
- Native mobile applications

## Privacy

FormiGo respects your privacy:
- All data is stored locally on your device
- No location data is transmitted to our servers
- You control what trails you share through export codes
- Private trails remain exclusively on your device

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support during the alpha phase, please create an issue in this repository or contact our development team at [email address].

---

**Remember**: This is alpha software. Always verify trails against official maps and local conditions before relying on them for navigation.

Happy trail mapping! 🐜✨
