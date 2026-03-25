require('dotenv').config();
const { sendEmail } = require("./emailService");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { admin, db } = require("./firebase");
const app = express();

// ================= CORS CONFIGURATION =================
const allowedOrigins = [
  'https://webconnecta-admin.web.app',
  'https://webconnecta-resident.web.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://connecta-backend-u4tw.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️ Blocked origin:', origin);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// ================= SIGNUP =================
app.post("/signup", async (req, res) => {
  console.log("Received:", req.body);

  const { firstname, lastname, email, contact, address, password, proofOfResidency } = req.body;

  try {
    const user = await admin.auth().createUser({
      email: email,
      password: password
    });

    await db.collection("residents").doc(user.uid).set({
      firstname,
      lastname,
      email,
      contact,
      address,
      role: "resident",
      proofOfResidency,
      profileImage: "",
      acceptedTerms: false,
      isverified: false,
      createdAt: Date.now()
    });

    res.status(200).json({
      message: "User registered successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ================= CREATE REPORT =================
app.post("/report", async (req, res) => {
  const { category, location, description, proofofReport, uid } = req.body;

  try {
    const residentDoc = await db.collection("residents").doc(uid).get();

    if (!residentDoc.exists) {
      return res.status(404).json({
        message: "Resident not found"
      });
    }

    const residentData = residentDoc.data();

    const reportData = {
      category,
      location,
      description,
      proofofReport,
      reportedBy: uid,
      residentName: residentData.firstname + " " + residentData.lastname,
      email: residentData.email,
      contact: residentData.contact,
      status: "pending",
      assignedTo: null,
      createdAt: Date.now()
    };

    const reportRef = await db.collection("reports").add(reportData);

    console.log("Report received:", req.body);

    res.status(200).json({
      message: "Report submitted successfully",
      reportId: reportRef.id
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ================= PENDING RESIDENTS =================
app.get("/pending-residents", async (req, res) => {
  try {
    const snapshot = await db
      .collection("residents")
      .where("isverified", "==", false)
      .get();

    const residents = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
      profileImage: doc.data().profileImage || ""
    }));

    res.json(residents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= APPROVE RESIDENT =================
app.put("/approve-resident/:uid", async (req, res) => {
  const { uid } = req.params;

  try {
    await db.collection("residents").doc(uid).update({
      isverified: true
    });

    res.json({ message: "Resident approved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= REJECT RESIDENT =================
app.post("/reject-resident", async (req, res) => {
  const { email, message } = req.body;

  try {
    const snapshot = await db
      .collection("residents")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "Resident not found" });
    }

    const userDoc = snapshot.docs[0];
    await db.collection("residents").doc(userDoc.id).delete();

    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(user.uid);

    // ✅ SEND EMAIL HERE
    await sendEmail(
      email,
      "Application Rejected",
      `Your application has been rejected.\n\nReason:\n${message}`
    );

    res.json({ message: "Resident rejected and email sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= STAFFS =================
app.get("/staffs", async (req, res) => {
  try {
    const snapshot = await db.collection("residents").get();

    const staffs = snapshot.docs
      .map(doc => ({
        uid: doc.id,
        ...doc.data(),
        profileImage: doc.data().profileImage || ""
      }))
      .filter(user => user.role !== "resident");

    res.json(staffs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= RESIDENTS =================
app.get("/residents", async (req, res) => {
  try {
    const snapshot = await db
      .collection("residents")
      .where("role", "==", "resident")
      .where("isverified", "==", true)
      .get();

    const residents = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
      profileImage: doc.data().profileImage || ""
    }));

    res.json(residents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= REPORTS BY USER =================
app.get("/reports/:uid", async (req, res) => {
  const { uid } = req.params;

  try {
    const snapshot = await db
      .collection("reports")
      .where("reportedBy", "==", uid)
      .get();

    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= RESIDENT DETAILS (with combined permissions) =================
app.get("/resident/:uid", async (req, res) => {
  const { uid } = req.params;

  try {
    const doc = await db.collection("residents").doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Resident not found" });
    }

    const data = doc.data();
    
    // Get role permissions
    let rolePermissions = [];
    if (data.role && data.role !== "resident") {
      const rolesDoc = await db.collection("system_settings").doc("roles").get();
      if (rolesDoc.exists) {
        const rolesData = rolesDoc.data();
        const role = rolesData.roles?.find(r => r.name === data.role);
        rolePermissions = role?.permissions || [];
      }
    }
    
    // Combine role permissions with custom permissions
    const customPermissions = data.customPermissions || [];
    const allPermissions = [...new Set([...rolePermissions, ...customPermissions])];
    
    res.json({
      uid: doc.id,
      ...data,
      profileImage: data.profileImage || "",
      permissions: allPermissions, // Send combined permissions
      rolePermissions: rolePermissions,
      customPermissions: customPermissions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ================= UPDATE ACCOUNT =================
app.put("/update-account/:uid", async (req, res) => {
  const { uid } = req.params;
  const {
    firstname,
    lastname,
    email,
    contact,
    address,
    profileImage,
    role
  } = req.body;

  try {
    await admin.auth().updateUser(uid, {
      email
    });

    const updateData = {
      firstname,
      lastname,
      email,
      contact,
      address,
      profileImage
    };

    if (role) {
      updateData.role = role;
    }

    await db.collection("residents").doc(uid).update(updateData);

    res.json({
      message: "Account updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ================= UPDATE PASSWORD =================
app.put("/update-password/:uid", async (req, res) => {
  const { uid } = req.params;
  const { newpass } = req.body;

  try {
    await admin.auth().updateUser(uid, {
      password: newpass
    });

    res.json({
      message: "Password updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ================= DELETE ACCOUNT =================
app.delete("/delete-account/:uid", async (req, res) => {
  const { uid } = req.params;

  try {
    await admin.auth().deleteUser(uid);
    await db.collection("residents").doc(uid).delete();

    res.json({
      message: "Account deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ================= ADMIN: GET UNASSIGNED REPORTS =================
app.get("/admin/reports", async (req, res) => {
  const { search = "", status = "" } = req.query;

  try {
    const snapshot = await db
      .collection("reports")
      .where("assignedTo", "==", null)
      .get();

    const reports = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const report = doc.data();

        const residentDoc = await db
          .collection("residents")
          .doc(report.reportedBy)
          .get();

        const resident = residentDoc.data();

        return {
          id: doc.id,
          ...report,
          email: resident?.email || "",
          contact: resident?.contact || ""
        };
      })
    );

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= ADMIN: GET MY CASES =================
app.get("/admin/my-cases/:adminId", async (req, res) => {
  const { adminId } = req.params;

  try {
    const snapshot = await db
      .collection("reports")
      .where("assignedTo", "==", adminId)
      .get();

    const reports = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const report = doc.data();

        const residentDoc = await db
          .collection("residents")
          .doc(report.reportedBy)
          .get();

        const resident = residentDoc.data();

        let assignedName = null;

        if (report.assignedTo) {
          const assignedDoc = await db
            .collection("residents")
            .doc(report.assignedTo)
            .get();

          const assignedData = assignedDoc.data();

          assignedName = assignedData
            ? assignedData.firstname + " " + assignedData.lastname
            : null;
        }

        return {
          id: doc.id,
          ...report,
          email: resident?.email || "",
          contact: resident?.contact || "",
          assignedName
        };
      })
    );

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= ADMIN: ASSIGN REPORT =================
app.put("/admin/assign-report/:id", async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.body;

  try {
    await db.collection("reports").doc(id).update({
      status: "reviewing",
      assignedTo: adminId
    });

    res.json({ message: "Report assigned successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= ADMIN: REVIEW REPORT (NO EMAIL) =================
app.put("/admin/review-report/:id", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  try {
    const reportDoc = await db.collection("reports").doc(id).get();
    if (!reportDoc.exists) {
      return res.status(404).json({ message: "Report not found" });
    }
    const report = reportDoc.data();
    
    const residentDoc = await db.collection("residents").doc(report.reportedBy).get();
    if (!residentDoc.exists) {
      return res.status(404).json({ message: "Resident not found" });
    }
    
    await db.collection("reports").doc(id).update({
      status: "ongoing",
      adminMessage: message
    });
    
    res.json({ 
      message: "Report moved to ongoing"
    });
  } catch (error) {
    console.error("Error in review-report:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= ADMIN: UPDATE ONGOING (NO EMAIL) =================
app.put("/admin/update-ongoing/:id", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  try {
    const reportDoc = await db.collection("reports").doc(id).get();
    if (!reportDoc.exists) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    await db.collection("reports").doc(id).update({
      adminMessage: message,
      updatedAt: Date.now()
    });
    
    res.json({ 
      message: "Ongoing update sent successfully"
    });
  } catch (error) {
    console.error("Error in update-ongoing:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= ADMIN: RESOLVE REPORT (NO EMAIL) =================
app.put("/admin/resolve-report/:id", async (req, res) => {
  const { id } = req.params;
  const { message, media } = req.body;

  try {
    const reportDoc = await db.collection("reports").doc(id).get();
    if (!reportDoc.exists) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    await db.collection("reports").doc(id).update({
      status: "resolved",
      resolutionMessage: message,
      resolutionMedia: media
    });
    
    res.json({ 
      message: "Report resolved successfully"
    });
  } catch (error) {
    console.error("Error in resolve-report:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= CREATE STAFF =================
app.post("/create-staff", async (req, res) => {
  const { firstname, lastname, email, phone, role } = req.body;

  try {
    const user = await admin.auth().createUser({
      email: email,
      password: "123456"
    });

    const roleDoc = await db.collection("system_settings").doc("roles").get();

    let permissions = [];

    if (roleDoc.exists) {
      const rolesData = roleDoc.data().roles;

      const selectedRole = rolesData.find(
        r => r.name.toLowerCase() === role.toLowerCase()
      );

      permissions = selectedRole?.permissions || [];
    }

    await db.collection("residents").doc(user.uid).set({
      firstname,
      lastname,
      email,
      contact: phone,
      address: "",
      role,
      permissions: permissions || [],
      profileImage: "",
      isverified: true,
      createdAt: Date.now()
    });

    res.json({ message: "Staff created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= NEWS POSTS (NO EMAIL NOTIFICATIONS) =================
app.post("/admin/news", async (req, res) => {
  const {
    title,
    category,
    description,
    media,
    status,
    schedule,
    adminUID
  } = req.body;

  console.log("📰 Creating news post:", { title, category, status, adminUID });

  try {
    const adminDoc = await db.collection("residents").doc(adminUID).get();

    if (!adminDoc.exists) {
      console.error("❌ Admin not found:", adminUID);
      return res.status(404).json({ message: "Admin not found" });
    }

    const adminData = adminDoc.data();

    const post = {
      title,
      category,
      description,
      media,
      status,
      schedule,
      adminUID,
      postedBy: adminData.firstname + " " + adminData.lastname,
      role: adminData.role,
      createdAt: Date.now()
    };

    const doc = await db.collection("news").add(post);
    console.log("✅ News post created with ID:", doc.id);
    
    res.json({
      message: "Post created",
      id: doc.id
    });
  } catch (err) {
    console.error("❌ Error creating news post:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get news for public (residents)
app.get("/news", async (req, res) => {
  try {
    const snapshot = await db.collection("news")
      .orderBy("createdAt", "desc")
      .get();

    const now = new Date();

    const posts = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(post => {
        if (post.status !== "Scheduled") return true;
        const scheduleDate = new Date(post.schedule);
        return now >= scheduleDate;
      })
      .map(post => {
        if (post.status === "Scheduled") {
          return { ...post, status: "Published" };
        }
        return post;
      });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all news for admin (including scheduled)
app.get("/admin/news", async (req, res) => {
  try {
    const snapshot = await db.collection("news")
      .orderBy("createdAt", "desc")
      .get();

    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📋 Fetched ${posts.length} posts for admin`);
    res.json(posts);
  } catch (err) {
    console.error("❌ Error fetching admin news:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update news post
app.put("/admin/news/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    await db.collection("news").doc(id).update(updates);
    console.log(`✏️ Updated news post: ${id}`);
    res.json({ message: "Post updated" });
  } catch (err) {
    console.error("❌ Error updating news post:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete news post
app.delete("/admin/news/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("news").doc(id).delete();
    console.log(`🗑️ Deleted news post: ${id}`);
    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("❌ Error deleting news post:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= SYSTEM SETTINGS =================
app.post("/admin/settings/:type", async (req, res) => {
  const { type } = req.params;
  const data = req.body;

  try {
    await db.collection("system_settings").doc(type).set(data);
    res.json({ message: "Saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/settings/:type", async (req, res) => {
  const { type } = req.params;

  try {
    const doc = await db.collection("system_settings").doc(type).get();

    if (!doc.exists) {
      return res.json(null);
    }

    res.json(doc.data());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= UPDATE STAFF PERMISSIONS =================
app.put("/update-staff-permissions/:uid", async (req, res) => {
  const { uid } = req.params;
  const { customPermissions } = req.body;

  try {
    await db.collection("residents").doc(uid).update({
      customPermissions: customPermissions || []
    });

    res.json({ 
      message: "Staff permissions updated successfully",
      customPermissions 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= USER NOTIFICATION SETTINGS =================
app.get("/user/notification-settings/:uid", async (req, res) => {
  const { uid } = req.params;
  
  try {
    const userDoc = await db.collection("residents").doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userData = userDoc.data();
    const settings = userData.notificationSettings || {
      reports: true,
      news: true
    };
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/user/notification-settings/:uid", async (req, res) => {
  const { uid } = req.params;
  const { reports, news } = req.body;
  
  try {
    await db.collection("residents").doc(uid).update({
      notificationSettings: {
        reports: reports,
        news: news
      }
    });
    
    res.json({ 
      message: "Notification settings updated successfully",
      settings: { reports, news }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});