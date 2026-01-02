# Building Management App

This is a Next.js application built with Firebase Studio for managing building information, including structural levels and units.

---

## How to Run

1.  Install dependencies: `npm install`
2.  Run the development server: `npm run dev`
3.  Open [http://localhost:9002](http://localhost:9002) with your browser.

---

## Version History

### v0.1.10
- **Refactored Unit Editing**: Replaced the complex inline unit editor on the "All Units" page with a streamlined flow, directing users to a dedicated and more stable "Edit Unit" page. This resolves previous data-binding issues and improves maintainability.
- **Context-Aware Navigation**: Enhanced the "Edit Unit" page to intelligently navigate users back to their original page (either the "All Units" list or a specific "Level" view) after saving or canceling, preserving their workflow context.
- **Dynamic Owner Creation**: Upgraded the "Add Unit" form on the level detail page to use the advanced `OwnerCombobox`, enabling the on-the-fly creation of new unit owners without leaving the page.
- **Dashboard Unit Type Management**: Added a new section to the building dashboard allowing direct management of which global unit types are available for that specific building, improving configuration speed.

### v0.1.9
- **UI & UX Polish**: Improved the permanent delete confirmation dialog by simplifying the required text to "yes delete" for better usability.
- **Safer Dashboard**: Removed the "Danger Zone" section from the building dashboard to reduce the risk of accidental building deletion.
- **Sidebar UI Fix**: Corrected a layout bug in the main sidebar where user information would overlap with action icons when the sidebar was collapsed, ensuring a clean and professional appearance.

### v0.1.8
- **Major Architectural Refactoring**: The monolithic building detail page has been broken down into a more stable and maintainable multi-page structure to resolve critical performance issues in the development environment.
- **New Building Dashboard**: The main page for a building (`/building/[buildingId]`) now serves as a clean dashboard, providing summary information and links to dedicated management sections.
- **Dedicated Structure Page**: A new "Structure" page (`/building/[buildingId]/structure`) is now the central place for creating and managing all building levels and their associated units.
- **Dedicated Financials Page**: A new "Financials" page (`/building/[buildingId]/financials`) now handles all payment recording and financial status tracking for every unit in the building.
- **Contextual Sidebar Navigation**: The main sidebar is now smarter, displaying contextual links for "Structure" and "Financials" only when a user is actively viewing a building.
- **Critical Bug Fixes**: Resolved numerous client-side crashes and navigation errors that arose during the refactoring process, including fixing broken links, incorrect component imports, and table layout mismatches.

### v0.1.7
- **Centralized Payments Tab**: Added a dedicated "Payments" tab on the building detail page, creating a single place to record and view all financial transactions for a building.
- **Smart Payment Form**: The "Record Payment" form now features a searchable combobox to find units by number or owner name. When a unit is selected, its details are displayed and the "Amount Paid" field is auto-filled with the quarterly fee.
- **Dynamic Quarter Selection**: The quarter selection dropdowns are now dynamically populated, showing only relevant quarters from the building's financial start date to two quarters in the future, improving usability.
- **Financials Overhaul**: Completely refactored financial calculations on the "All Units" tab. It now features a quarter-range selector (Current Quarter, YTD, All) and correctly calculates "Total Due," "Total Paid," and "Balance" for the selected period.
- **Date Picker Fixes**: Resolved numerous layout and functionality bugs in the date picker component, ensuring correct rendering and behavior.
- **General Bug Fixes**: Corrected an issue where the "Edit Building" page would appear blank and fixed a crash in the unit search combobox.

### v0.1.6
- **Data Export**: Added functionality to export all building data (details, levels, units) to either JSON or multi-sheet Excel formats via a dropdown menu on the building detail page.
- **Homepage Dashboard Redesign**: The homepage now acts as a true dashboard, displaying a list of building summary cards instead of a simple dropdown, providing an at-a-glance portfolio view.
- **Enhanced Dashboard Visuals**: Added a summary card showing total building count and a bar chart visualizing the number of units per building.
- **Improved Navigation**: Revamped the main sidebar navigation to have distinct "Dashboard", "My Buildings", and "Settings" sections for better organization.
- **Advanced Table Sorting**: The building levels list now features interactive, sortable column headers for name, type, and unit count.
- **UI & UX Polish**: Compacted the layout on the building detail page to reduce whitespace and implemented validation to prevent disabling a building structure type (e.g., "Has Penthouse") if a level of that type already exists.

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
