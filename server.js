require('./config/db');
const express = require('express')

const app =express();
const port = process.env.PORT || 5000;

const UserRouter =require('./api/User')

const cors = require('cors')

app.use(cors());

// const bodyParser = require('express').json;
app.use(express.json());


app.use('/user',UserRouter)



app.listen(port,()=>{
    console.log(`Server running on port ${port}`);
})