const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
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
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    // Send a ping to confirm a successful connection

    /* ---------------------------------------------------------
                          POST
    --------------------------------------------------------- */
    //? ---------------------JWT-----------------------
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
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
run().catch(console.dir);

//* get request for testing the server
app.get("/", (req, res) => {
  res.send("Hello World!");
});

//* testing the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
