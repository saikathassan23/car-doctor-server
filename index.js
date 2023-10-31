const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
var morgan = require('morgan');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const chalk = require('chalk');
const app = express();

// the great morgan
// app.use(morgan(':method :url'));
morgan.token('colorized', (req, res) => {
  return (
    chalk.red(req.method) +
    ' ' +
    chalk.blue(`http://localhost:${process.env.PORT}` + req.url)
  );
});
app.use(morgan(':colorized'));

// middleware
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// mongodb

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// db
const db = client.db('car-doctor');
// collections
const serviceCollection = db.collection('services');
const bookingCollection = db.collection('bookings');

async function run() {
  try {
    // Send a ping to confirm a successful connection
    client.db('admin').command({ ping: 1 });
    console.log('Successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// custom middleware
const logger = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log('token from logger', token);
  if (!token) {
    return res.status(403).send({ msg: 'Unauthenticated' });
  }
  // token verify
  jwt.verify(token, process.env.SECRET_KEY, (err, decode) => {
    if (err) {
      return res.status(403).send({ msg: 'Unauthenticated' });
    } else {
      req.decode = decode;
      console.log('decoded', decode);
      next();
    }
  });
};

// all apis

app.post('/jwt', async (req, res) => {
  const userEmail = req.body;
  const token = jwt.sign(userEmail, process.env.SECRET_KEY, {
    expiresIn: '10h',
  });
  res
    .cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    })
    .send({
      msg: 'success',
    });
});
app.post('/logout', async (req, res) => {
  const user = req.body;
  console.log('user from logout---', user);
  res
    .clearCookie('token', {
      maxAge: 0,
    })
    .send({
      msg: 'success logout',
    });
});

// service related api
app.get('/services', async (req, res) => {
  const cursor = serviceCollection.find();
  const result = await cursor.toArray();
  res.send(result);
});
app.get('/services/:id', async (req, res) => {
  const id = req.params.id;
  const options = {
    projection: { title: 1, img: 1, price: 1 },
  };
  const result = await serviceCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.post('/booking', async (req, res) => {
  console.log('from booking post ---', req.cookies.token);
  const doc = req.body;
  const result = await bookingCollection.insertOne(doc);
  res.send(result);
});
app.get('/booking', logger, async (req, res) => {
  const userEmail = req.query.email;
  const tokenUser = req.decode.email;
  if (userEmail !== tokenUser) {
    return res.status(403).send({
      message: 'unauthorized',
    });
  }
  console.log('tooken decode user ', tokenUser);
  const cursor = bookingCollection.find({ email: req.query.email });
  const result = await cursor.toArray();
  res.send(result);
});
app.delete('/booking/:id', async (req, res) => {
  const id = req.params.id;
  const result = await bookingCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});
app.patch('/booking/:id', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  // console.log(status, id);
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      status: status,
    },
  };
  const result = await bookingCollection.updateOne(filter, updateDoc);
  res.send(result);
});

app.listen(process.env.PORT, () => {
  console.log('server running at port http://localhost:' + process.env.PORT);
});
