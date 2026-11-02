
require("dotenv").config();
const mongoose = require("mongoose");

const Venue = require("./models/Venue");
const Event = require("./models/Event");
const User = require("./models/User");

const venues = [
  ["Anna Auditorium", "Near Volleyball and Basketball Courts, VIT Vellore", 1800, "Centralised AC,Wi-Fi,Stage,Green rooms,Lighting"],
  ["Dr. M. Channa Reddy Auditorium", "Dr. M.G.R. Block, VIT Vellore", 469, "Auditorium seating,Stage,Conference facilities"],
  ["Dr. Ambedkar Auditorium", "VIT Vellore Campus", 198, "Auditorium seating,Stage"],
  ["Kamaraj Auditorium", "VIT Vellore Campus", 128, "Auditorium seating,Stage"],
  ["Era Sezhiyan Auditorium", "Gandhi Block, VIT Vellore", 462, "Auditorium seating,Stage"]
];

const events = [
  ["Riviera – Cultural & Sports Festival", "Sample listing for VIT Vellore's recurring cultural and sports festival. Confirm official schedule before publishing.", "Cultural", "2027-02-26", 1800],
  ["graVITas – Technical Festival", "Sample listing for VIT Vellore's recurring technical and management fest. Confirm official schedule before publishing.", "Technical", "2027-09-16", 469],
  ["Campus Innovation & Project Expo", "Demonstration listing for student projects and innovation showcases. Confirm date and venue before publishing.", "Academic", "2027-03-15", 198],
  ["Student Music & Talent Showcase", "Demonstration listing for a student cultural showcase. Confirm organiser, date and venue before publishing.", "Cultural", "2027-04-10", 128]
];

(async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/vit_campus_events"
    );

    const admin = await User.findOne({ role: "admin" });

    if (!admin) {
      throw Error("Run npm run seed:admin first.");
    }

    const map = {};

    for (const [name, location, capacity, fac] of venues) {
      map[name] = await Venue.findOneAndUpdate(
        { name },
        {
          $setOnInsert: {
            name,
            location,
            capacity,
            facilities: fac.split(",")
          }
        },
        { upsert: true, new: true }
      );
    }

    const names = venues.map(v => v[0]);

    for (let i = 0; i < events.length; i++) {
      const [title, description, category, date, capacity] = events[i];

      await Event.findOneAndUpdate(
        { title },
        {
          $set: {
            status: "Published"
          },
          $setOnInsert: {
            title,
            description,
            category,
            date: new Date(date + "T09:00:00"),
            capacity,
            venue: map[names[i]]._id,
            createdBy: admin._id
          }
        },
        { upsert: true, new: true }
      );
    }

    console.log("Successfully published 4 VIT sample events!");
    console.log("5 VIT venues are available.");

  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
