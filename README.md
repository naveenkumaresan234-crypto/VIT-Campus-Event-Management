# VIT Vellore Campus Event & Venue Management Portal

Professional responsive academic project built with HTML, CSS, Bootstrap, jQuery, Node.js, Express.js, MongoDB, Mongoose and EJS.

## Setup
1. Install Node.js LTS and MongoDB Community Server (or use MongoDB Atlas).
2. Extract this ZIP and open the folder in VS Code.
3. Copy `.env.example` to `.env` and update the session secret/admin password.
4. Open terminal in this folder and run:
   ```bash
   npm install
   npm run seed:admin
   npm run seed:campus
   npm start
   ```
5. Open http://localhost:3000

## Admin login
Use the email and password configured in `.env`. Example defaults:
- Email: `admin@vit.local`
- Password: `ChangeMe@123`

Change these credentials before using the project beyond a local demonstration.

## VIT sample data
`npm run seed:campus` adds 5 venue records and 4 sample event records. Venue names and capacities are based on VIT Vellore's official infrastructure information. The recurring fest names Riviera and graVITas are included as draft sample listings. Their dates are placeholders, not official future schedules. An administrator must verify and edit dates and venue details before publishing.

Official references:
- https://vit.ac.in/about/infrastructure
- https://vit.ac.in/event/riviera-2026
- https://gravitas.vit.ac.in/events

## Main features
Student signup/login, event discovery and registration, cancellation, venue request, booking status; admin dashboard, event management, venue management, booking approval, registration list and reports.

## Note
Academic demonstration starter. For production, add CSRF protection, rate limiting, stricter validation, audit logs, email verification and HTTPS. Verify current campus booking permissions and venue availability with VIT administration before treating any booking as confirmed.
