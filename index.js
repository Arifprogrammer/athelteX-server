const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
var jwt = require("jsonwebtoken");

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
    const selectedClassesCollection = client
      .db("athleteXDB")
      .collection("selectedClasses");
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    // Send a ping to confirm a successful connection

    /* ---------------------------------------------------------
                          GET
    --------------------------------------------------------- */
    //! get req from classes page
    app.get("/classes", async (req, res) => {
      const query = req.query;
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    //! get req from instructors page
    app.get("/instructors", async (req, res) => {
      const result = await usersCollection.find(req.query).toArray();
      res.send(result);
    });

    //! get req to check the user is student or not
    app.get("/user/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ student: false });
      }
      const query = { email: email };
      const student = await usersCollection.findOne(query);
      const result = { student: student?.role === "student" };
      res.send(result);
    });

    //! get req from selected-classes page
    app.get("/dashboard/selected", verifyJWT, async (req, res) => {
      const result = await selectedClassesCollection.find().toArray();
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
      console.log(selectedClasses);
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
