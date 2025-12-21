# Building Management App

This is a Next.js application built with Firebase Studio for managing building information, including structural levels and units.

---

## How to Run

1.  Install dependencies: `npm install`
2.  Run the development server: `npm run dev`
3.  Open [http://localhost:9002](http://localhost:9002) with your browser.

---

## Version History

### v0.1.5
- **Unit Management**: Added the ability to create, view, and delete individual units (e.g., offices, apartments) within each building level.
- **Dedicated Level Page**: Refactored the UI to give each building level its own dedicated page, which now serves as the central place to manage that level's details and its associated units.
- **Enhanced Building Dashboard**: The homepage dashboard card has been significantly improved to show a summary of units by type, a total unit count, and a list of levels with a unit count for each.
- **Unit Counts in Lists**: The levels table on the building detail page now also includes a column showing the number of units on each floor, providing a better at-a-glance overview.

### v0.1.4
- **Direct Editing UI**: Replaced static building details with interactive Switch and Select components on the building detail page, allowing for direct, inline modification of properties like `hasBasement`, `basementCount`, `hasPenthouse`, etc., without needing a separate edit form.
- **Table-based Level List**: Refactored the list of building levels into a compact and scalable table structure for a cleaner and more professional presentation.
- **Level Editing**: Implemented the ability to edit an existing level's details through a slide-out sheet.

### v0.1.3
- **Settings Redesign**: Reorganized settings navigation from tabs to a collapsible sidebar menu.
- **Inline Editing**: Implemented inline editing for building name and address on the detail page.
- **Level Management UI**: The "Add Level" form is now hidden by default and appears on button click.
- **Advanced Sorting**: Added complex, multi-level sorting (asc/desc) for building levels based on their type and floor number.
- **Level Deletion**: Implemented the ability to delete levels from a building.
- **Validation**: Added validation to prevent the creation of duplicate unique levels (e.g., Ground, Rooftop).
- **Component Refactor**: Consolidated building creation and editing logic into a single reusable `BuildingFormSheet` component.

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
