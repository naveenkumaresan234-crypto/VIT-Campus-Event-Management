
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/vit_campus_events";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

// Common schema
const schema = (fields) =>
  new mongoose.Schema(fields, { timestamps: true });

// User model
const User = mongoose.model(
  "User",
  schema({
    name: String,
    email: { type: String, unique: true },
    passwordHash: String,
    role: { type: String, default: "student" }
  })
);

// Venue model
const Venue = mongoose.model(
  "Venue",
  schema({
    name: { type: String, unique: true },
    location: String,
    capacity: Number,
    facilities: [String],
    isActive: { type: Boolean, default: true }
  })
);

// Event model
const Event = mongoose.model(
  "Event",
  schema({
    title: String,
    description: String,
    category: String,
    date: Date,
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue"
    },
    capacity: Number,
    status: { type: String, default: "Draft" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  })
);

// Booking model - corrected references
const Booking = mongoose.model(
  "Booking",
  schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue"
    },
    eventTitle: String,
    date: Date,
    startTime: String,
    endTime: String,
    attendees: Number,
    purpose: String,
    status: { type: String, default: "Pending" }
  })
);

// Registration model - corrected references
const Registration = mongoose.model(
  "Registration",
  schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event"
    },
    status: { type: String, default: "Registered" }
  })
);

Registration.schema.index(
  { user: 1, event: 1 },
  { unique: true }
);

// Express configuration
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-this",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGODB_URI
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 14400000
    }
  })
);

// Common template variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;

  delete req.session.flash;

  res.locals.date = (d) =>
    d ? new Date(d).toLocaleString("en-IN") : "";

  next();
});

// Helper functions
const msg = (req, type, text) => {
  req.session.flash = { type, text };
};

const login = (req, res, next) =>
  req.session.user
    ? next()
    : (msg(req, "warning", "Please log in first."),
      res.redirect("/login"));

const admin = (req, res, next) =>
  req.session.user?.role === "admin"
    ? next()
    : (msg(req, "danger", "Administrator access required."),
      res.redirect("/"));

// Home page
app.get("/", async (req, res) => {
  const events = await Event.find({
    status: "Published",
    date: { $gte: new Date() }
  })
    .populate("venue")
    .sort({ date: 1 })
    .limit(6);

  res.render("home", { events });
});

// Student registration
app.get("/register", (req, res) => {
  res.render("auth", { mode: "register" });
});

app.post("/register", async (req, res) => {
  try {
    let { name, email, password } = req.body;

    email = email.toLowerCase().trim();

    if (!name || !password || password.length < 8) {
      throw Error(
        "Enter your name and a password of at least 8 characters."
      );
    }

    if (await User.findOne({ email })) {
      throw Error("Email already registered.");
    }

    const u = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12)
    });

    req.session.user = {
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role
    };

    msg(req, "success", "Account created.");
    res.redirect("/");
  } catch (error) {
    msg(req, "danger", error.message);
    res.redirect("/register");
  }
});

// Login
app.get("/login", (req, res) => {
  res.render("auth", { mode: "login" });
});

app.post("/login", async (req, res) => {
  const u = await User.findOne({
    email: req.body.email.toLowerCase().trim()
  });

  if (!u || !await bcrypt.compare(req.body.password, u.passwordHash)) {
    msg(req, "danger", "Invalid email or password.");
    return res.redirect("/login");
  }

  req.session.user = {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role
  };

  res.redirect(u.role === "admin" ? "/admin" : "/");
});

// Logout
app.post("/logout", login, (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Explore events
app.get("/events", async (req, res) => {
  const events = await Event.find({
    status: "Published"
  })
    .populate("venue")
    .sort({ date: 1 });

  res.render("events", { events });
});

// Event details
app.get("/events/:id", async (req, res) => {
  const event = await Event.findById(req.params.id).populate("venue");

  if (!event) {
    return res.status(404).render("error", {
      message: "Event not found"
    });
  }

  const count = await Registration.countDocuments({
    event: event._id,
    status: "Registered"
  });

  const registered = req.session.user
    ? await Registration.exists({
        event: event._id,
        user: req.session.user.id,
        status: "Registered"
      })
    : false;

  res.render("event", {
    event,
    count,
    registered: !!registered
  });
});

// Student event registration
app.post("/events/:id/register", login, async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event || event.date < new Date()) {
    return res.redirect("/events");
  }

  const exists = await Registration.findOne({
    event: event._id,
    user: req.session.user.id
  });

  const count = await Registration.countDocuments({
    event: event._id,
    status: "Registered"
  });

  if (count >= event.capacity) {
    msg(req, "warning", "Event is full.");
    return res.redirect("/events/" + event._id);
  }

  if (exists) {
    exists.status = "Registered";
    await exists.save();
  } else {
    await Registration.create({
      event: event._id,
      user: req.session.user.id
    });
  }

  msg(req, "success", "Registration successful.");
  res.redirect("/my-registrations");
});

// Cancel event registration
app.post("/events/:id/cancel", login, async (req, res) => {
  await Registration.findOneAndUpdate(
    {
      event: req.params.id,
      user: req.session.user.id
    },
    { status: "Cancelled" }
  );

  res.redirect("/my-registrations");
});

// My registrations - corrected population
app.get("/my-registrations", login, async (req, res) => {
  const items = await Registration.find({
    user: req.session.user.id
  }).populate({
    path: "event",
    populate: {
      path: "venue"
    }
  });

  res.render("registrations", { items });
});

