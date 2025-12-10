const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const {
  getUserById,
  updateUser,
  getAllUsers,
  deleteUserById,
  getUserPasswordById,
  getAdminPassword,
} = require("../models/UserModel");
const { deleteDirectory } = require("../utils/deleteDirectory");
const { execFile } = require("child_process");

dotenv.config();

// select all
const index = async (req, res) => {
  try {
    const users = await getAllUsers();

    if (!users) throw new Error("Invalid Get All users");

    return res.status(200).send({
      data: users,
      message: "success",
    });
  } catch (error) {
    return res.status(400).send({
      message: error.message,
    });
  }
};

// select user by id
const show = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await getUserById(id);

    if (!user) throw new Error(`Invalid Get users id: ${id}`);

    return res.status(200).send({
      message: "success",
      data: user,
    });
  } catch (error) {
    return res.status(400).send({
      message: error.message,
    });
  }
};

const destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await deleteUserById(id);
    if (!user) throw new Error("Invalid delete user");

    deleteDirectory(`${process.env.DATASET_DIR}/data/${id}`);
    deleteDirectory(`${process.env.DATASET_DIR}/backup/${id}`);

    // Panggil script Python untuk training
    // const pythonScript = "../crowd_fatigue_detection_web/face-recognition/del_persons.py";
    const pythonScript = `${process.env.ML_DIR}/face-recognition/del_persons.py`;

    execFile("python", [pythonScript], (error, stdout, stderr) => {
      if (error) {
        console.error("Error executing Python script:", stderr);
      }
      console.log("Python script output:", stdout);
    });
    return res.status(200).send({
      message: `Success delete user id: ${id}`,
    });
  } catch (error) {
    return res.status(400).send({
      message: error.message,
    });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;

    const data = req.body;

    const admin = await getAdminPassword();
    const validatePasswordAdmin = await bcrypt.compare(
      data.passwordAdmin,
      admin.password
    );

    if (!validatePasswordAdmin) throw new Error("Not match password admin!");

    const user = await updateUser({ id, ...data });

    if (!user) throw new Error("Failed update user!");

    return res.status(200).send({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    return res.status(400).send({
      message: error.message,
    });
  }
};

const updateUserPassword = async (req, res) => {
  try {
    // get data id from params
    const { id } = req.params;

    // get data body
    const data = req.body;

    // get admin password
    const admin = await getAdminPassword();

    // compare matching password admin
    const validatePasswordAdmin = await bcrypt.compare(
      data.passwordAdmin,
      admin.password
    );

    // Check password admin
    if (!validatePasswordAdmin) throw new Error("Not match password admin!");

    // hash password
    const newPasswordHashing = await bcrypt.hash(data.newUserPassword, 10);

    // update user
    const updatedUser = await updateUser({
      id,
      password: newPasswordHashing,
    });

    // return if success
    return res.status(200).send({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    // return if error
    return res.status(400).send({
      message: error.message,
    });
  }
};

// User JWT information
const showProfile = async (req, res) => {
  try {
    // ambil data dari JWT
    const id = req.user.id;
    const user = await getUserById(id);

    if (!user) new Error("Error show profile");

    return res.status(200).send({
      data: user,
      message: "success",
    });
  } catch (error) {
    return res.status(400).send({
      message: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { email, name } = req.body;
    const { id } = req.user;

    // update data
    const user = await updateUser({ id, email, name });

    return res.status(200).send({
      status: "success",
      data: user,
    });
  } catch (error) {
    return res.status(error.code || 400).send({
      message: error.message,
    });
  }
};

const updateProfilePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const id = req.user.id;

    if (!(oldPassword && newPassword)) {
      throw new Error("Some fields are missing");
    }

    const user = await getUserPasswordById(id);

    //  cek password old
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new Error("Invalid old password");
    }

    // hashing
    const newPasswordHashing = await bcrypt.hash(newPassword, 10);

    // edit password
    const userNewPass = await updateUser({ id, password: newPasswordHashing });
    if (!userNewPass) {
      throw new Error("Failed edit password");
    }

    return res.status(200).send({
      data: userNewPass,
      message: "Edit Password Success",
    });
  } catch (error) {
    return res.status(error.code || 400).send({
      message: error.message,
    });
  }
};

module.exports = {
  index,
  show,
  update,
  updateProfile,
  showProfile,
  updateUserPassword,
  updateProfilePassword,
  destroy,
};
