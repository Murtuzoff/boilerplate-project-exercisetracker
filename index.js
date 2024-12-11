require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");

const { Sequelize, DataTypes } = require("sequelize");
const pg = require("pg");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    dialect: "postgres",
    dialectModule: pg,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

const User = sequelize.define("user", {
  _id: {
    type: DataTypes.UUID,
    defaultValue: sequelize.literal("uuid_generate_v4()"),
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Exercise = sequelize.define("exercise", {
  _id: {
    type: DataTypes.UUID,
    defaultValue: sequelize.literal("uuid_generate_v4()"),
    primaryKey: true,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
});

User.hasMany(Exercise);
Exercise.belongsTo(User);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate({ logging: false });
    await sequelize.sync({ logging: false });
    console.log("Database Connected");
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
};

connectDatabase();

app.use(cors());
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.post("/api/users", async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.create({ username });
    res.json({ username: user.username, _id: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ["_id", "username"] });

    const userList = users.map((user) => ({
      _id: user._id,
      username: user.username,
    }));

    res.json(userList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  try {
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const exercise = await Exercise.create({
      userId,
      description,
      duration,
      date: date ? new Date(date) : new Date(),
    });

    res.json({
      _id: user._id,
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users/:_id/logs", async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    let queryOptions = {
      where: { userId },
    };

    if (from || to) {
      queryOptions.where.date = {};
      if (from) queryOptions.where.date[Sequelize.Op.gte] = new Date(from);
      if (to) queryOptions.where.date[Sequelize.Op.lte] = new Date(to);
    }

    if (limit) {
      queryOptions.limit = parseInt(limit);
    }

    const exercises = await Exercise.findAll(queryOptions);

    res.json({
      _id: userId,
      username: (await User.findByPk(userId)).username,
      count: exercises.length,
      log: exercises.map((exercise) => ({
        description: exercise.description,
        duration: exercise.duration,
        date: exercise.date.toDateString(),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