// Venues
app.get("/venues", admin, async (req, res) => {
  const venues = await Venue.find().sort({ name: 1 });
  res.render("venues", { venues });
});

app.post("/venues", admin, async (req, res) => {
  try {
    await Venue.create({
      name: req.body.name,
      location: req.body.location,
      capacity: +req.body.capacity,
      facilities: (req.body.facilities || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    });

    msg(req, "success", "Venue added.");
  } catch (error) {
    msg(req, "danger", error.message);
  }

  res.redirect("/venues");
});

app.post("/venues/:id/toggle", admin, async (req, res) => {
  const v = await Venue.findById(req.params.id);
  v.isActive = !v.isActive;
  await v.save();

  res.redirect("/venues");
});

// Venue booking
app.get("/book-venue", login, async (req, res) => {
  const venues = await Venue.find({ isActive: true });
  res.render("book", { venues });
});

app.post("/book-venue", login, async (req, res) => {
  const v = await Venue.findById(req.body.venue);

  if (
    !v ||
    +req.body.attendees > v.capacity ||
    req.body.startTime >= req.body.endTime
  ) {
    msg(req, "danger", "Check venue, capacity and time.");
    return res.redirect("/book-venue");
  }

  const day = new Date(req.body.date);
  const start = new Date(day);
  const end = new Date(day);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const conflict = await Booking.findOne({
    venue: v._id,
    date: { $gte: start, $lte: end },
    status: "Approved",
    startTime: { $lt: req.body.endTime },
    endTime: { $gt: req.body.startTime }
  });

  if (conflict) {
    msg(req, "danger", "This venue has an overlapping approved booking.");
    return res.redirect("/book-venue");
  }

  await Booking.create({
    user: req.session.user.id,
    venue: v._id,
    eventTitle: req.body.eventTitle,
    date: req.body.date,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    attendees: +req.body.attendees,
    purpose: req.body.purpose
  });

  msg(req, "success", "Booking request submitted.");
  res.redirect("/my-bookings");
});

// My bookings
app.get("/my-bookings", login, async (req, res) => {
  const items = await Booking.find({
    user: req.session.user.id
  }).populate("venue");

  res.render("bookings", { items });
});

// Admin dashboard
app.get("/admin", admin, async (req, res) => {
  const [
    students,
    events,
    venues,
    registrations,
    pending,
    bookings
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    Event.countDocuments(),
    Venue.countDocuments({ isActive: true }),
    Registration.countDocuments({ status: "Registered" }),
    Booking.countDocuments({ status: "Pending" }),
    Booking.find()
      .populate("user")
      .populate("venue")
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  res.render("admin", {
    stats: {
      students,
      events,
      venues,
      registrations,
      pending
    },
    bookings
  });
});

// Admin event management
app.get("/admin/events", admin, async (req, res) => {
  const events = await Event.find()
    .populate("venue")
    .sort({ date: -1 });

  const venues = await Venue.find({ isActive: true });

  res.render("manage-events", { events, venues });
});

app.post("/admin/events", admin, async (req, res) => {
  await Event.create({
    title: req.body.title,
    description: req.body.description,
    category: req.body.category,
    date: req.body.date,
    venue: req.body.venue,
    capacity: +req.body.capacity,
    status: req.body.status,
    createdBy: req.session.user.id
  });

  msg(req, "success", "Event saved.");
  res.redirect("/admin/events");
});

// Delete event
app.post("/admin/events/:id/delete", admin, async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);

  await Registration.deleteMany({
    event: req.params.id
  });

  res.redirect("/admin/events");
});

// Admin bookings
app.get("/admin/bookings", admin, async (req, res) => {
  const items = await Booking.find()
    .populate("user")
    .populate("venue")
    .sort({ createdAt: -1 });

  res.render("admin-bookings", { items });
});

// Approve or reject bookings
app.post("/admin/bookings/:id", admin, async (req, res) => {
  const b = await Booking.findById(req.params.id);

  if (b) {
    if (req.body.status === "Approved") {
      const d = new Date(b.date);
      const s = new Date(d);
      const e = new Date(d);

      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);

      const clash = await Booking.findOne({
        _id: { $ne: b._id },
        venue: b.venue,
        date: { $gte: s, $lte: e },
        status: "Approved",
        startTime: { $lt: b.endTime },
        endTime: { $gt: b.startTime }
      });

      if (clash) {
        msg(req, "danger", "Another approved booking overlaps.");
        return res.redirect("/admin/bookings");
      }
    }

    b.status = req.body.status;
    await b.save();
  }

  res.redirect("/admin/bookings");
});

// Admin registrations
app.get("/admin/registrations", admin, async (req, res) => {
  const items = await Registration.find()
    .populate("user")
    .populate("event")
    .sort({ createdAt: -1 });

  res.render("registrations-admin", { items });
});

// Reports
app.get("/admin/reports", admin, async (req, res) => {
  const [
    eventCount,
    venueCount,
    studentCount,
    regCount,
    statuses
  ] = await Promise.all([
    Event.countDocuments(),
    Venue.countDocuments({ isActive: true }),
    User.countDocuments({ role: "student" }),
    Registration.countDocuments({ status: "Registered" }),
    Booking.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  res.render("reports", {
    r: {
      eventCount,
      venueCount,
      studentCount,
      regCount,
      statuses
    }
  });
});

// VIT logo test
app.get("/test-logo", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "images", "vit-logo.png")
  );
});

// 404 page
app.use((req, res) => {
  res.status(404).render("error", {
    message: "Page not found."
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`VIT Campus Events running at http://localhost:${PORT}`);
});
