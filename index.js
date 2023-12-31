const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
var jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

//* middlewares
app.use(cors(corsOptions));
app.use(express.json());

//* custom middlewares
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorize access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: "forbidden token" });
    }
    req.decoded = decoded;
    next();
  });
};

//* ingrating with mongoDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ketp048.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("athleteXDB").collection("users");
    const classesCollection = client.db("athleteXDB").collection("classes");
    const paymentCollection = client.db("athleteXDB").collection("payment");
    const selectedClassesCollection = client
      .db("athleteXDB")
      .collection("selectedClasses");
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    // Send a ping to confirm a successful connection

    //* custom middleswares
    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      if (email !== req.query.email) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorize user" });
      }
      const query = { email: email };
      const student = await usersCollection.findOne(query);
      if (student?.role !== "student") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      if (email !== req.query.email) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorize user" });
      }
      const query = { email: email };
      const instructor = await usersCollection.findOne(query);
      if (instructor?.role !== "Instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      if (email !== req.query.email) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorize user" });
      }
      const query = { email: email };
      const admin = await usersCollection.findOne(query);
      if (admin?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    /* ---------------------------------------------------------
                          GET
    --------------------------------------------------------- */
    //! get req from classes page
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    //! get req from instructors page
    app.get("/instructors", async (req, res) => {
      const result = await usersCollection.find(req.query).toArray();
      res.send(result);
    });

    //! get req to check the user is student or not
    app.get("/user/role/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ student: false, admin: false, instructor: false });
      }
      const query = { email: email };
      const role = await usersCollection.findOne(query);
      const result = {
        student: role?.role === "student",
        admin: role?.role === "admin",
        instructor: role?.role === "Instructor",
      };
      res.send(result);
    });

    //! get req from selected-classes page
    app.get("/dashboard/selected", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      if (email !== req.query.email) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorize user" });
      }
      const filter = { userEmail: email };
      const result = await selectedClassesCollection.find(filter).toArray();
      res.send(result);
    });

    //! get req from enrolled-classes page
    app.get("/dashboard/enrolled", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      if (email !== req.query.email) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorize user" });
      }
      const filter = { email: email };
      const result = await paymentCollection.find(filter).toArray();
      res.send(result);
    });

    //! get req from myclasses page
    app.get(
      "/dashboard/my_classes",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const query = { email: req.query.email };
        const result = await classesCollection.find(query).toArray();
        res.send(result);
      }
    );

    //! get req from manage users page
    app.get("/dashboard/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    /* ---------------------------------------------------------
                          POST
    --------------------------------------------------------- */
    //? ---------------------JWT-----------------------
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "4h",
      });
      res.send({ token });
    });

    //! post req from select btn on classes page
    app.post("/selected", async (req, res) => {
      const selectedClasses = req.body;
      selectedClasses.classId = new ObjectId(selectedClasses._id);
      delete selectedClasses._id;
      const result = await selectedClassesCollection.insertOne(selectedClasses);
      res.send(result);
    });

    //? ---------------------Stripe-----------------------
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //! post req from payment page
    app.post("/payment", verifyJWT, verifyStudent, async (req, res) => {
      const paymentData = req.body;
      const insertResult = await paymentCollection.insertOne(paymentData);
      const updateQuery = { _id: new ObjectId(paymentData.classId) };
      const updateDoc = {
        $inc: { enrolled: 1, seats: -1 },
      };
      const updateResult = await classesCollection.updateOne(
        updateQuery,
        updateDoc
      );
      const deleteQuery = { _id: new ObjectId(paymentData.selectedClassId) };
      const deleteResult = await selectedClassesCollection.deleteOne(
        deleteQuery
      );
      res.send({ insertResult, updateResult, deleteResult });
    });

    //! post req form add a new class page
    app.post("/new_class", verifyJWT, async (req, res) => {
      const result = await classesCollection.insertOne(req.body);
      res.send(result);
    });

    /* ---------------------------------------------------------
                          PUT
    --------------------------------------------------------- */

    //! put req while creating new user
    app.put("/users", async (req, res) => {
      const data = req.body;
      const query = { email: data.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...data,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    /* ---------------------------------------------------------
                          PATCH
    --------------------------------------------------------- */
    //! patch req from approve btn on manage classes page
    app.patch("/approve_class", verifyJWT, verifyAdmin, async (req, res) => {
      const approveClass = req.body;
      const filter = { _id: new ObjectId(approveClass.id) };
      delete approveClass.id;
      const updateDoc = {
        $set: {
          ...approveClass,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //! patch req from deny btn on manage classes page
    app.patch("/deny_class", verifyJWT, verifyAdmin, async (req, res) => {
      const denyClass = req.body;
      const filter = { _id: new ObjectId(denyClass.id) };
      delete denyClass.id;
      const updateDoc = {
        $set: {
          ...denyClass,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //! patch req from make admin btn & make instructor btn on manage users page
    app.patch("/role", verifyJWT, verifyAdmin, async (req, res) => {
      const role = req.body;
      const filter = { _id: new ObjectId(role.id) };
      delete role.id;
      const updateDoc = {
        $set: {
          ...role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    /* ---------------------------------------------------------
                          DELETE
    --------------------------------------------------------- */
    //! delete req from selected classes page
    app.delete("/dashboard/selected/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

//* get request for testing the server
app.get("/", (req, res) => {
  res.send("Hello World!");
});

//* testing the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
