# Building Management App

This is a Next.js application built with Firebase Studio for managing building information, including structural levels.

---

## How to Run

1.  Install dependencies: `npm install`
2.  Run the development server: `npm run dev`
3.  Open [http://localhost:9002](http://localhost:9002) with your browser.

---

## Version History

### v0.1.2
- **Building Structure**: Added a detailed view for each building.
- **Level Management**: Users can now add structural levels (e.g., Basement, Ground, Typical Floor) to each building.
- **Conditional UI**: When adding a "Typical Floor", a special input appears to specify the floor number.

### v0.1.1
- **Collapsible Sidebar**: Implemented a modern, expandable and retractable left-hand sidebar for navigation.
- **Tabbed Settings Page**: Reorganized the settings page with tabs for "General" user profile information and "Buildings" management.
- **Building Management**: Implemented the ability to create new buildings and edit their name/address.
- **Bug Fixes**: Resolved several critical Firestore query and security rule issues to ensure building lists are displayed correctly.
- **Robust Error Handling**: Created a centralized error handling system to display detailed Firestore errors during development.

### v0.1.0
- **Initial Project Setup**: Basic Next.js starter with Firebase.
- **User Authentication**: Integrated Firebase Authentication with Google Sign-In.
- **Core Layout**: Established the main application layout and pages.
