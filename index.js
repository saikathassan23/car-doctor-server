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

//custom middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies.token;
  console.log('this is verify token---', token);
  if (!token) {
    res.status(401).send({ message: 'Unauthorized' });
    return;
  }
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      res.status(401).send({ message: 'Unauthorized' });
    }
    // console.log(decoded);
    req.user = decoded;
    next();
  });
};

const againVerified = async (req, res, next) => {
  const token = req?.cookies?.token;
  console.log('from again verified --- ', token);
  req.user = 'hobe na kisu tor dara';
  next();
};

async function run() {
  try {
    const db = client.db('car-doctor');
    const serviceCollection = db.collection('services');
    const bookingCollection = db.collection('bookings');

    // auth related api
    app.post('/jwt', async (req, res) => {
      const data = req.body;
      // console.log(data);
      const token = jwt.sign(data, process.env.SECRET_KEY, { expiresIn: '3d' });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({
          message: 'Token generated successfully',
          status: 200,
        });
    });

    // service related api
    app.get('/services', againVerified, async (req, res) => {
      const user = req.user;
      console.log('user from sevices component--- ', user);
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

    app.post('/booking', verifyToken, async (req, res) => {
      console.log('from booking post ---', req.cookies.token);
      const doc = req.body;
      const result = await bookingCollection.insertOne(doc);
      res.send(result);
    });
    app.get('/booking', verifyToken, async (req, res) => {
      const user = req.user;
      const userEmail = req.query.email;
      console.log('User email', userEmail, '\nFrom jwt mail--', user.email);
      if (userEmail === user.email) {
        const cursor = bookingCollection.find({ email: req.query.email });
        const result = await cursor.toArray();
        res.send(result);
      } else {
        res.status(404).send('Unauthorized dhukte parbi na');
      }
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

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', againVerified, async (req, res) => {
  res.send('Welcome to the server');
});

app.listen(process.env.PORT, () => {
  console.log('server running at port http://localhost:' + process.env.PORT);
});
