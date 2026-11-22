# Requirements Document

## 1. Application Overview
Faded6 (tagline: \"Faded6 Ticket Platform\") is a mobile-first event ticketing web application tailored for Nigerian nightlife, concerts, and campus events (currency: NGN / ₦). The platform features a high-contrast dark mode aesthetic (deep matte black `#0A0A0C`, slate borders, and electric accent highlights) optimized for fast on-the-go interaction.

Faded6 allows Event Hosts to register, configure dynamic ticket tiers, manage inventory and sales metrics, access a unified guest list with manual check-in and CSV export, generate official \"Faded6 Instant Gate Pass\" walk-up QR posters, and verify tickets at venue doors using an in-browser QR camera scanner. Ticket Buyers can purchase tickets without creating an account, pay via the production Paystack inline checkout with an automatic flat ₦350 platform service fee on paid orders, and instantly receive scannable digital QR tickets with unique `F6-` prefixed backup codes both on-screen (redirecting to `/ticket/[ticket-code]`) and via email.

## 2. User Roles & Use Cases

### 2.1 Target Users
- **Event Host (Organizer):** Organizers who register and log in to create and manage events, monitor ticket inventory and sales, manage the attendee guest list, manually or via QR check in attendees, export attendee CSVs, share event purchase links, and download the Faded6 Instant Gate Pass poster.
- **Ticket Buyer (Attendee):** Guests who access public event pages or scan entrance walk-up QRs, select ticket tiers, provide contact information, pay via Paystack inline checkout, and obtain scannable digital tickets without account registration.

### 2.2 Core Use Cases
- **Host Account & Event Setup:** Host registers/logs in, submits event details and ticket tiers, and retrieves shareable public URLs and printable Faded6 Instant Gate Pass walk-up purchase QR posters.
- **Event Discovery & Ticket Purchase:** Attendee views event details, selects ticket quantities, reviews price breakdown including the flat ₦350 fee for paid orders, enters full name and email, and completes Paystack payment.
- **Ticket Issuance & Receipt:** Upon Paystack payment confirmation, system writes ticket records to backend database, decrements inventory, generates unique `F6-` prefixed ticket codes, automatically redirects to `/ticket/[ticket-code]`, and sends a confirmation email.
- **Guest List Management & Door Verification:** Host monitors attendee roster via the Guest List tab, performs manual check-in or camera-based QR scanning, filters and searches attendees, and exports guest data as CSV.

## 3. Page Structure & Functional Specifications

### 3.1 Page Structure Overview
```
Faded6 Ticket Platform
├── Authentication
│   ├── Host Login Page
│   └── Host Sign Up Page
├── Host Dashboard
│   ├── Event List / Overview
│   ├── Create Event Page
│   ├── Event Management Dashboard
│   │   ├── Overview & Metrics
│   │   └── Guest List Section
│   └── Gate Scanner Page
└── Public Event & Purchase
    ├── Public Event Details & Tier Selection Page
    ├── Checkout & Payment Summary Page
    └── Ticket Confirmation & Digital Ticket Page (/ticket/[ticket-code])
```

### 3.2 Page Functional Specifications

#### 3.2.1 Host Authentication (Login / Sign Up)
- **Sign Up:** Hosts register using email and password.
- **Login:** Existing hosts authenticate via email and password to access their management dashboard.

#### 3.2.2 Host Dashboard (Event Overview & Creation)
- **Event List Overview:** Displays all events created by the logged-in host, including event title, date, total tickets sold, and links to event management.
- **Create Event Page:**
  - Event detail inputs: Event Title, Description, Date & Time, Venue/Location, and Banner Image upload.
  - Dynamic Ticket Tiers: Ability to add one or multiple ticket tiers. Each tier requires Tier Name, Price in NGN (allows ₦0 for free tickets), and Total Quantity Available (inventory limit).
  - Submission: Creates the event, generates a unique public URL, and generates a downloadable/printable \"Faded6 Instant Gate Pass\" walk-up QR poster framed with: \"Skip the queue — Scan to buy your ticket on Faded6\".

#### 3.2.3 Event Management Dashboard
- **Metrics Overview:** Displays total tickets sold, remaining inventory per ticket tier, and total revenue generated in NGN.
- **Asset Sharing:** Displays the public event URL and the Faded6 Instant Gate Pass poster with options to download or copy the link.
- **Launch Scanner Action:** Prominent primary electric-accented action button to navigate directly to the Gate Scanner Page for the selected event.
- **Unified Guest List Tab/Section:**
  - **Attendee Table / Roster:** Displays every attendee who purchased or claimed a ticket for the event. Each record presents: Buyer Full Name, Email Address, Ticket Tier Name, Ticket Code (e.g., `F6-8492-XK`), Amount Paid in NGN, Paystack Reference (or free order identifier), and Check-In Status badge (green \"Checked In\" with timestamp or gray \"Not Scanned\").
  - **Search & Filters:** Real-time search bar filtering across Buyer Name, Email, and `F6-` Ticket Code. Filter dropdowns for Ticket Tier and Check-In Status (\"All\", \"Checked In\", \"Pending\").
  - **Manual Check-In Action:** A dedicated \"Check In\" button alongside each pending attendee record to manually validate entry at the door as a backup to camera scanning.
  - **Export CSV Action:** A one-click \"Export Guest List (CSV)\" button triggering direct download of the full attendee dataset.
  - **Mobile Door Ergonomics:** Mobile-optimized layout with minimum 44px touch targets for buttons/actions, strict vertical flow without horizontal page scrolling, and a clear empty state view when no tickets have been issued.

#### 3.2.4 Gate Scanner Page
- **Browser-Based Camera Scanner:** Uses the device camera within the browser to scan attendee ticket QR codes in real time.
- **Scan Result Display:**
  - Valid Ticket (Not checked in): Displays a green success banner, buyer name, ticket tier, and automatically marks the ticket as checked in.
  - Already Used Ticket: Displays an alert indicating the ticket was previously checked in, along with the original check-in timestamp.
  - Invalid Ticket: Displays a red error indicating the ticket does not exist or does not belong to the current event.
- **Walk-Up Gate Purchase Toggle:** Displays the event Faded6 Instant Gate Pass purchase QR code on screen for walk-up guests to scan and purchase immediately.

#### 3.2.5 Public Event Details & Tier Selection Page
- **Event Display:** High-contrast dark mode interface displaying event banner image, title, date & time, venue, and description.
- **Ticket Tier Selection:** Lists configured ticket tiers with tier name, price in NGN, and availability status (shows \"Sold Out\" if remaining inventory is 0).
- **Quantity Selection:** Allows buyers to choose ticket quantities for available tiers.

#### 3.2.6 Checkout & Payment Summary Page
- **Buyer Form Validation:** Requires Buyer Full Name and a valid format Email Address before permitting payment initiation.
- **Order Fee Breakdown:** Displays Itemized Ticket Subtotal, Platform Service Fee (flat ₦350 per paid order; ₦0 for free orders), and Total Payable in NGN.
- **Paystack Key Configuration & Error Handling:** App loads the Paystack public key via client environment configuration `VITE_PAYSTACK_PUBLIC_KEY` with server-provided fallback. If the public key is missing or invalid, an on-screen error banner is rendered and payment initiation is blocked to prevent silent failures.
- **Paystack Inline Payment Flow:**
  - Paid orders initiate official Paystack inline popup checkout with total amount converted from Naira to Kobo (Total NGN * 100), currency NGN, unique transaction reference prefixed with `F6_`, and metadata containing Buyer Name, Buyer Email, Event ID, and Ticket Tier.
  - Mock, dummy, or demo-mode payment code paths are excluded; all payments process through live Paystack integration.
  - Cancellation handling: If the buyer closes the Paystack popup before completion, an on-screen notice informs the buyer that payment was cancelled and no ticket was issued.
  - Free orders (total ₦0) bypass Paystack processing and immediately execute ticket database creation.

#### 3.2.7 Ticket Confirmation & Digital Ticket Page (/ticket/[ticket-code])
- **Immediate Post-Payment Redirection:** Upon successful payment (`onSuccess`) and verified backend ticket creation, unauthenticated guest buyers are automatically redirected to `/ticket/[ticket-code]`.
- **Digital Ticket Display:** Displays order confirmation, event details, attendee name, tier name, scannable QR code, and unique human-readable `F6-` prefixed backup code with ticket download option.
- **Email Delivery:** System sends a confirmation email containing event details, backup code, and digital QR code tickets to the buyer's email address.

## 4. Business Rules & Core Logic

### 4.1 Fee & Pricing Calculation Rules
1. Paid Ticket Orders: Total Payable (NGN) = (Sum of all selected Tier Prices * Quantities) + ₦350.
2. Free Ticket Orders: Total Payable (NGN) = ₦0 (Platform service fee is ₦0).
3. Paystack Transaction Amount: Total Payable in NGN * 100 (converted to Kobo).

### 4.2 Ticket Issuance & Data Persistence Rules
1. Inventory check executes prior to checkout trigger. If requested quantity exceeds remaining inventory, checkout is blocked.
2. On Paystack `onSuccess` callback (or immediately for free orders), system writes ticket record(s) to the backend database with: Event ID, Tier Name, Buyer Full Name, Buyer Email, unique `F6-` prefixed ticket code, Paystack reference, amount paid, creation timestamp, and `is_checked_in = false`.
3. Guest buyers create ticket records without authentication or permission barrier.
4. If backend record creation fails, system logs clear error details and displays an on-screen alert to the buyer.

### 4.3 Check-In Verification & Attendance Rules
1. **QR Verification:**
   - Scanned ticket must exist and belong to the active `event_id`.
   - If `is_checked_in` is `false`: Updates `is_checked_in = true`, sets `checked_in_at` to current timestamp, displays \"VALID TICKET — ADMIT ONE\".
   - If `is_checked_in` is `true`: Displays \"ALREADY USED\" with `checked_in_at` timestamp.
2. **Manual Check-In:** Host clicking \"Check In\" in the Guest List updates `is_checked_in = true` and records `checked_in_at` timestamp in real time.

## 5. Exceptions & Boundary Conditions

| Scenario | Condition | System Behavior |
| :--- | :--- | :--- |
| Missing/Invalid Paystack Key | `VITE_PAYSTACK_PUBLIC_KEY` is undefined, empty, or invalid | Displays prominent error banner on checkout page and disables payment trigger. |
| Form Validation Failure | Buyer name is blank or email format is invalid | Displays field validation errors and blocks payment popup launch. |
| Tier Sold Out | Remaining tier inventory reaches 0 | Tier selector disables input and displays \"Sold Out\" indicator. |
| Payment Popup Closed | User dismisses Paystack inline modal without paying | Displays cancellation notice, keeps buyer on checkout page, issues no tickets. |
| Guest Write Error | Database write error occurs post-payment | Displays user-facing error alert and logs failure details. |
| Camera Permission Denied | Host denies browser camera access on Gate Scanner | Displays permission error message with retry prompt. |
| Wrong Event Scanned | Scanned ticket code belongs to a different event | Displays \"INVALID TICKET - WRONG EVENT\" notice without altering check-in status. |
| Empty Guest List | Event has zero ticket sales | Guest List tab renders an empty state illustration and message: \"No tickets purchased yet\". |

## 6. Acceptance Criteria

1. Checkout page validates presence of valid Paystack public key from `VITE_PAYSTACK_PUBLIC_KEY` (or server fallback) and displays an error banner if missing or invalid.
2. Checkout form enforces required full name and valid email before launching Paystack popup.
3. Paid orders calculate Total = (Price * Quantity) + ₦350 and send amount in Kobo (Total * 100) to Paystack with NGN currency, while free orders complete at ₦0.
4. Successful Paystack payment writes ticket records to backend database with all order details, Paystack reference, `is_checked_in = false`, and unique `F6-` codes for unauthenticated guest buyers.
5. Upon successful ticket write, the buyer is automatically redirected to `/ticket/[ticket-code]` to view and download digital tickets with QR codes.
6. Host Event Management Dashboard includes a Unified Guest List tab displaying Buyer Name, Email, Tier, `F6-` Code, Amount Paid, Reference, and Check-In badge.
7. Guest List search bar filters attendees by Name, Email, and `F6-` code; filter controls support filtering by Tier and Check-In status.
8. Hosts can click \"Check In\" to manually check in attendees directly from the Guest List table.
9. Hosts can click \"Export Guest List (CSV)\" to download the complete attendee roster as a CSV file.
10. Guest List supports mobile venue use with touch targets >= 44px, vertical scroll layout without horizontal overflow, and an empty state view.
11. Gate Scanner verifies QR codes, admits unused tickets, records timestamps, and rejects already-used or mismatched tickets.

## 7. Out of Scope for MVP

1. Automated ticket refund and chargeback workflows.
2. Multi-tier organizer permissions and sub-account staff roles.
3. Custom promotional discount codes and coupons.
4. Payment currencies other than Nigerian Naira (NGN).