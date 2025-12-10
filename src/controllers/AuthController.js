const bcrypt = require("bcrypt");
const {
  insertUser,
  getUserByEmail,
  updateUser,
  checkEmailDuplicate,
} = require("../models/UserModel");

const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const { deleteDirectory } = require("../utils/deleteDirectory");

dotenv.config();

const register = async (req, res) => {
  try {
    // get request body
    const { email, name, password, security_answer } = req.body;

    // Validasi req.body
    if (!(email && name && password && security_answer)) {
      throw new Error("Some fields are missing");
    }

    // Validasi email yang sudah terdaftar
    if ((await checkEmailDuplicate(email)) !== null) {
      throw new Error("Email is exist!");
    }

    // Handle file uploads
    const photos = req.files;
    if (!photos || photos.length === 0) {
      throw new Error("No photos uploaded");
    }

    // Hashing password
    const passwordHashing = await bcrypt.hash(password, 10);

    // create new user
    const newUser = { name, email, password: passwordHashing, security_answer };

    // insert database
    const user = await insertUser(newUser);

    // const dirFaceRecognition =
    //   // process.env.FACE_RECOGNITION_PATH ||
    //   path.resolve(
    //     __dirname,
    //     `../../../crowd_fatigue_detection_web/face-recognition`
    //   );

    const dirDatasets = process.env.DATASET_DIR;

    const userFolder = path.join(dirDatasets, "new_persons", `${user.id}`);

    // Cek apakah folder user.id sudah ada
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    // Pindahkan file dari folder sementara ke folder user.id
    const photoPaths = [];
    await Promise.all(
      photos.map((photo) => {
        const targetPath = path.join(userFolder, photo.filename);
        photoPaths.push(targetPath);
        return fs.promises.rename(photo.path, targetPath);
      })
    );

    deleteDirectory(`${dirDatasets}/face_features/feature.npz`);

    // Panggil script Python untuk training
    const pythonScript = `${process.env.ML_DIR}/face-recognition/add_persons.py`;
    // const pythonScript1 = "../crowd_control_web/face-recognition/app.py";

    execFile("python", [pythonScript], (error, stdout, stderr) => {
      if (error) {
        console.error("Error executing Python script:", stderr);
      }
      console.log("Python script output:", stdout);
    });

    return res.status(200).send({
      // data: user,
      message: "Register Success",
      // photos: photoPaths,
    });
  } catch (error) {
    // Hapus file sementara jika terjadi error
    if (req.files) {
      await Promise.all(
        req.files.map((file) => fs.promises.unlink(file.path).catch(() => {}))
      );
    }

    return res.status(400).send({
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await getUserByEmail(email);

    if (!user) {
      throw new Error("Email not found");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }

    // payload
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    // secret key
    const secret = process.env.JWT_SECRET;

    // expire
    const expireIn = 60 * 60 * 1;

    // Create token JWT
    const token = jwt.sign(payload, secret, { expiresIn: expireIn });

    return res.status(200).send({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    res.status(400).send({
      message: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, security_answer } = req.body;

    if (!(email && newPassword && security_answer)) {
      throw new Error("Some fields are missing");
    }

    // get user by email
    const user = await getUserByEmail(email);
    const id = user.id;

    // Validasi security answer
    if (!(security_answer == user.security_answer)) {
      throw new Error("Invalid security answer");
    }

    // change pass new
    const passwordNewHashing = await bcrypt.hash(newPassword, 10);
    const userNewPass = await updateUser({ id, password: passwordNewHashing });

    if (!userNewPass) {
      throw new Error("Failed reset password");
    }

    // respon
    res.status(200).send({
      data: userNewPass,
      message: "Reset Password Success",
    });
  } catch (error) {
    res.status(400).send({
      message: error.message,
    });
  }
};
module.exports = { login, register, resetPassword };
