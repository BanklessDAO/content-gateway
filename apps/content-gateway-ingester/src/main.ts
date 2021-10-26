import * as express from "express";

const programError = (msg: string) => {
    throw new Error(msg);
};

const PORT =
    process.env.PORT ||
    process.env.CG_PORT ||
    programError("You must specify either PORT or CGI_PORT");
    
const CGA_URL = process.env.CGA_URL || programError("You must specify CGA_URL");

const app = express();

app.get("/", (req, res) => {
    res.send("Wat.");
});

const server = app.listen(PORT, () => {
    console.log(`Listening at http://localhost:${PORT}`);
});
server.on("error", console.error);
