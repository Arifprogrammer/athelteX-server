const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

//* middlewares
app.use(cors(corsOptions));
app.use(express.json());

//* get request for testing the server
app.get("/", (req, res) => {
  res.send("Hello World!");
});

//* testing the server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
