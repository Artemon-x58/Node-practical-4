require("../config/loadConfig");
const express = require("express");
const connectDb = require("../config/connectDb");
const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");
const asyncHandler = require("express-async-handler");
require("colors");
const User = require("./models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./middlewares/authMiddleware");
const rolesModel = require("./models/rolesModel");
const { engine } = require("express-handlebars");
const sendEmail = require("./services/sendEmail");
const app = express();

app.use(express.static("public"));

app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", "backend/views");

app.use(express.urlencoded({ extended: false }));

app.use(express.json());

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.post("/sended", async (req, res) => {
  try {
    const sended = await sendEmail(req.body);
    if (sended) {
      res.render("sended", {
        message: "Contact form send success",
        user: req.body.userName,
        email: req.body.userEmail,
      });
    }
  } catch (error) {
    res.status(400).json({ code: 400, message: error.message });
  }

  // res.send(req.body);
});

app.use("/api/v1", require("./routes/carsRoutes"));

// регистрация - сохранение пользователя в базе

app.get("/register", (req, res) => {
  res.render("register");
});

app.post(
  "/register",
  asyncHandler(async (req, res) => {
    //Отримаємо и валідуємо данні від користувача
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400);
      throw new Error(`Передайте все обязательные поля!!`);
    }
    //Шукаємо користувача в базі
    const user = await User.findOne({ email });
    //Якшо знайшли то відаємо помилку
    if (user) {
      res.status(400);
      throw new Error("Пользователь уже существует");
    }

    //Якшо не знайшли то хешируємо пароль і додаємо роль
    const hashPassword = bcrypt.hashSync(password, 5);
    const roles = await rolesModel.findOne({ value: "USER" });

    //Зберігаемо в базі з захишованим паролем
    const newUser = await User.create({
      ...req.body,
      password: hashPassword,
      roles: [roles.value],
    });
    // res.status(201).json({ code: 201, data: { email: newUser.email } });
    res.status(201);
    res.render("registrationSuccess");
  })
);

// аутинтефиция - проверка подлиности пользователя и пароля с тем что хранится в базе

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  asyncHandler(async (req, res) => {
    //Отримаємо и валідуємо данні від користувача
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400);
      throw new Error(`Передайте все обязательные поля!!`);
    }
    //   //Шукаємо користувача в базі і розшифруємо пароль
    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      res.status(400);
      throw new Error(`Невірний логін або пароль`);
    }

    //   //Якшо знайшли і розшифрували
    const token = generateToken({
      students: ["Andrii", "Artem", "Pavlo"],
      id: user._id,
      roles: user.roles,
    });
    //   //Зберігаемо в базі token

    user.token = token;
    await user.save();
    // res
    //   .status(200)
    //   .json({ code: 200, data: { email: user.email, token: user.token } });
    res.status(200);
    res.render("loginSuccess");
  })
);

function generateToken(data) {
  const payload = { ...data };
  return jwt.sign(payload, "cat", { expiresIn: "1d" });
}

// авторизация - проверка прав доступа
// логаут - выход из системы

app.patch(
  "/logout",
  authMiddleware,
  asyncHandler(async (req, res) => {
    // отримуємо данні про користувача і скидаємо йому токен
    const { id } = req.user;
    const user = await User.findById(id);
    user.token = null;
    await user.save();
    res.status(200).json({
      code: 200,
      data: { token: user.token },
      message: "Logout success",
    });
  })
);

app.use("*", notFound);

app.use(errorHandler);

connectDb();

const { PORT } = process.env;
app.listen(PORT, () => {
  console.log(`Server on ${PORT}`.green.italic.bold);
});
