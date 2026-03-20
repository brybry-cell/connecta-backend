const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { admin, db } = require("./firebase");


const app = express();

app.use(cors());
app.use(bodyParser.json());

app.post("/signup", async (req, res) => {

  console.log("Received:", req.body);

  const { firstname, lastname, email, contact, address, password, proofOfResidency} = req.body;

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

app.post("/report", async (req, res) => {
  const { category, location, description, proofofReport, uid } = req.body;

  try {

    // get resident info
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
      status: "pending",
      assignedTo: null, // 🔥 ADD THIS
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

app.get("/pending-residents", async (req, res) => {
  try {

    const snapshot = await db
      .collection("residents")
      .where("isverified", "==", false)
      .get();

    const residents = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    res.json(residents);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.get("/staffs", async (req, res) => {
  try {

    const snapshot = await db.collection("residents").get();

    const staffs = snapshot.docs
      .map(doc => ({
        uid: doc.id,
        ...doc.data()
      }))
      .filter(user => user.role !== "resident"); // ✅ EXCLUDE RESIDENTS

    res.json(staffs);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/residents", async (req, res) => {
  try {

    const snapshot = await db
      .collection("residents")
      .where("role", "==", "resident")
      .where("isverified", "==", true)
      .get();

    const residents = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    res.json(residents);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.get("/resident/:uid", async (req, res) => {

  const { uid } = req.params;

  try {

    const doc = await db.collection("residents").doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Resident not found" });
    }

    res.json({
      uid: doc.id,
      ...doc.data()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});


app.put("/update-account/:uid", async (req, res) => {

const { uid } = req.params;

const {
firstname,
lastname,
email,
contact,
address,
profileImage
} = req.body;

try {

await admin.auth().updateUser(uid,{
email
});

await db.collection("residents").doc(uid).update({

firstname,
lastname,
email,
contact,
address,
profileImage

});

res.json({
message:"Account updated successfully"
});

}catch(error){

res.status(500).json({
error:error.message
});

}

});

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

app.get("/admin/reports", async (req, res) => {

  const { search = "", status = "", adminId } = req.query;

  try {

    let query = db.collection("reports");

    // 🔥 ONLY SHOW UNASSIGNED REPORTS
    query = query.where("assignedTo", "==", null);

    const snapshot = await query.get();

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

    let filtered = reports;

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.residentName.toLowerCase().includes(s) ||
        r.category.toLowerCase().includes(s)
      );
    }

    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    res.json(filtered);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});

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

app.put("/admin/review-report/:id", async (req, res) => {

  const { id } = req.params;
  const { message } = req.body;

  try {

    await db.collection("reports").doc(id).update({
      status: "ongoing",
      adminMessage: message
    });

    res.json({ message: "Report moved to ongoing" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});

app.put("/admin/resolve-report/:id", async (req, res) => {

  const { id } = req.params;
  const { message, media } = req.body;

  try {

    await db.collection("reports").doc(id).update({
      status: "resolved",
      resolutionMessage: message,
      resolutionMedia: media
    });

    res.json({ message: "Report resolved successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});

/* CREATE NEWS POST */
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

try{

const adminDoc = await db.collection("residents").doc(adminUID).get();

if(!adminDoc.exists){
return res.status(404).json({message:"Admin not found"});
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

res.json({
message:"Post created",
id:doc.id
});

}catch(err){
res.status(500).json({error:err.message});
}

});

app.get("/news", async (req,res)=>{

try{

const snapshot = await db.collection("news")
.orderBy("createdAt","desc")
.get();

const now = new Date();

const posts = snapshot.docs
  .map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  .filter(post => {

    // if NOT scheduled → show
    if (post.status !== "Scheduled") return true;

    // if scheduled → check time
    const scheduleDate = new Date(post.schedule);

    return now >= scheduleDate;
  })
  .map(post => {

    // OPTIONAL: auto change status
    if (post.status === "Scheduled") {
      return { ...post, status: "Published" };
    }

    return post;
  });

res.json(posts);

}catch(err){
res.status(500).json({error:err.message});
}

});

app.put("/admin/news/:id", async (req,res)=>{

const {id} = req.params;

try{

await db.collection("news").doc(id).update(req.body);

res.json({message:"Post updated"});

}catch(err){
res.status(500).json({error:err.message});
}

});

app.delete("/admin/news/:id", async (req,res)=>{

const {id} = req.params;

try{

await db.collection("news").doc(id).delete();

res.json({message:"Post deleted"});

}catch(err){
res.status(500).json({error:err.message});
}

});

app.post("/create-staff", async (req, res) => {

  const { firstname, lastname, email, phone, role } = req.body;

  try {

    // CREATE AUTH USER
    const user = await admin.auth().createUser({
      email: email,
      password: "123456"
    });

    // 🔥 GET ROLES FROM SETTINGS
    const roleDoc = await db.collection("system_settings").doc("roles").get();

    let permissions = [];

    if (roleDoc.exists) {
      const rolesData = roleDoc.data().roles;

      const selectedRole = rolesData.find(
        r => r.name.toLowerCase() === role.toLowerCase()
      );

      permissions = selectedRole?.permissions || [];
    }

    // SAVE TO FIRESTORE
await db.collection("residents").doc(user.uid).set({
  firstname,
  lastname,
  email,
  contact: phone,
  address: "",
  role,
  permissions: permissions || [], // ✅ ensure always array
  isverified: true,
 createdAt: Date.now()
});

    res.json({ message: "Staff created successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});

app.get("/admin/news", async (req,res)=>{
  try{

    const snapshot = await db.collection("news")
      .orderBy("createdAt","desc")
      .get();

    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(posts);

  }catch(err){
    res.status(500).json({error:err.message});
  }
});


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


app.listen(5000, () => {
  console.log("Server running on port 5000");
});