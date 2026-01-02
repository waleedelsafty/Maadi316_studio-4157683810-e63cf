# **App Name**: 316Maadi Management System

## Core Features:

- User Authentication and Authorization: Secure user login with role-based access control (Super Admin, Board Member, Owner, Tenant) using Firebase Authentication to restrict access to sensitive data and functionalities.
- Building Configuration Management: Allows Super Admins to manage building-wide settings such as common area sizes and financial parameters via the building_settings collection. Implements UI to edit global_amenities_sqm, floor_standard_sqm, current_annual_budget, and last_recalculation_date.
- Unit Inventory Management: CRUD operations for managing unit details (code, type, billing_parent_code, area breakdown, financials) within the units collection.
- Pro-Rata Area Calculation: Automated calculation of common area shares (local and global) based on unit size (Algorithm A) triggered by unit updates or changes to building settings.  Accurately computes Unit_Local_Share and Unit_Global_Share, then updates total_gross_sqm.
- Budget-Based Fee Calculation: Zero-sum budget distribution (Algorithm B) triggered by the Board clicking 'Recalculate Fees' with a new budget input. It uses Firestore data to calculate Total Weight, Cost_Per_Point, and the New_Fee for each unit, displaying the fee clearly to the user.
- Financial Transparency UI: Clear display of the cost breakdown for each unit, showcasing the mathematical derivation of fees including area calculations and common area shares.  Displays Net Area separate from Gross Area and flags Parent/Child unit relationships.
- Audit Tool: Allows the Board to audit area calculations, fee breakdowns, and parent/child unit relationships through a dedicated admin interface, allowing data to be displayed.

## Style Guidelines:

- Primary color: Deep blue (#293B5F) to evoke trust, stability, and professionalism in financial management.
- Background color: Light gray (#D3D9E3), providing a neutral and clean backdrop.
- Accent color: Soft orange (#D98828) for highlighting key actions and important financial data.
- Body and headline font: 'Inter' sans-serif, for a modern, machined and neutral feel, which supports readability.
- Simple, geometric icons to represent different unit types (flat, duplex, shop, office) and financial metrics.
- Clear and structured layout emphasizing data transparency, with distinct sections for area breakdown, fee calculations, and audit trails.
- Subtle animations for data updates and recalculations, providing visual feedback without being distracting.