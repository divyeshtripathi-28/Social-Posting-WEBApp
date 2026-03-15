const express = require("express");
const app = express();
const path = require("path");
const User = require("./models/user");
const Post = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());


app.get("/", (req, res) => {
    res.render("index");
});

app.post("/register", async (req, res) => {
    let { email, password, name, username, age } = req.body;

    let oldUser = await User.findOne({ email });
    if(oldUser) return res.status(500).send("User already registered");

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = new User({
                name,
                username,
                password: hash,
                age,
                email
            });
            await user.save();

            let token = jwt.sign({email, userid: user._id}, "shhhh");
            res.cookie("token", token);
            res.send("registered");
        });
    });
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    let { email, password} = req.body;

    let oldUser = await User.findOne({ email });
    if(!oldUser) return res.status(500).send("Something went wrong");

    bcrypt.compare(password, oldUser.password, (err, result) => {
        if(result) {
            let token = jwt.sign({email, userid: oldUser._id}, "shhhh");
            res.cookie("token", token);
            res.status(200).redirect("/profile")
        }
        else res.redirect("/login");
    });

});

app.get("/profile", isLoggedIn, async (req, res) => {
    let user = await User.findOne({email: req.user.email}).populate("posts");
    res.render("profile", {user});
});

app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});

app.post("/post", isLoggedIn, async (req, res) => {
    let user = await User.findOne({email: req.user.email});
    let newPost = new Post({
        user: user._id,
        content: req.body.content,
    });
    let post = await newPost.save();

    user.posts.unshift(post._id);
    await user.save();

    res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
    let post = await Post.findOne({ _id: req.params.id });
    res.render("edit", {post});
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
    await Post.findOneAndUpdate({ _id: req.params.id }, {content: req.body.content});
    res.redirect("/profile");
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
    let post = await Post.findOne({ _id: req.params.id });

    if(post.likes.indexOf(req.user.userid) === -1) {
        post.likes.push(req.user.userid);
    } else {
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }
    await post.save();
    res.redirect("/profile");
});

function isLoggedIn(req, res, next){
    if(req.cookies.token === "") res.redirect("/login");
    else{
        let data = jwt.verify(req.cookies.token, "shhhh");
        req.user = data;
        next();
    }
}

app.listen(8080, () => {
    console.log("listening on port 8080");
});